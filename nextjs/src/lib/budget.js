import db from './db'

const MONTH_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/

function toMonthStart(value) {
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value)) return null

  const [yearPart, monthPart, dayPart = '01'] = value.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null

  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day < 1 || day > maxDay) return null

  const isoDate = `${yearPart}-${monthPart}-${dayPart}`
  const date = new Date(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function nextMonth(month) {
  const date = new Date(`${month}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function decimalString(value) {
  return value == null ? '0.00' : String(value)
}

export function normalizeMonth(value) {
  return toMonthStart(value)
}

export async function getMonthlyBudget(userId, month) {
  const { rows } = await db.query(
    `SELECT month, monthly_limit, notified
     FROM public.budget_thresholds
     WHERE user_id = $1 AND month = $2`,
    [userId, month]
  )

  return rows[0] ?? null
}

export async function upsertMonthlyBudget(userId, month, monthlyLimit) {
  const { rows } = await db.query(
    `INSERT INTO public.budget_thresholds (user_id, month, monthly_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, month)
     DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
     RETURNING month, monthly_limit, notified`,
    [userId, month, monthlyLimit]
  )

  return rows[0]
}

export async function getMonthlyTotals(userId, month) {
  const endMonth = nextMonth(month)

  const [expenseResult, incomeResult] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS total_expenses
       FROM public.expenses
       WHERE user_id = $1 AND date >= $2 AND date < $3`,
      [userId, month, endMonth]
    ),
    db.query(
      `SELECT COALESCE(SUM(amount), 0)::TEXT AS total_income
       FROM public.income
       WHERE user_id = $1 AND month = $2`,
      [userId, month]
    ),
  ])

  return {
    total_expenses: decimalString(expenseResult.rows[0]?.total_expenses),
    total_income: decimalString(incomeResult.rows[0]?.total_income),
  }
}

export async function buildBudgetSummary(userId, month) {
  const [budget, totals] = await Promise.all([
    getMonthlyBudget(userId, month),
    getMonthlyTotals(userId, month),
  ])

  const totalExpenses = Number(totals.total_expenses)
  const monthlyLimit = budget?.monthly_limit == null ? null : String(budget.monthly_limit)
  const thresholdExceeded = monthlyLimit == null ? false : totalExpenses > Number(monthlyLimit)

  return {
    month,
    monthly_limit: monthlyLimit,
    total_income: totals.total_income,
    total_expenses: totals.total_expenses,
    remaining_budget: monthlyLimit == null ? null : (Number(monthlyLimit) - totalExpenses).toFixed(2),
    threshold_exceeded: thresholdExceeded,
    notified: budget?.notified ?? false,
  }
}

export async function evaluateThresholdForMonth(userId, rawMonth) {
  const month = normalizeMonth(rawMonth)
  if (!month) return null

  const budget = await getMonthlyBudget(userId, month)
  if (!budget) return null

  const totals = await getMonthlyTotals(userId, month)
  const totalExpenses = Number(totals.total_expenses)
  const monthlyLimit = String(budget.monthly_limit)
  const thresholdExceeded = totalExpenses > Number(monthlyLimit)
  const alertTriggered = thresholdExceeded && !budget.notified

  if (budget.notified !== thresholdExceeded) {
    await db.query(
      `UPDATE public.budget_thresholds
       SET notified = $3
       WHERE user_id = $1 AND month = $2`,
      [userId, month, thresholdExceeded]
    )
  }

  return {
    month,
    monthly_limit: monthlyLimit,
    total_expenses: totals.total_expenses,
    threshold_exceeded: thresholdExceeded,
    notified: thresholdExceeded,
    alertTriggered,
    budget_alert: alertTriggered ? {
      month,
      monthly_limit: monthlyLimit,
      total_expenses: totals.total_expenses,
      threshold_exceeded: true,
    } : null,
  }
}

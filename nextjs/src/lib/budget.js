import db from './db'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/
const UNCATEGORIZED_KEY = '__uncategorized__'

function getNormalizedDateString(value, { allowMonth = false } = {}) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    value = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  }
  if (typeof value === 'string' && value.includes('T')) {
    value = value.slice(0, 10)
  }
  if (allowMonth && typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) {
    value = `${value}-01`
  }
  if (typeof value !== 'string' || !(allowMonth ? MONTH_PATTERN : DATE_PATTERN).test(value)) return null

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

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function toMonthStart(value) {
  const normalizedDate = getNormalizedDateString(value, { allowMonth: true })
  if (!normalizedDate) return null
  return `${normalizedDate.slice(0, 7)}-01`
}

function nextMonth(month) {
  const date = new Date(`${month}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function decimalString(value) {
  return value == null ? '0.00' : String(value)
}

function buildCategoryStatusKey(categoryId) {
  return categoryId ?? UNCATEGORIZED_KEY
}

export function normalizeMonth(value) {
  return toMonthStart(value)
}

export function normalizeDate(value) {
  return getNormalizedDateString(value)
}

export function isPositiveMoneyValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0
  }

  if (typeof value !== 'string') return false

  const trimmedValue = value.trim()
  if (!trimmedValue) return false

  const amount = Number(trimmedValue)
  return Number.isFinite(amount) && amount > 0
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

export async function getOwnedOrGlobalCategoriesByIds(userId, categoryIds = []) {
  const uniqueCategoryIds = [...new Set(categoryIds.filter(Boolean))]
  if (!uniqueCategoryIds.length) return []

  const { rows } = await db.query(
    `SELECT id, name, icon
     FROM public.categories
     WHERE id = ANY($1::uuid[]) AND (user_id IS NULL OR user_id = $2)`,
    [uniqueCategoryIds, userId]
  )

  return rows
}

export async function getCategoryBudgets(userId, month) {
  const { rows } = await db.query(
    `SELECT
       cb.category_id,
       cb.monthly_limit,
       c.name AS category_name,
       c.icon AS category_icon
     FROM public.category_budgets cb
     JOIN public.categories c ON cb.category_id = c.id
     WHERE cb.user_id = $1 AND cb.month = $2
     ORDER BY c.name ASC`,
    [userId, month]
  )

  return rows
}

export async function getMonthlyBudgetConfig(userId, month) {
  const [budget, categoryBudgets] = await Promise.all([
    getMonthlyBudget(userId, month),
    getCategoryBudgets(userId, month),
  ])

  if (!budget && !categoryBudgets.length) return null

  return {
    month,
    monthly_limit: budget?.monthly_limit == null ? null : String(budget.monthly_limit),
    notified: budget?.notified ?? false,
    category_budgets: categoryBudgets.map((item) => ({
      category_id: item.category_id,
      category_name: item.category_name,
      category_icon: item.category_icon,
      monthly_limit: String(item.monthly_limit),
    })),
  }
}

export async function upsertMonthlyBudget(userId, month, monthlyLimit) {
  const { rows } = await db.query(
    `INSERT INTO public.budget_thresholds (user_id, month, monthly_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, month)
     DO UPDATE SET
       monthly_limit = EXCLUDED.monthly_limit,
       notified = CASE
         WHEN budget_thresholds.monthly_limit IS DISTINCT FROM EXCLUDED.monthly_limit THEN false
         ELSE budget_thresholds.notified
       END
     RETURNING month, monthly_limit, notified`,
    [userId, month, monthlyLimit]
  )

  return rows[0]
}

export async function upsertCategoryBudgets(userId, month, categoryBudgets = []) {
  if (!categoryBudgets.length) return []

  const values = []
  const placeholders = categoryBudgets.map((item, index) => {
    const offset = index * 4
    values.push(userId, item.category_id, month, item.monthly_limit)
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
  })

  const { rows } = await db.query(
    `INSERT INTO public.category_budgets (user_id, category_id, month, monthly_limit)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (user_id, category_id, month)
     DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit
     RETURNING category_id, month, monthly_limit`,
    values
  )

  return rows
}

export async function getMonthlyTotals(userId, month) {
  const endMonth = nextMonth(month)

  const [expenseResult, incomeResult] = await Promise.all([
    db.query(
      `SELECT COALESCE(SUM(amount), 0.00)::TEXT AS total_expenses
       FROM public.expenses
       WHERE user_id = $1 AND date >= $2 AND date < $3`,
      [userId, month, endMonth]
    ),
    db.query(
      `SELECT COALESCE(SUM(amount), 0.00)::TEXT AS total_income
       FROM public.income
       WHERE user_id = $1 AND date >= $2 AND date < $3`,
      [userId, month, endMonth]
    ),
  ])

  return {
    total_expenses: decimalString(expenseResult.rows[0]?.total_expenses),
    total_income: decimalString(incomeResult.rows[0]?.total_income),
  }
}

export async function getMonthlyCategorySpend(userId, month) {
  const endMonth = nextMonth(month)

  const { rows } = await db.query(
    `SELECT
       e.category_id,
       COALESCE(c.name, 'Uncategorized') AS category_name,
       c.icon AS category_icon,
       COALESCE(SUM(e.amount), 0.00)::TEXT AS spent
     FROM public.expenses e
     LEFT JOIN public.categories c ON e.category_id = c.id
     WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3
     GROUP BY e.category_id, COALESCE(c.name, 'Uncategorized'), c.icon
     ORDER BY category_name ASC`,
    [userId, month, endMonth]
  )

  return rows
}

function buildCategoryStatuses(categoryBudgets = [], categorySpend = []) {
  const categoryStatusMap = new Map()

  categoryBudgets.forEach((item) => {
    const key = buildCategoryStatusKey(item.category_id)
    categoryStatusMap.set(key, {
      category_id: item.category_id,
      category_name: item.category_name,
      category_icon: item.category_icon,
      monthly_limit: String(item.monthly_limit),
      spent: '0.00',
    })
  })

  categorySpend.forEach((item) => {
    const key = buildCategoryStatusKey(item.category_id)
    const existing = categoryStatusMap.get(key)
    categoryStatusMap.set(key, {
      category_id: item.category_id,
      category_name: item.category_name,
      category_icon: item.category_icon,
      monthly_limit: existing?.monthly_limit ?? null,
      spent: decimalString(item.spent),
    })
  })

  return [...categoryStatusMap.values()]
    .map((item) => {
      const monthlyLimit = item.monthly_limit == null ? null : String(item.monthly_limit)
      const spent = decimalString(item.spent)
      const numericSpent = Number(spent)
      const numericMonthlyLimit = monthlyLimit == null ? null : Number(monthlyLimit)
      const thresholdExceeded = numericMonthlyLimit == null ? false : numericSpent >= numericMonthlyLimit

      return {
        category_id: item.category_id,
        category_name: item.category_name,
        category_icon: item.category_icon,
        monthly_limit: monthlyLimit,
        spent,
        remaining_budget: numericMonthlyLimit == null ? null : (numericMonthlyLimit - numericSpent).toFixed(2),
        threshold_exceeded: thresholdExceeded,
        progress_percentage: numericMonthlyLimit == null || numericMonthlyLimit <= 0
          ? 0
          : Number(((numericSpent / numericMonthlyLimit) * 100).toFixed(2)),
      }
    })
    .sort((left, right) => left.category_name.localeCompare(right.category_name))
}

export async function buildBudgetSummary(userId, month) {
  const [budget, totals, categoryBudgets, categorySpend] = await Promise.all([
    getMonthlyBudget(userId, month),
    getMonthlyTotals(userId, month),
    getCategoryBudgets(userId, month),
    getMonthlyCategorySpend(userId, month),
  ])

  const categoryStatuses = buildCategoryStatuses(categoryBudgets, categorySpend)
  const categoryBudgetTotalNumber = categoryBudgets.reduce((sum, item) => sum + Number(item.monthly_limit ?? 0), 0)
  const hasCategoryBudgets = categoryBudgets.length > 0
  const totalExpenses = Number(totals.total_expenses)
  const monthlyLimit = budget?.monthly_limit == null ? null : String(budget.monthly_limit)
  const categoryBudgetTotal = categoryBudgetTotalNumber.toFixed(2)
  const totalBudget = monthlyLimit ?? (hasCategoryBudgets ? categoryBudgetTotal : null)
  const thresholdExceeded = totalBudget == null ? false : totalExpenses >= Number(totalBudget)

  return {
    month,
    monthly_limit: monthlyLimit,
    category_budget_total: categoryBudgetTotal,
    total_budget: totalBudget,
    total_income: totals.total_income,
    total_expenses: totals.total_expenses,
    remaining_budget: totalBudget == null ? null : (Number(totalBudget) - totalExpenses).toFixed(2),
    threshold_exceeded: thresholdExceeded,
    notified: budget?.notified ?? false,
    category_statuses: categoryStatuses,
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
  const thresholdExceeded = totalExpenses >= Number(monthlyLimit)
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

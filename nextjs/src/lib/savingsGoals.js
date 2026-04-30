import db from './db'
import { isPositiveMoneyValue, normalizeDate } from './budget'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MONEY_STRING_PATTERN = /^\d{1,8}(\.\d{1,2})?$/
const MAX_MONEY_VALUE = 99999999.99
const MONEY_EPSILON = 1e-9
const MAX_GOAL_ICON_LENGTH = 8

export class SavingsGoalValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'SavingsGoalValidationError'
  }
}

function savingsGoalValidationError(message) {
  return new SavingsGoalValidationError(message)
}

function toMoneyNumber(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
}

function toDateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  }
  if (typeof value === 'string') return value.slice(0, 10)
  return null
}

function getMonthStart(date) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date()
  return new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), 1, 12))
}

export function getSavingsGoalReferenceDate(month, referenceDate = new Date()) {
  const monthStart = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(monthStart.getTime())) return referenceDate

  const currentMonthStart = getMonthStart(referenceDate)
  if (
    monthStart.getUTCFullYear() === currentMonthStart.getUTCFullYear()
    && monthStart.getUTCMonth() === currentMonthStart.getUTCMonth()
  ) {
    return referenceDate
  }

  return monthStart
}

function getMonthsRemaining(targetDate, referenceDate = new Date()) {
  const target = new Date(`${targetDate}T12:00:00Z`)
  if (Number.isNaN(target.getTime())) return 1

  const currentMonth = getMonthStart(referenceDate)
  const targetMonth = getMonthStart(target)
  const monthDelta = (
    (targetMonth.getUTCFullYear() - currentMonth.getUTCFullYear()) * 12
    + (targetMonth.getUTCMonth() - currentMonth.getUTCMonth())
  )

  return Math.max(monthDelta + 1, 1)
}

function isBeforeToday(dateValue, referenceDate = new Date()) {
  const target = new Date(`${dateValue}T00:00:00Z`)
  if (Number.isNaN(target.getTime())) return false
  const today = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()))
  return target < today
}

function buildBudgetContext(goal, budgetSummary, referenceDate = new Date()) {
  const targetAmount = toMoneyNumber(goal.target_amount)
  const currentAmount = toMoneyNumber(goal.current_amount)
  const remainingAmount = Math.max(Number((targetAmount - currentAmount).toFixed(2)), 0)
  const monthsRemaining = getMonthsRemaining(toDateOnly(goal.target_date), referenceDate)
  const monthlyRequired = remainingAmount > 0 ? Number((remainingAmount / monthsRemaining).toFixed(2)) : 0
  const isComplete = currentAmount >= targetAmount
  const isOverdue = !isComplete && isBeforeToday(toDateOnly(goal.target_date), referenceDate)

  let status = 'ready'
  const availableBudget = budgetSummary?.remaining_budget == null ? null : toMoneyNumber(budgetSummary.remaining_budget)
  const hasBudget = budgetSummary?.total_budget != null && toMoneyNumber(budgetSummary.total_budget) > 0

  if (isComplete) status = 'complete'
  else if (isOverdue) status = 'overdue'
  else if (!hasBudget) status = 'no_budget'
  else if (availableBudget < 0 || monthlyRequired > availableBudget) status = 'over_budget'
  else if (availableBudget > 0 && monthlyRequired / availableBudget >= 0.8) status = 'tight'

  return {
    month: budgetSummary?.month ?? null,
    total_income: budgetSummary?.total_income ?? null,
    total_expenses: budgetSummary?.total_expenses ?? null,
    total_budget: budgetSummary?.total_budget ?? null,
    remaining_budget: budgetSummary?.remaining_budget ?? null,
    monthly_required: monthlyRequired.toFixed(2),
    available_after_goal_contributions: availableBudget == null ? null : (availableBudget - monthlyRequired).toFixed(2),
    status,
  }
}

function serializeGoal(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? null,
    target_amount: String(row.target_amount),
    current_amount: String(row.current_amount),
    target_date: toDateOnly(row.target_date),
    archived: Boolean(row.archived),
    archived_at: row.archived_at ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function normalizeGoalName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (!name || name.length > 80) return null
  return name
}

export function normalizeGoalIcon(value) {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const icon = value.trim()
  if (!icon) return null
  if (icon.length > MAX_GOAL_ICON_LENGTH) return null
  return icon
}

export function normalizeGoalTargetDate(value) {
  return normalizeDate(value)
}

export function isNonNegativeMoneyValue(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY_VALUE) return false
    const cents = value * 100
    const roundedCents = Math.round(cents)
    return roundedCents >= 0 && Math.abs(cents - roundedCents) <= MONEY_EPSILON
  }

  if (typeof value !== 'string') return false
  const trimmedValue = value.trim()
  if (!trimmedValue) return false
  if (!MONEY_STRING_PATTERN.test(trimmedValue)) return false
  const amount = Number(trimmedValue)
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_MONEY_VALUE
}

export function isValidGoalId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export async function listSavingsGoals(userId, { includeArchived = false } = {}) {
  const { rows } = await db.query(
    `SELECT id, name, icon, target_amount::TEXT, current_amount::TEXT, target_date, archived, archived_at, created_at, updated_at
     FROM public.savings_goals
     WHERE user_id = $1 AND ($2::BOOLEAN OR archived = false)
     ORDER BY archived ASC, target_date ASC, updated_at DESC`,
    [userId, Boolean(includeArchived)]
  )

  return rows.map(serializeGoal)
}

export async function getSavingsGoalById(userId, goalId) {
  const { rows } = await db.query(
    `SELECT id, name, icon, target_amount::TEXT, current_amount::TEXT, target_date, archived, archived_at, created_at, updated_at
     FROM public.savings_goals
     WHERE user_id = $1 AND id = $2`,
    [userId, goalId]
  )

  return rows[0] ? serializeGoal(rows[0]) : null
}

export async function createSavingsGoal(userId, payload = {}) {
  const name = normalizeGoalName(payload.name)
  const icon = normalizeGoalIcon(payload.icon)
  const targetDate = normalizeGoalTargetDate(payload.target_date)
  const currentAmount = payload.current_amount === undefined ? 0 : payload.current_amount

  if (!name) throw savingsGoalValidationError('name must be 1-80 characters')
  if (!isPositiveMoneyValue(payload.target_amount)) throw savingsGoalValidationError('target_amount must be a valid positive money amount')
  if (!isNonNegativeMoneyValue(currentAmount)) throw savingsGoalValidationError('current_amount must be a valid non-negative money amount')
  if (!targetDate) throw savingsGoalValidationError('Valid target_date is required')

  if (payload.icon !== undefined && payload.icon !== null && String(payload.icon).trim() && !icon) throw savingsGoalValidationError('icon must be a short text value')

  const { rows } = await db.query(
    `INSERT INTO public.savings_goals (user_id, name, icon, target_amount, current_amount, target_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, icon, target_amount::TEXT, current_amount::TEXT, target_date, archived, archived_at, created_at, updated_at`,
    [userId, name, icon, payload.target_amount, currentAmount, targetDate]
  )

  return serializeGoal(rows[0])
}

export async function updateSavingsGoal(userId, goalId, payload = {}) {
  if (!isValidGoalId(goalId)) throw savingsGoalValidationError('goal_id must be a valid UUID')

  const entries = []
  if (payload.name !== undefined) {
    const name = normalizeGoalName(payload.name)
    if (!name) throw savingsGoalValidationError('name must be 1-80 characters')
    entries.push(['name', name])
  }
  if (payload.icon !== undefined) {
    const icon = normalizeGoalIcon(payload.icon)
    if (payload.icon !== null && String(payload.icon).trim() && !icon) throw savingsGoalValidationError('icon must be a short text value')
    entries.push(['icon', icon])
  }
  if (payload.target_amount !== undefined) {
    if (!isPositiveMoneyValue(payload.target_amount)) throw savingsGoalValidationError('target_amount must be a valid positive money amount')
    entries.push(['target_amount', payload.target_amount])
  }
  if (payload.current_amount !== undefined) {
    if (!isNonNegativeMoneyValue(payload.current_amount)) throw savingsGoalValidationError('current_amount must be a valid non-negative money amount')
    entries.push(['current_amount', payload.current_amount])
  }
  if (payload.target_date !== undefined) {
    const targetDate = normalizeGoalTargetDate(payload.target_date)
    if (!targetDate) throw savingsGoalValidationError('Valid target_date is required')
    entries.push(['target_date', targetDate])
  }

  if (!entries.length) throw savingsGoalValidationError('No fields provided to update')

  const fields = entries.map(([key], index) => `${key} = $${index + 1}`)
  const values = entries.map(([, value]) => value)
  const idIndex = values.length + 1
  const userIndex = values.length + 2

  const { rows } = await db.query(
    `UPDATE public.savings_goals
     SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${idIndex} AND user_id = $${userIndex}
        AND archived = false
      RETURNING id, name, icon, target_amount::TEXT, current_amount::TEXT, target_date, archived, archived_at, created_at, updated_at`,
    [...values, goalId, userId]
  )

  return rows[0] ? serializeGoal(rows[0]) : null
}

export async function archiveSavingsGoal(userId, goalId) {
  if (!isValidGoalId(goalId)) throw new Error('goal_id must be a valid UUID')

  const { rows } = await db.query(
    `UPDATE public.savings_goals
     SET archived = true,
          archived_at = COALESCE(archived_at, NOW()),
          updated_at = NOW()
      WHERE id = $1 AND user_id = $2
        AND archived = false
      RETURNING id, name, icon, target_amount::TEXT, current_amount::TEXT, target_date, archived, archived_at, created_at, updated_at`,
    [goalId, userId]
  )

  return rows[0] ? serializeGoal(rows[0]) : null
}

export function buildSavingsGoalProgress(goal, budgetSummary, referenceDate = new Date()) {
  const baseGoal = serializeGoal({
    ...goal,
    archived: goal.archived ?? false,
    current_amount: goal.current_amount ?? '0.00',
  })
  const targetAmount = toMoneyNumber(baseGoal.target_amount)
  const currentAmount = toMoneyNumber(baseGoal.current_amount)
  const remainingAmount = Math.max(Number((targetAmount - currentAmount).toFixed(2)), 0)
  const monthsRemaining = getMonthsRemaining(baseGoal.target_date, referenceDate)
  const progressPercentage = targetAmount > 0 ? Math.min(Number(((currentAmount / targetAmount) * 100).toFixed(2)), 100) : 0
  const monthlyRequired = remainingAmount > 0 ? Number((remainingAmount / monthsRemaining).toFixed(2)) : 0
  const budgetContext = buildBudgetContext(baseGoal, budgetSummary, referenceDate)

  return {
    ...baseGoal,
    remaining_amount: remainingAmount.toFixed(2),
    progress_percentage: progressPercentage,
    months_remaining: monthsRemaining,
    monthly_required: monthlyRequired.toFixed(2),
    budget_context: budgetContext,
  }
}

export function buildSavingsGoalsSummary(goals = [], budgetSummary, referenceDate = new Date()) {
  const enrichedGoals = goals.map((goal) => buildSavingsGoalProgress(goal, budgetSummary, referenceDate))
  const activeGoals = enrichedGoals.filter((goal) => !goal.archived)
  const archivedCount = enrichedGoals.length - activeGoals.length
  const targetTotal = activeGoals.reduce((sum, goal) => sum + toMoneyNumber(goal.target_amount), 0)
  const currentTotal = activeGoals.reduce((sum, goal) => sum + toMoneyNumber(goal.current_amount), 0)
  const remainingTotal = activeGoals.reduce((sum, goal) => sum + toMoneyNumber(goal.remaining_amount), 0)
  const monthlyRequiredTotal = activeGoals.reduce((sum, goal) => sum + toMoneyNumber(goal.monthly_required), 0)
  const availableBudget = budgetSummary?.remaining_budget == null ? null : toMoneyNumber(budgetSummary.remaining_budget)
  const hasBudget = budgetSummary?.total_budget != null && toMoneyNumber(budgetSummary.total_budget) > 0
  const progressPercentage = targetTotal > 0 ? Math.min(Number(((currentTotal / targetTotal) * 100).toFixed(2)), 100) : 0

  let pressureLevel = activeGoals.length ? 'ready' : 'none'
  if (activeGoals.length && activeGoals.every((goal) => toMoneyNumber(goal.remaining_amount) <= 0)) pressureLevel = 'complete'
  else if (activeGoals.length && !hasBudget) pressureLevel = 'no_budget'
  else if (activeGoals.length && (availableBudget < 0 || monthlyRequiredTotal > availableBudget)) pressureLevel = 'over_budget'
  else if (activeGoals.length && availableBudget > 0 && monthlyRequiredTotal / availableBudget >= 0.8) pressureLevel = 'tight'

  return {
    goals: enrichedGoals,
    summary: {
      active_count: activeGoals.length,
      archived_count: archivedCount,
      target_total: targetTotal.toFixed(2),
      current_total: currentTotal.toFixed(2),
      remaining_total: remainingTotal.toFixed(2),
      progress_percentage: progressPercentage,
      monthly_required_total: monthlyRequiredTotal.toFixed(2),
      available_budget: availableBudget == null ? null : availableBudget.toFixed(2),
      available_after_goal_contributions: availableBudget == null ? null : (availableBudget - monthlyRequiredTotal).toFixed(2),
      pressure_level: pressureLevel,
    },
  }
}

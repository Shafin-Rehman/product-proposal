import { shiftMonth } from './financeUtils'
import { buildCategoryBudgetHealth } from './budgetHealth'

const UNCATEGORIZED_KEY = '__uncategorized__'
const MAX_MONEY_CENTS = 9999999999n
const MAX_EXPANDED_MONEY_LENGTH = 32

function expandScientificNotation(rawValue) {
  if (!/[eE]/.test(rawValue)) return rawValue

  const match = rawValue.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/)
  if (!match) return null

  const [, sign, integerPart, fractionPart = '', exponentValue] = match
  const exponent = Number(exponentValue)
  if (!Number.isInteger(exponent)) return null

  const digits = `${integerPart}${fractionPart}`
  const decimalIndex = integerPart.length
  const shiftedIndex = decimalIndex + exponent
  const expandedLength = Math.max(shiftedIndex, digits.length, 1) + (shiftedIndex <= 0 ? Math.abs(shiftedIndex) + 2 : 0)

  if (Math.abs(exponent) > MAX_EXPANDED_MONEY_LENGTH || expandedLength > MAX_EXPANDED_MONEY_LENGTH) {
    return null
  }

  if (shiftedIndex <= 0) {
    return `${sign}0.${'0'.repeat(Math.abs(shiftedIndex))}${digits}`
  }

  if (shiftedIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(shiftedIndex - digits.length)}`
  }

  return `${sign}${digits.slice(0, shiftedIndex)}.${digits.slice(shiftedIndex)}`
}

function parseMoneyAmount(value) {
  if (value == null) return null

  const rawValue = String(value).trim()
  if (!rawValue) return null

  const plainValue = expandScientificNotation(rawValue) ?? rawValue
  const match = plainValue.match(/^([+-])?(?:(\d+)(?:\.(\d*))?|\.(\d+))$/)
  if (!match) return null

  const sign = match[1]
  if (sign === '-') return null

  const integerDigits = match[2] ?? '0'
  const fractionDigits = match[3] ?? match[4] ?? ''
  let cents = BigInt(integerDigits) * 100n
  cents += BigInt((fractionDigits.padEnd(2, '0').slice(0, 2)) || '0')

  if ((fractionDigits[2] ?? '0') >= '5') {
    cents += 1n
  }

  if (cents <= 0n || cents > MAX_MONEY_CENTS) return null
  return Number(cents) / 100
}

function parseSpendAmount(value) {
  if (value == null || value === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return Number(amount.toFixed(2))
}

function toBudgetKey(categoryId) {
  return categoryId ?? UNCATEGORIZED_KEY
}

function getPlannerProgressPercentage(plannedAmount, spentAmount) {
  if (spentAmount == null) return 0
  if (plannedAmount == null) return spentAmount > 0 ? 100 : 0
  return Math.min(Number(((spentAmount / plannedAmount) * 100).toFixed(2)), 100)
}

export function formatMoneyDraftValue(value) {
  const amount = parseMoneyAmount(value)
  return amount == null ? '' : amount.toFixed(2)
}

export function normalizeMoneyDraftForComparison(value) {
  if (value == null) return ''

  const rawValue = String(value).trim()
  if (!rawValue) return ''

  const amount = parseMoneyAmount(rawValue)
  return amount == null ? rawValue : amount.toFixed(2)
}

export function areMoneyDraftValuesEquivalent(left, right) {
  return normalizeMoneyDraftForComparison(left) === normalizeMoneyDraftForComparison(right)
}

export function normalizeMoneyDraftForSave(value) {
  return parseMoneyAmount(value)
}

export function getPlannerStatus(plannedAmount, spentAmount) {
  const health = buildCategoryBudgetHealth({
    monthlyLimit: plannedAmount,
    spent: spentAmount,
    actualsAvailable: true,
  })

  return { label: health.label, tone: health.tone }
}

export function buildPlannerRows({
  categories = [],
  categoryBudgets = [],
  categoryStatuses = [],
  actualsAvailable = true,
} = {}) {
  const rows = []
  const renderedRowIds = new Set()
  const budgetsById = new Map(
    categoryBudgets.map((item) => [toBudgetKey(item.category_id), item])
  )
  const statusesById = new Map(
    categoryStatuses.map((item) => [toBudgetKey(item.category_id), item])
  )

  categories.forEach((category) => {
    const budget = budgetsById.get(toBudgetKey(category.id))
    const status = statusesById.get(toBudgetKey(category.id))
    const plannedAmount = parseMoneyAmount(budget?.monthly_limit ?? status?.monthly_limit)
    const spentAmount = actualsAvailable ? parseSpendAmount(status?.spent) ?? 0 : null
    const remainingAmount = plannedAmount == null || spentAmount == null
      ? null
      : Number((plannedAmount - spentAmount).toFixed(2))
    const plannerStatus = buildCategoryBudgetHealth({
      monthlyLimit: plannedAmount,
      spent: spentAmount,
      actualsAvailable,
    })

    rows.push({
      id: toBudgetKey(category.id),
      categoryId: category.id,
      categoryName: category.name || status?.category_name || 'Uncategorized',
      categoryIcon: category.icon || status?.category_icon || null,
      plannedAmount,
      spentAmount,
      remainingAmount,
      progressPercentage: actualsAvailable ? plannerStatus.progressPercentage : getPlannerProgressPercentage(plannedAmount, spentAmount),
      statusLabel: plannerStatus.label,
      statusTone: plannerStatus.tone,
      statusKey: plannerStatus.key,
      statusDetail: plannerStatus.detailText,
      remainingText: plannerStatus.remainingText,
      progressAriaValueText: plannerStatus.ariaValueText,
      isEditable: true,
      hasSavedPlan: plannedAmount != null,
    })
    renderedRowIds.add(toBudgetKey(category.id))
  })

  const extraStatuses = categoryStatuses
    .filter((status) => !renderedRowIds.has(toBudgetKey(status.category_id)))
    .sort((left, right) => String(left.category_name || '').localeCompare(String(right.category_name || '')))

  extraStatuses.forEach((status) => {
    const budget = budgetsById.get(toBudgetKey(status.category_id))
    const plannedAmount = parseMoneyAmount(budget?.monthly_limit ?? status?.monthly_limit)
    const spentAmount = actualsAvailable ? parseSpendAmount(status?.spent) ?? 0 : null
    const remainingAmount = plannedAmount == null || spentAmount == null
      ? null
      : Number((plannedAmount - spentAmount).toFixed(2))
    const plannerStatus = buildCategoryBudgetHealth({
      monthlyLimit: plannedAmount,
      spent: spentAmount,
      actualsAvailable,
    })

    rows.push({
      id: toBudgetKey(status.category_id),
      categoryId: status.category_id,
      categoryName: status.category_name || budget?.category_name || 'Uncategorized',
      categoryIcon: status.category_icon || budget?.category_icon || null,
      plannedAmount,
      spentAmount,
      remainingAmount,
      progressPercentage: actualsAvailable ? plannerStatus.progressPercentage : getPlannerProgressPercentage(plannedAmount, spentAmount),
      statusLabel: plannerStatus.label,
      statusTone: plannerStatus.tone,
      statusKey: plannerStatus.key,
      statusDetail: plannerStatus.detailText,
      remainingText: plannerStatus.remainingText,
      progressAriaValueText: plannerStatus.ariaValueText,
      isEditable: status.category_id != null,
      hasSavedPlan: plannedAmount != null,
    })
    renderedRowIds.add(toBudgetKey(status.category_id))
  })

  const extraBudgets = categoryBudgets
    .filter((budget) => !renderedRowIds.has(toBudgetKey(budget.category_id)))
    .sort((left, right) => String(left.category_name || '').localeCompare(String(right.category_name || '')))

  extraBudgets.forEach((budget) => {
    const plannedAmount = parseMoneyAmount(budget?.monthly_limit)
    const spentAmount = actualsAvailable ? 0 : null
    const remainingAmount = plannedAmount == null || spentAmount == null
      ? null
      : Number((plannedAmount - spentAmount).toFixed(2))
    const plannerStatus = buildCategoryBudgetHealth({
      monthlyLimit: plannedAmount,
      spent: spentAmount,
      actualsAvailable,
    })

    rows.push({
      id: toBudgetKey(budget.category_id),
      categoryId: budget.category_id,
      categoryName: budget.category_name || 'Uncategorized',
      categoryIcon: budget.category_icon || null,
      plannedAmount,
      spentAmount,
      remainingAmount,
      progressPercentage: actualsAvailable ? plannerStatus.progressPercentage : getPlannerProgressPercentage(plannedAmount, spentAmount),
      statusLabel: plannerStatus.label,
      statusTone: plannerStatus.tone,
      statusKey: plannerStatus.key,
      statusDetail: plannerStatus.detailText,
      remainingText: plannerStatus.remainingText,
      progressAriaValueText: plannerStatus.ariaValueText,
      isEditable: budget.category_id != null,
      hasSavedPlan: plannedAmount != null,
    })
    renderedRowIds.add(toBudgetKey(budget.category_id))
  })

  return rows
}

export function buildPlannerSummary({ rows = [], summary = null, config = null } = {}) {
  const plannedTotal = Number(rows.reduce((sum, row) => sum + (row.plannedAmount ?? 0), 0).toFixed(2))
  const spentTotal = summary?.total_expenses != null
    ? parseSpendAmount(summary.total_expenses)
    : null
  const remainingTotal = plannedTotal > 0 && spentTotal != null
    ? Number((plannedTotal - spentTotal).toFixed(2))
    : null
  const overallLimit = parseMoneyAmount(config?.monthly_limit ?? summary?.monthly_limit)
  const overallRemaining = overallLimit == null || spentTotal == null
    ? null
    : Number((overallLimit - spentTotal).toFixed(2))

  return {
    plannedTotal,
    spentTotal,
    remainingTotal,
    overallLimit,
    overallRemaining,
    hasActualSpendData: spentTotal != null,
  }
}

export function buildPlannerDraftSnapshot(rows = [], overallLimit = null) {
  const rowDrafts = {}
  rows.forEach((row) => {
    rowDrafts[row.id] = formatMoneyDraftValue(row.plannedAmount)
  })

  return {
    rowDrafts,
    overallDraft: formatMoneyDraftValue(overallLimit),
  }
}

export function mergePlannerDrafts({
  currentRowDrafts = {},
  currentOverallDraft = '',
  nextRowDrafts = {},
  nextOverallDraft = '',
  dirtyRowIds = new Set(),
  isOverallDirty = false,
} = {}) {
  const nextDirtyRowIds = new Set(
    [...dirtyRowIds].filter((rowId) => Object.hasOwn(nextRowDrafts, rowId))
  )
  const mergedRowDrafts = {}

  Object.entries(nextRowDrafts).forEach(([rowId, serverValue]) => {
    const currentValue = currentRowDrafts[rowId] ?? ''
    if (nextDirtyRowIds.has(rowId)) {
      if (areMoneyDraftValuesEquivalent(currentValue, serverValue)) {
        mergedRowDrafts[rowId] = currentValue
        nextDirtyRowIds.delete(rowId)
        return
      }

      mergedRowDrafts[rowId] = currentValue
      return
    }

    mergedRowDrafts[rowId] = serverValue
    nextDirtyRowIds.delete(rowId)
  })

  if (isOverallDirty) {
    if (areMoneyDraftValuesEquivalent(currentOverallDraft, nextOverallDraft)) {
      return {
        rowDrafts: mergedRowDrafts,
        overallDraft: currentOverallDraft,
        dirtyRowIds: nextDirtyRowIds,
        isOverallDirty: false,
      }
    }

    return {
      rowDrafts: mergedRowDrafts,
      overallDraft: currentOverallDraft,
      dirtyRowIds: nextDirtyRowIds,
      isOverallDirty: true,
    }
  }

  return {
    rowDrafts: mergedRowDrafts,
    overallDraft: nextOverallDraft,
    dirtyRowIds: nextDirtyRowIds,
    isOverallDirty: false,
  }
}

function getPlanCopyShape(config) {
  return {
    hasOverallLimit: parseMoneyAmount(config?.monthly_limit) != null,
    hasCategoryBudgets: Array.isArray(config?.category_budgets) && config.category_budgets.length > 0,
  }
}

export function hasSavedPlannerData(config) {
  return Boolean(
    parseMoneyAmount(config?.monthly_limit) != null
    || (Array.isArray(config?.category_budgets) && config.category_budgets.length)
  )
}

export function getPlannerAdjacentMonths(month) {
  return {
    previousMonth: shiftMonth(month, -1),
    nextMonth: shiftMonth(month, 1),
  }
}

export function getCopyLastMonthState({
  currentConfig,
  previousConfig,
  isSampleMode = false,
  isPreviousMonthLoading = false,
  isPreviousMonthUnavailable = false,
} = {}) {
  if (isSampleMode) {
    return {
      disabled: true,
      reason: 'Sample mode is read-only.',
    }
  }

  if (isPreviousMonthLoading) {
    return {
      disabled: true,
      reason: 'Checking last month for a saved plan.',
    }
  }

  if (isPreviousMonthUnavailable) {
    return {
      disabled: true,
      reason: 'Last month is unavailable right now.',
    }
  }

  const currentShape = getPlanCopyShape(currentConfig)
  const previousShape = getPlanCopyShape(previousConfig)
  const canCopyOverall = !currentShape.hasOverallLimit && previousShape.hasOverallLimit
  const canCopyCategories = !currentShape.hasCategoryBudgets && previousShape.hasCategoryBudgets

  if (!canCopyOverall && !canCopyCategories) {
    if (!hasSavedPlannerData(previousConfig)) {
      return {
        disabled: true,
        reason: 'No saved plan was found for last month.',
      }
    }

    return {
      disabled: true,
      reason: 'This month already has all the planner data that can be copied safely.',
    }
  }

  return {
    disabled: false,
    reason: canCopyOverall && canCopyCategories
      ? 'Copy last month into the missing planner fields for this month.'
      : canCopyOverall
        ? 'Copy last month\'s overall cap into this month.'
        : 'Copy last month\'s category budgets into this month.',
  }
}

export function buildCopyLastMonthPayload(month, previousConfig, currentConfig = null) {
  if (!month || !hasSavedPlannerData(previousConfig)) return null

  const payload = { month }
  const previousShape = getPlanCopyShape(previousConfig)
  const currentShape = getPlanCopyShape(currentConfig)
  const canCopyOverall = !currentShape.hasOverallLimit && previousShape.hasOverallLimit
  const canCopyCategories = !currentShape.hasCategoryBudgets && previousShape.hasCategoryBudgets
  const overallLimit = canCopyOverall ? parseMoneyAmount(previousConfig?.monthly_limit) : null
  const categoryBudgets = (previousConfig?.category_budgets ?? [])
    .map((item) => ({
      category_id: item?.category_id,
      monthly_limit: parseMoneyAmount(item?.monthly_limit),
    }))
    .filter((item) => item.category_id && item.monthly_limit != null)

  if (overallLimit != null) {
    payload.monthly_limit = overallLimit
  }

  if (canCopyCategories && categoryBudgets.length) {
    payload.category_budgets = categoryBudgets
  }

  return payload.monthly_limit != null || payload.category_budgets?.length
    ? payload
    : null
}

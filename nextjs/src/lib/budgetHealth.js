import { formatCurrency, getCurrentMonthStart } from './financeUtils'

export const BUDGET_NEAR_LIMIT_RATIO = 0.8

function getSafeMoneyNumber(value) {
  if (value == null || value === '') return null

  const amount = Number(value)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : null
}

function getSafeReferenceDate(referenceDate) {
  const parsedReferenceDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  return Number.isNaN(parsedReferenceDate.getTime()) ? new Date() : parsedReferenceDate
}

function getNormalizedMonthDetails(month) {
  const monthMatch = typeof month === 'string'
    ? month.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    : null

  if (!monthMatch) return null

  const monthYear = Number(monthMatch[1])
  const monthNumber = Number(monthMatch[2])
  const monthDay = Number(monthMatch[3])
  const parsedMonth = new Date(Date.UTC(monthYear, monthNumber - 1, monthDay, 12))

  if (
    parsedMonth.getUTCFullYear() !== monthYear
    || parsedMonth.getUTCMonth() !== monthNumber - 1
    || parsedMonth.getUTCDate() !== monthDay
  ) {
    return null
  }

  return {
    normalizedMonth: `${monthMatch[1]}-${monthMatch[2]}-01`,
    monthLength: new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate(),
  }
}

export function getMonthProgressState(month, { observedDayCount = 0, referenceDate = new Date() } = {}) {
  const monthDetails = getNormalizedMonthDetails(month)

  if (!monthDetails) {
    return {
      monthLength: 0,
      activeDay: 0,
      daysRemaining: 0,
      isCurrentMonth: false,
    }
  }

  const currentDate = getSafeReferenceDate(referenceDate)
  const { normalizedMonth, monthLength } = monthDetails
  const isCurrentMonth = getCurrentMonthStart(currentDate) === normalizedMonth
  const fallbackObservedDays = Number.isFinite(observedDayCount)
    ? Math.max(0, Math.floor(observedDayCount))
    : 0
  const activeDay = isCurrentMonth
    ? Math.min(Math.max(currentDate.getDate(), 1), monthLength)
    : Math.min(Math.max(fallbackObservedDays || monthLength, 1), monthLength)
  const daysRemaining = isCurrentMonth || fallbackObservedDays
    ? Math.max(monthLength - activeDay + 1, 0)
    : 0

  return {
    monthLength,
    activeDay,
    daysRemaining,
    isCurrentMonth,
  }
}

function getAvailabilityKey(availability) {
  if (availability === 'loading' || availability === 'unavailable') return availability
  return 'ready'
}

function getBudgetSource(summary) {
  if (!summary) return 'unavailable'
  if (getSafeMoneyNumber(summary.monthly_limit) != null) return 'overall_limit'
  if (getSafeMoneyNumber(summary.total_budget) != null) return 'category_total'
  return 'none'
}

function formatMoneyDelta(amount) {
  return `${formatCurrency(Math.abs(amount ?? 0))} ${amount != null && amount < 0 ? 'over' : 'left'}`
}

export function buildOverallBudgetHealth({
  summary = null,
  availability = 'ready',
  month,
  observedDayCount = 0,
  referenceDate = new Date(),
} = {}) {
  const availabilityKey = getAvailabilityKey(availability)
  const monthState = getMonthProgressState(month || summary?.month, { observedDayCount, referenceDate })

  if (availabilityKey === 'loading') {
    return {
      key: 'loading',
      label: 'Waiting',
      tone: 'neutral',
      budgetSource: 'unavailable',
      totalBudget: null,
      spent: null,
      remaining: null,
      progressPercentage: 0,
      daysRemaining: monthState.daysRemaining || null,
      dailyAllowance: null,
      primaryValue: 'Waiting on live totals',
      supportingText: 'Budget snapshot',
      progressLabel: 'Live summary is loading.',
      progressNote: 'Budget guidance will appear as soon as the month snapshot loads.',
      monthState,
    }
  }

  if (availabilityKey === 'unavailable' || !summary) {
    return {
      key: 'unavailable',
      label: 'Unavailable',
      tone: 'neutral',
      budgetSource: 'unavailable',
      totalBudget: null,
      spent: null,
      remaining: null,
      progressPercentage: 0,
      daysRemaining: null,
      dailyAllowance: null,
      primaryValue: 'Budget unavailable',
      supportingText: 'This month\'s live budget summary is unavailable.',
      progressLabel: 'Monthly budget progress unavailable.',
      progressNote: 'Retry once the live summary is available again.',
      monthState,
    }
  }

  const budgetSource = getBudgetSource(summary)
  const totalBudget = getSafeMoneyNumber(summary.total_budget ?? summary.monthly_limit)
  const spent = getSafeMoneyNumber(summary.total_expenses) ?? 0
  const income = getSafeMoneyNumber(summary.total_income) ?? 0
  const remaining = summary.remaining_budget == null
    ? (totalBudget != null ? Number((totalBudget - spent).toFixed(2)) : null)
    : getSafeMoneyNumber(summary.remaining_budget)
  const hasBudget = totalBudget != null && totalBudget > 0
  const progressRaw = hasBudget ? (spent / totalBudget) * 100 : 0
  const progressPercentage = hasBudget ? Math.min(Number(progressRaw.toFixed(2)), 100) : 0
  const isOverBudget = hasBudget && ((remaining ?? 0) < 0 || Boolean(summary.threshold_exceeded))
  const isNearLimit = hasBudget && !isOverBudget && progressRaw >= BUDGET_NEAR_LIMIT_RATIO * 100
  const dailyAllowance = hasBudget && monthState.daysRemaining > 0 && remaining != null
    ? Number((remaining / monthState.daysRemaining).toFixed(2))
    : null

  if (!hasBudget) {
    return {
      key: 'no_budget',
      label: 'No budget',
      tone: 'neutral',
      budgetSource,
      totalBudget: null,
      spent,
      remaining: null,
      progressPercentage: 0,
      daysRemaining: null,
      dailyAllowance: null,
      primaryValue: `${formatCurrency(spent)} spent`,
      supportingText: `${formatCurrency(income)} in income tracked so far.`,
      progressLabel: 'No monthly budget set yet.',
      progressNote: 'Set a budget to unlock left-to-spend guidance, days left, and daily allowance.',
      monthState,
    }
  }

  const baseState = {
    budgetSource,
    totalBudget,
    spent,
    remaining,
    progressPercentage,
    daysRemaining: monthState.daysRemaining,
    dailyAllowance,
    monthState,
    supportingText: `Spent ${formatCurrency(spent)} of ${formatCurrency(totalBudget)} budgeted.`,
    progressLabel: `${formatCurrency(spent)} spent against ${formatCurrency(totalBudget)} budgeted`,
  }

  if (isOverBudget) {
    return {
      key: 'over_budget',
      label: 'Over budget',
      tone: 'danger',
      primaryValue: `${formatCurrency(Math.abs(remaining ?? 0))} over`,
      progressNote: 'This month has moved past the budget cap and needs correction at a glance.',
      ...baseState,
    }
  }

  if (isNearLimit) {
    return {
      key: 'near_limit',
      label: 'Near limit',
      tone: 'warning',
      primaryValue: `${formatCurrency(remaining ?? 0)} left`,
      progressNote: 'Budget pressure is rising and should stay visible across the app.',
      ...baseState,
    }
  }

  return {
    key: 'on_track',
    label: 'On track',
    tone: 'positive',
    primaryValue: `${formatCurrency(remaining ?? 0)} left`,
    progressNote: 'Budget pace is still healthy for the month so far.',
    ...baseState,
  }
}

export function buildFinancialHealth({ summary = null, availability = 'ready' } = {}) {
  const availabilityKey = getAvailabilityKey(availability)

  if (availabilityKey === 'loading') {
    return {
      key: 'loading',
      label: 'Waiting',
      tone: 'neutral',
      netAmount: null,
      valueText: 'Waiting on net',
      detailText: 'Financial health will appear once the monthly summary loads.',
    }
  }

  if (availabilityKey === 'unavailable' || !summary) {
    return {
      key: 'unavailable',
      label: 'Unavailable',
      tone: 'neutral',
      netAmount: null,
      valueText: 'Health unavailable',
      detailText: 'Financial health is unavailable until the live summary returns.',
    }
  }

  const income = getSafeMoneyNumber(summary.total_income) ?? 0
  const spent = getSafeMoneyNumber(summary.total_expenses) ?? 0
  const netAmount = Number((income - spent).toFixed(2))

  if (netAmount < 0) {
    return {
      key: 'negative_cash_flow',
      label: 'Negative cash flow',
      tone: 'danger',
      netAmount,
      valueText: `${formatCurrency(Math.abs(netAmount))} behind`,
      detailText: 'Expenses exceed income this month.',
    }
  }

  if (netAmount > 0) {
    return {
      key: 'positive_cash_flow',
      label: 'Positive cash flow',
      tone: 'positive',
      netAmount,
      valueText: `${formatCurrency(netAmount)} ahead`,
      detailText: 'Income exceeds expenses this month.',
    }
  }

  return {
    key: 'break_even',
    label: 'Break even',
    tone: 'neutral',
    netAmount: 0,
    valueText: formatCurrency(0),
    detailText: 'Income matches expenses this month.',
  }
}

export function buildCategoryBudgetHealth({
  monthlyLimit,
  spent,
  actualsAvailable = true,
} = {}) {
  const limit = getSafeMoneyNumber(monthlyLimit)
  const spentAmount = actualsAvailable ? (getSafeMoneyNumber(spent) ?? 0) : null

  if (!actualsAvailable) {
    if (limit == null) {
      return {
        key: 'no_budget',
        label: 'No budget',
        tone: 'neutral',
        progressPercentage: 0,
        remainingAmount: null,
        remainingText: 'No budget set',
        detailText: 'No budget set for this category.',
        ariaValueText: 'No budget set and actual spend is unavailable.',
      }
    }

    return {
      key: 'actual_unavailable',
      label: 'Actual unavailable',
      tone: 'neutral',
      progressPercentage: 0,
      remainingAmount: null,
      remainingText: 'Actual spend unavailable',
      detailText: 'Budget set, but actual spend is unavailable right now.',
      ariaValueText: 'Actual spend is unavailable for this category.',
    }
  }

  if (limit == null) {
    if ((spentAmount ?? 0) > 0) {
      return {
        key: 'unplanned_spend',
        label: 'Unplanned spend',
        tone: 'warning',
        progressPercentage: 100,
        remainingAmount: null,
        remainingText: `${formatCurrency(spentAmount)} spent unplanned`,
        detailText: 'Spending is landing in this category without a saved budget.',
        ariaValueText: `${formatCurrency(spentAmount)} spent without a saved budget.`,
      }
    }

    return {
      key: 'no_budget',
      label: 'No budget',
      tone: 'neutral',
      progressPercentage: 0,
      remainingAmount: null,
      remainingText: 'No budget set',
      detailText: 'No budget set for this category.',
      ariaValueText: 'No budget set for this category.',
    }
  }

  const remainingAmount = Number((limit - spentAmount).toFixed(2))
  const progressPercentage = Math.min(Number(((spentAmount / limit) * 100).toFixed(2)), 100)
  const detailText = `Spent ${formatCurrency(spentAmount)} of ${formatCurrency(limit)} budgeted.`

  if (spentAmount > limit) {
    return {
      key: 'over_budget',
      label: 'Over budget',
      tone: 'danger',
      progressPercentage,
      remainingAmount,
      remainingText: formatMoneyDelta(remainingAmount),
      detailText,
      ariaValueText: `${Math.round(progressPercentage)} percent used, ${formatMoneyDelta(remainingAmount)}.`,
    }
  }

  if (spentAmount >= limit * BUDGET_NEAR_LIMIT_RATIO) {
    return {
      key: 'near_limit',
      label: 'Near limit',
      tone: 'warning',
      progressPercentage,
      remainingAmount,
      remainingText: formatMoneyDelta(remainingAmount),
      detailText,
      ariaValueText: `${Math.round(progressPercentage)} percent used, ${formatMoneyDelta(remainingAmount)}.`,
    }
  }

  return {
    key: 'on_track',
    label: 'On track',
    tone: 'positive',
    progressPercentage,
    remainingAmount,
    remainingText: formatMoneyDelta(remainingAmount),
    detailText,
    ariaValueText: `${Math.round(progressPercentage)} percent used, ${formatMoneyDelta(remainingAmount)}.`,
  }
}

export function buildBudgetPressureHighlight({
  categoryStatuses = [],
  fallbackSpendCards = [],
} = {}) {
  const budgetedStatuses = Array.isArray(categoryStatuses)
    ? categoryStatuses
      .filter((item) => getSafeMoneyNumber(item?.monthly_limit) != null)
      .map((item) => ({
        name: item?.category_name || 'Uncategorized',
        progress: getSafeMoneyNumber(item?.progress_percentage) ?? 0,
        health: buildCategoryBudgetHealth({
          monthlyLimit: item?.monthly_limit,
          spent: item?.spent,
          actualsAvailable: true,
        }),
      }))
    : []

  const overspentStatus = budgetedStatuses
    .filter((item) => item.health.key === 'over_budget' && item.health.remainingAmount != null)
    .sort((left, right) => left.health.remainingAmount - right.health.remainingAmount)[0]

  if (overspentStatus) {
    return {
      key: 'strongest_overspend',
      label: 'Strongest overspend',
      tone: 'danger',
      title: overspentStatus.name,
      detail: `${formatCurrency(Math.abs(overspentStatus.health.remainingAmount))} over budget right now.`,
    }
  }

  if (budgetedStatuses.length) {
    const highestPressure = [...budgetedStatuses]
      .sort((left, right) => (
        right.progress - left.progress
        || ((left.health.remainingAmount ?? Number.POSITIVE_INFINITY) - (right.health.remainingAmount ?? Number.POSITIVE_INFINITY))
      ))[0]

    return {
      key: 'highest_pressure',
      label: 'Top category pressure',
      tone: highestPressure.health.tone,
      title: highestPressure.name,
      detail: `${Math.round(highestPressure.progress)}% used with ${highestPressure.health.remainingText}.`,
    }
  }

  if (Array.isArray(fallbackSpendCards) && fallbackSpendCards.length) {
    return {
      key: 'top_spend_area',
      label: 'Top spend area',
      tone: 'neutral',
      title: fallbackSpendCards[0].name,
      detail: `${fallbackSpendCards[0].note} this month.`,
    }
  }

  return {
    key: 'waiting',
    label: 'Category pressure',
    tone: 'neutral',
    title: 'Waiting on categories',
    detail: 'Current-month category pressure will show once expenses land.',
  }
}

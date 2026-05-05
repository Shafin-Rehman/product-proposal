import { getCategoryPresentation } from './financeVisuals'
import {
  formatCurrency,
  shiftMonth,
} from './financeUtils'
import {
  buildBudgetPressureHighlight as buildSharedBudgetPressureHighlight,
  buildCategoryBudgetHealth,
  buildFinancialHealth,
  buildOverallBudgetHealth as buildSharedOverallBudgetHealth,
  getMonthProgressState as getSharedMonthProgressState,
} from './budgetHealth'

const DEFAULT_CATEGORY_PREVIEW_LIMIT = 5
const DEFAULT_RECENT_ACTIVITY_LIMIT = 6

function hasBudgetedCategoryStatuses(categoryStatuses) {
  return Array.isArray(categoryStatuses)
    && categoryStatuses.some((item) => Number(item?.monthly_limit ?? 0) > 0)
}

function getSafeMoneyNumber(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function getFirstName(email) {
  if (!email) return 'there'

  const [name] = email.split('@')
  const cleaned = name.replace(/[._-]+/g, ' ').trim()
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

export function hasOverallMonthlyLimit(summary) {
  return Number(summary?.monthly_limit ?? 0) > 0
}

export function hasCategoryBudgets(summary) {
  return hasBudgetedCategoryStatuses(summary?.category_statuses)
}

export function getBudgetCtaLabel(summary) {
  if (hasOverallMonthlyLimit(summary)) return 'Edit budget'
  if (hasCategoryBudgets(summary)) return 'Set overall limit'
  return 'Set budget'
}

export function getBudgetHintText(summary) {
  if (hasOverallMonthlyLimit(summary)) {
    return `Current limit: ${formatCurrency(summary?.monthly_limit)}. Changes take effect immediately.`
  }

  if (hasCategoryBudgets(summary)) {
    return 'Category budgets are already set. Add an overall monthly limit here to control the monthly cap and overall-budget alerts.'
  }

  return 'Set an overall monthly limit here to control the monthly cap and overall-budget alerts.'
}

export function getMonthProgressState(month, { observedDayCount = 0, referenceDate = new Date() } = {}) {
  return getSharedMonthProgressState(month, { observedDayCount, referenceDate })
}

export function getBudgetHudModel(summary, { month, observedDayCount = 0, referenceDate = new Date(), availability = summary ? 'ready' : 'loading' } = {}) {
  const overallHealth = buildSharedOverallBudgetHealth({
    summary,
    availability,
    month,
    observedDayCount,
    referenceDate,
  })
  const financialHealth = buildFinancialHealth({ summary, availability })
  const budget = overallHealth.totalBudget ?? 0
  const spent = overallHealth.spent ?? 0
  const income = getSafeMoneyNumber(summary?.total_income)
  const net = financialHealth.netAmount ?? (income != null && overallHealth.spent != null
    ? Number((income - overallHealth.spent).toFixed(2))
    : 0)
  const hasBudget = overallHealth.key !== 'no_budget' && overallHealth.key !== 'loading' && overallHealth.key !== 'unavailable'

  const metrics = overallHealth.key === 'loading' || overallHealth.key === 'unavailable'
    ? [
      { label: 'Spent', value: '--', hint: 'Current month' },
      {
        label: 'Days left',
        value: overallHealth.monthState.daysRemaining ? String(overallHealth.monthState.daysRemaining) : '--',
        hint: 'Including today',
      },
      { label: 'Daily allowance', value: '--', hint: 'Left per day' },
      { label: 'Net this month', value: '--', hint: 'Income minus spend' },
    ]
    : [
      {
        label: 'Spent',
        value: formatCurrency(spent),
        hint: hasBudget ? `${Math.round(overallHealth.progressPercentage)}% of budget used` : 'Current month',
      },
      {
        label: 'Days left',
        value: overallHealth.daysRemaining == null ? '--' : String(overallHealth.daysRemaining),
        hint: 'Including today',
      },
      {
        label: 'Daily allowance',
        value: overallHealth.dailyAllowance == null ? '--' : formatCurrency(overallHealth.dailyAllowance),
        hint: overallHealth.key === 'over_budget' ? 'Needs correction' : 'Left per day',
      },
      {
        label: 'Net this month',
        value: financialHealth.netAmount == null ? '--' : formatCurrency(financialHealth.netAmount),
        hint: financialHealth.key === 'negative_cash_flow'
          ? 'Expenses above income'
          : 'Income minus spend',
      },
    ]

  return {
    ...overallHealth,
    badge: overallHealth.label,
    value: overallHealth.primaryValue,
    progressWidth: `${overallHealth.progressPercentage}%`,
    budget,
    spent,
    income: income ?? 0,
    remaining: overallHealth.remaining,
    net,
    daysRemaining: overallHealth.daysRemaining,
    hasBudget,
    isOverBudget: overallHealth.key === 'over_budget',
    isNearLimit: overallHealth.key === 'near_limit',
    metrics,
  }
}

function buildLiveCategoryCards(categoryStatuses = []) {
  return categoryStatuses.map((item) => {
    const presentation = getCategoryPresentation({
      name: item.category_name,
      icon: item.category_icon,
      kind: 'expense',
    })
    const amount = Number(item.spent ?? 0)
    const categoryHealth = buildCategoryBudgetHealth({
      monthlyLimit: item.monthly_limit,
      spent: item.spent,
      actualsAvailable: true,
    })

    return {
      id: item.category_id ?? item.category_name ?? `${item.category_name}-${amount}`,
      name: presentation.label,
      symbol: presentation.symbol,
      color: presentation.color,
      soft: presentation.soft,
      progress: categoryHealth.progressPercentage,
      amount,
      monthlyLimit: Number(item.monthly_limit ?? 0) > 0 ? Number(item.monthly_limit) : null,
      remainingAmount: categoryHealth.remainingAmount,
      note: categoryHealth.remainingText,
      statusLabel: categoryHealth.label,
      statusTone: categoryHealth.tone,
    }
  })
}

export function buildDerivedCategoryCards(expenses = []) {
  const grouped = new Map()

  expenses.forEach((expense) => {
    const amount = Number(expense.amount ?? 0)
    const key = expense.category_id ?? expense.category_name ?? 'uncategorized'
    const displayName = expense.category_name
      && String(expense.category_name).trim() !== ''
      ? String(expense.category_name).trim()
      : ''
    const existing = grouped.get(key)
    const current = existing ?? {
      category_name: displayName,
      category_icon: expense.category_icon ?? null,
      total_amount: 0,
      count: 0,
    }
    if (!current.category_icon && expense.category_icon) {
      current.category_icon = expense.category_icon
    }

    current.total_amount += amount
    current.count += 1
    grouped.set(key, current)
  })

  const breakdown = Array.from(grouped.entries())
    .map(([key, item]) => ({
      category_id: key,
      category_name: item.category_name,
      category_icon: item.category_icon ?? null,
      total_amount: Number(item.total_amount.toFixed(2)),
      count: item.count,
    }))
    .sort((left, right) => right.total_amount - left.total_amount)

  const totalExpenses = breakdown.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)

  return breakdown.map((item) => {
    const presentation = getCategoryPresentation({
      name: item.category_name,
      icon: item.category_icon,
      kind: 'expense',
    })
    const amount = Number(item.total_amount ?? 0)
    const share = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0

    return {
      id: item.category_id ?? item.category_name ?? `${item.category_name}-${amount}`,
      name: presentation.label,
      symbol: presentation.symbol,
      color: presentation.color,
      soft: presentation.soft,
      progress: Math.min(share, 100),
      amount,
      monthlyLimit: null,
      remainingAmount: null,
      note: `${Math.round(share) || 0}% of spend`,
    }
  })
}

export function buildSampleCategoryCards(categoryBudgets = []) {
  return categoryBudgets.map((item) => {
    const presentation = getCategoryPresentation({ name: item.name, kind: 'expense' })
    const categoryHealth = buildCategoryBudgetHealth({
      monthlyLimit: item.budget,
      spent: item.spent,
      actualsAvailable: true,
    })
    return {
      id: item.id,
      name: presentation.label,
      symbol: presentation.symbol,
      color: presentation.color,
      soft: presentation.soft,
      progress: categoryHealth.progressPercentage,
      amount: item.spent,
      monthlyLimit: item.budget,
      remainingAmount: categoryHealth.remainingAmount,
      note: categoryHealth.remainingText,
      statusLabel: categoryHealth.label,
      statusTone: categoryHealth.tone,
    }
  })
}

export function getCategoryCards(categoryStatuses, expenses = [], derivedCategoryCards = null) {
  return hasBudgetedCategoryStatuses(categoryStatuses)
    ? buildLiveCategoryCards(categoryStatuses)
    : Array.isArray(derivedCategoryCards) ? derivedCategoryCards : buildDerivedCategoryCards(expenses)
}

export function getBudgetPressureHighlight(summary, expenses = [], derivedCategoryCards = null) {
  const spendShareCards = Array.isArray(derivedCategoryCards)
    ? derivedCategoryCards
    : buildDerivedCategoryCards(expenses)

  return buildSharedBudgetPressureHighlight({
    categoryStatuses: summary?.category_statuses,
    fallbackSpendCards: spendShareCards.map((card) => ({
      name: card.name,
      note: card.note,
      progress: card.progress,
      amount: card.amount,
    })),
  })
}

export function getTopSavingsGoal(savingsGoals) {
  return [...(savingsGoals?.goals ?? [])]
    .filter((goal) => !goal.archived)
    .sort((left, right) => {
      const leftComplete = left.budget_context?.status === 'complete'
      const rightComplete = right.budget_context?.status === 'complete'
      if (leftComplete !== rightComplete) return leftComplete ? 1 : -1
      const severity = { over_budget: 5, overdue: 5, tight: 4, no_budget: 3, ready: 2, complete: 1 }
      const severityDifference = (severity[right.budget_context?.status] ?? 0) - (severity[left.budget_context?.status] ?? 0)
      if (severityDifference) return severityDifference
      return String(left.target_date).localeCompare(String(right.target_date))
    })[0] ?? null
}

export function buildDemoRecentCashFlow(summary) {
  const monthlyIncome = getSafeMoneyNumber(summary?.total_income)
  const monthlyExpenses = getSafeMoneyNumber(summary?.total_expenses)
  return [
    { month: '2026-01-01', label: 'Jan', incomeAmount: monthlyIncome * 0.95, expenseAmount: monthlyExpenses * 0.88, netAmount: Number((monthlyIncome * 0.95 - monthlyExpenses * 0.88).toFixed(2)) },
    { month: '2026-02-01', label: 'Feb', incomeAmount: monthlyIncome * 1.02, expenseAmount: monthlyExpenses * 1.05, netAmount: Number((monthlyIncome * 1.02 - monthlyExpenses * 1.05).toFixed(2)) },
    { month: '2026-03-01', label: 'Mar', incomeAmount: monthlyIncome, expenseAmount: monthlyExpenses, netAmount: Number((monthlyIncome - monthlyExpenses).toFixed(2)) },
  ]
}

export function getPreviewCategories(categoryCards = [], limit = DEFAULT_CATEGORY_PREVIEW_LIMIT) {
  return [...categoryCards]
    .sort((left, right) => {
      const leftBudgeted = left.monthlyLimit != null && Number(left.monthlyLimit) > 0
      const rightBudgeted = right.monthlyLimit != null && Number(right.monthlyLimit) > 0
      if (leftBudgeted && rightBudgeted) {
        return (Number(right.progress) || 0) - (Number(left.progress) || 0)
      }
      if (leftBudgeted !== rightBudgeted) return leftBudgeted ? -1 : 1
      return (Number(right.amount) || 0) - (Number(left.amount) || 0)
    })
    .slice(0, limit)
}

export function mergeRowsById(...groups) {
  const merged = new Map()

  groups.flat().forEach((row, index) => {
    if (!row) return
    const key = row.id == null ? `fallback-${index}` : String(row.id)
    merged.set(key, row)
  })

  return Array.from(merged.values())
}

export function sortRowsByDateDesc(rows = []) {
  return [...rows]
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.row?.date ?? left.row?.created_at ?? '')
      const rightTime = Date.parse(right.row?.date ?? right.row?.created_at ?? '')
      const leftSortable = Number.isNaN(leftTime) ? Number.NEGATIVE_INFINITY : leftTime
      const rightSortable = Number.isNaN(rightTime) ? Number.NEGATIVE_INFINITY : rightTime
      const dateDifference = rightSortable - leftSortable
      return dateDifference || left.index - right.index
    })
    .map(({ row }) => row)
}

function getMonthEndDate(month) {
  const nextMonth = shiftMonth(month, 1)
  if (!nextMonth) return null

  const [year, monthNumber] = nextMonth.split('-').map(Number)
  const endDate = new Date(Date.UTC(year, monthNumber - 1, 0, 12))

  return [
    endDate.getUTCFullYear(),
    String(endDate.getUTCMonth() + 1).padStart(2, '0'),
    String(endDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function buildDashboardLivePaths(month, { activityLimit = DEFAULT_RECENT_ACTIVITY_LIMIT } = {}) {
  const cashFlowStart = shiftMonth(month, -2) || month
  const cashFlowEnd = getMonthEndDate(month) || month
  const encodedMonth = encodeURIComponent(month)
  const encodedCashFlowStart = encodeURIComponent(cashFlowStart)
  const encodedCashFlowEnd = encodeURIComponent(cashFlowEnd)

  return {
    summary: `/api/budget/summary?month=${encodedMonth}`,
    cashFlowExpenses: `/api/expenses?from=${encodedCashFlowStart}&to=${encodedCashFlowEnd}`,
    recentExpenses: `/api/expenses?limit=${activityLimit}`,
    cashFlowIncome: `/api/income?from=${encodedCashFlowStart}&to=${encodedCashFlowEnd}`,
    recentIncome: `/api/income?limit=${activityLimit}`,
    savingsGoals: `/api/savings-goals?month=${encodedMonth}`,
  }
}

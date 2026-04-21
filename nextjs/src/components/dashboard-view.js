'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode, useDataChanged } from '@/components/providers'
import { ApiError, apiGet, apiPost } from '@/lib/apiClient'
import {
  DEMO_MONTH,
  demoActivity,
  demoBudgetSummary,
  demoBudgetTrend,
  demoCategoryBudgets,
} from '@/lib/demoData'
import { getCategoryVisual, getEntryVisual, getInitialsLabel } from '@/lib/financeVisuals'
import {
  buildActivityFeed,
  buildMonthlySpendTrend,
  formatCurrency,
  formatMonthPeriod,
  formatShortDate,
  getCurrentMonthStart,
  isInMonth,
} from '@/lib/financeUtils'
const PREVIEW_LIMIT = 4
const INCOME_LIMIT = 4
const CHART_WIDTH = 312
const CHART_HEIGHT = 148
const CHART_INSET = 18

function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong while loading the live snapshot.'
}

function getFirstName(email) {
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

function hasBudgetedCategoryStatuses(categoryStatuses) {
  return Array.isArray(categoryStatuses)
    && categoryStatuses.some((item) => Number(item?.monthly_limit ?? 0) > 0)
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

const BUDGET_NEAR_LIMIT_RATIO = 0.8

function getSafeMoneyNumber(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

export function getMonthProgressState(month, { observedDayCount = 0, referenceDate = new Date() } = {}) {
  const monthDate = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(monthDate.getTime())) {
    return {
      monthLength: 0,
      activeDay: 0,
      daysRemaining: 0,
      isCurrentMonth: false,
    }
  }

  const monthLength = new Date(Date.UTC(
    monthDate.getUTCFullYear(),
    monthDate.getUTCMonth() + 1,
    0
  )).getUTCDate()
  const currentDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  const isCurrentMonth = (
    monthDate.getUTCFullYear() === currentDate.getUTCFullYear()
    && monthDate.getUTCMonth() === currentDate.getUTCMonth()
  )
  const fallbackObservedDays = Number.isFinite(observedDayCount)
    ? Math.max(0, Math.floor(observedDayCount))
    : 0
  const activeDay = isCurrentMonth
    ? Math.min(Math.max(currentDate.getUTCDate(), 1), monthLength)
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

export function getBudgetHudModel(summary, { month, observedDayCount = 0, referenceDate = new Date() } = {}) {
  const budget = getSafeMoneyNumber(summary?.total_budget ?? summary?.monthly_limit)
  const spent = getSafeMoneyNumber(summary?.total_expenses)
  const income = getSafeMoneyNumber(summary?.total_income)
  const remaining = summary?.remaining_budget == null
    ? (budget > 0 ? Number((budget - spent).toFixed(2)) : 0)
    : getSafeMoneyNumber(summary.remaining_budget)
  const progressRaw = budget > 0 ? (spent / budget) * 100 : 0
  const progressPercentage = budget > 0 ? Math.min(Number(progressRaw.toFixed(2)), 100) : 0
  const monthState = getMonthProgressState(month || summary?.month, { observedDayCount, referenceDate })
  const hasBudget = budget > 0
  const isOverBudget = hasBudget && (remaining < 0 || summary?.threshold_exceeded)
  const isNearLimit = hasBudget && !isOverBudget && progressRaw >= BUDGET_NEAR_LIMIT_RATIO * 100
  const dailyAllowance = hasBudget && monthState.daysRemaining > 0
    ? Number((remaining / monthState.daysRemaining).toFixed(2))
    : null
  const net = Number((income - spent).toFixed(2))

  if (!summary) {
    return {
      tone: 'neutral',
      badge: 'Waiting',
      value: 'Waiting on live totals',
      supportingText: 'Budget snapshot',
      progressLabel: 'Live summary is loading.',
      progressNote: 'Budget guidance will appear as soon as the month snapshot loads.',
      progressWidth: '0%',
      progressPercentage: 0,
      spent,
      budget,
      income,
      remaining,
      net,
      monthState,
      daysRemaining: null,
      dailyAllowance: null,
      isOverBudget: false,
      isNearLimit: false,
      hasBudget: false,
      metrics: [
        { label: 'Spent', value: '--', hint: 'Current month' },
        { label: 'Income', value: '--', hint: 'Current month' },
        { label: 'Net this month', value: '--', hint: 'Income minus spend' },
      ],
    }
  }

  if (!hasBudget) {
    return {
      tone: 'neutral',
      badge: 'No budget',
      value: `${formatCurrency(spent)} spent`,
      supportingText: `${formatCurrency(income)} in income tracked so far.`,
      progressLabel: 'No monthly budget set yet.',
      progressNote: 'Set a budget to unlock left-to-spend guidance, days left, and daily allowance.',
      progressWidth: '0%',
      progressPercentage: 0,
      spent,
      budget,
      income,
      remaining,
      net,
      monthState,
      daysRemaining: null,
      dailyAllowance: null,
      isOverBudget: false,
      isNearLimit: false,
      hasBudget: false,
      metrics: [
        { label: 'Spent', value: formatCurrency(spent), hint: 'Current month' },
        { label: 'Income', value: formatCurrency(income), hint: 'Current month' },
        {
          label: 'Net this month',
          value: formatCurrency(net),
          hint: net < 0 ? 'Expenses above income' : 'Income minus spend',
        },
      ],
    }
  }

  const baseState = {
    progressWidth: `${progressPercentage}%`,
    progressPercentage,
    spent,
    budget,
    income,
    remaining,
    net,
    monthState,
    daysRemaining: monthState.daysRemaining,
    dailyAllowance,
    isOverBudget,
    isNearLimit,
    hasBudget: true,
    metrics: [
      {
        label: 'Spent',
        value: formatCurrency(spent),
        hint: `${Math.round(progressRaw)}% of budget used`,
      },
      {
        label: 'Days left',
        value: String(monthState.daysRemaining),
        hint: 'Including today',
      },
      {
        label: 'Daily allowance',
        value: dailyAllowance == null ? '--' : formatCurrency(dailyAllowance),
        hint: isOverBudget ? 'Needs correction' : 'Left per day',
      },
      {
        label: 'Net this month',
        value: formatCurrency(net),
        hint: net < 0 ? 'Expenses above income' : 'Income minus spend',
      },
    ],
  }

  if (isOverBudget) {
    return {
      tone: 'warning',
      badge: 'Over budget',
      value: `${formatCurrency(Math.abs(remaining))} over`,
      supportingText: `Spent ${formatCurrency(spent)} of ${formatCurrency(budget)} budgeted.`,
      progressLabel: `${formatCurrency(spent)} spent against ${formatCurrency(budget)} budgeted`,
      progressNote: 'This month has moved past the budget cap and needs correction at a glance.',
      ...baseState,
    }
  }

  if (isNearLimit) {
    return {
      tone: 'warning',
      badge: 'Near limit',
      value: `${formatCurrency(remaining)} left`,
      supportingText: `Spent ${formatCurrency(spent)} of ${formatCurrency(budget)} budgeted.`,
      progressLabel: `${formatCurrency(spent)} spent against ${formatCurrency(budget)} budgeted`,
      progressNote: 'Budget pressure is rising, so the HUD shifts to a stronger warning state.',
      ...baseState,
    }
  }

  return {
    tone: 'positive',
    badge: 'On track',
    value: `${formatCurrency(remaining)} left`,
    supportingText: `Spent ${formatCurrency(spent)} of ${formatCurrency(budget)} budgeted.`,
    progressLabel: `${formatCurrency(spent)} spent against ${formatCurrency(budget)} budgeted`,
    progressNote: 'Budget pace is still healthy for the month so far.',
    ...baseState,
  }
}

function getMonthShape(month) {
  const monthDate = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(monthDate.getTime())) return null

  const year = monthDate.getUTCFullYear()
  const monthIndex = monthDate.getUTCMonth()
  return {
    monthLength: new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(),
  }
}

function buildProjectedTrend(month, budget, pointCount) {
  const monthShape = getMonthShape(month)
  if (!monthShape || !budget || pointCount < 1) return []

  return Array.from({ length: pointCount }, (_, index) => Number((
    budget * ((index + 1) / monthShape.monthLength)
  ).toFixed(2)))
}

function getTrendCeiling(points, projectedPoints = [], budget = 0) {
  const referencePoints = [...points, ...projectedPoints].filter((point) => Number.isFinite(point))
  if (!referencePoints.length) return 1

  const maxPoint = Math.max(...referencePoints)
  if (budget > 0) {
    return Math.max(maxPoint * 1.14, maxPoint + 120)
  }

  return Math.max(maxPoint * 1.18, maxPoint + 120)
}

function buildTrendPath(points, width, height, inset, maxValue) {
  if (!points.length) return ''

  const safeMax = maxValue > 0 ? maxValue : 1

  return points
    .map((point, index) => {
      const x = inset + ((width - inset * 2) / Math.max(points.length - 1, 1)) * index
      const y = height - inset - ((height - inset * 2) * point) / safeMax
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function buildAreaPath(points, width, height, inset, maxValue) {
  if (!points.length) return ''

  const linePath = buildTrendPath(points, width, height, inset, maxValue)
  const baseline = height - inset
  return `${linePath} L ${width - inset} ${baseline} L ${inset} ${baseline} Z`
}

function buildComparisonAreaPath(topPoints, bottomPoints, width, height, inset, maxValue) {
  if (!topPoints.length || topPoints.length !== bottomPoints.length) return ''

  const safeMax = maxValue > 0 ? maxValue : 1
  const buildPoint = (point, index) => {
    const x = inset + ((width - inset * 2) / Math.max(topPoints.length - 1, 1)) * index
    const y = height - inset - ((height - inset * 2) * point) / safeMax
    return `${x.toFixed(2)} ${y.toFixed(2)}`
  }

  const topPath = topPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${buildPoint(point, index)}`).join(' ')
  const bottomPath = bottomPoints
    .map((point, index) => ({ point, index }))
    .reverse()
    .map(({ point, index }) => `L ${buildPoint(point, index)}`)
    .join(' ')

  return `${topPath} ${bottomPath} Z`
}

function getTrendPoint(points, width, height, inset, maxValue, index = points.length - 1) {
  if (!points.length || index < 0 || index >= points.length) return null

  const safeMax = maxValue > 0 ? maxValue : 1
  return {
    x: inset + ((width - inset * 2) / Math.max(points.length - 1, 1)) * index,
    y: height - inset - ((height - inset * 2) * points[index]) / safeMax,
  }
}

function buildLiveCategoryCards(categoryStatuses = []) {
  return categoryStatuses.map((item) => {
    const displayName = item.category_name || 'Uncategorized'
    const visual = getCategoryVisual(displayName)
    const amount = Number(item.spent ?? 0)
    const remainingBudget = item.remaining_budget == null ? null : Number(item.remaining_budget)
    const progress = item.monthly_limit == null ? 0 : Math.min(Number(item.progress_percentage ?? 0), 100)

    return {
      id: item.category_id ?? item.category_name ?? `${item.category_name}-${amount}`,
      name: displayName,
      symbol: item.category_icon || visual.symbol,
      color: visual.color,
      soft: visual.soft,
      progress,
      amount,
      note: item.monthly_limit == null
        ? 'No budget set'
        : `${formatCurrency(Math.abs(remainingBudget ?? 0))} ${remainingBudget != null && remainingBudget < 0 ? 'over' : 'left'}`,
    }
  })
}

export function buildDerivedCategoryCards(expenses = []) {
  const grouped = new Map()

  expenses.forEach((expense) => {
    const amount = Number(expense.amount ?? 0)
    const key = expense.category_id ?? expense.category_name ?? 'uncategorized'
    const displayName = expense.category_name || 'Uncategorized'
    const current = grouped.get(key) ?? {
      category_name: displayName,
      total_amount: 0,
      count: 0,
    }

    current.total_amount += amount
    current.count += 1
    grouped.set(key, current)
  })

  const breakdown = Array.from(grouped.entries())
    .map(([key, item]) => ({
      category_id: key,
      category_name: item.category_name,
      total_amount: Number(item.total_amount.toFixed(2)),
      count: item.count,
    }))
    .sort((left, right) => right.total_amount - left.total_amount)

  const totalExpenses = breakdown.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)

  return breakdown.map((item) => {
    const visual = getCategoryVisual(item.category_name || 'Uncategorized')
    const amount = Number(item.total_amount ?? 0)
    const share = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0

    return {
      id: item.category_id ?? item.category_name ?? `${item.category_name}-${amount}`,
      name: item.category_name || 'Uncategorized',
      symbol: visual.symbol,
      color: visual.color,
      soft: visual.soft,
      progress: Math.min(share, 100),
      amount,
      note: `${Math.round(share) || 0}% of spend`,
    }
  })
}

export function getCategoryCards(categoryStatuses, expenses = []) {
  return hasBudgetedCategoryStatuses(categoryStatuses)
    ? buildLiveCategoryCards(categoryStatuses)
    : buildDerivedCategoryCards(expenses)
}

export function getBudgetPressureHighlight(summary, expenses = []) {
  const budgetedStatuses = Array.isArray(summary?.category_statuses)
    ? summary.category_statuses
      .filter((item) => Number(item?.monthly_limit ?? 0) > 0)
      .map((item) => ({
        name: item.category_name || 'Uncategorized',
        spent: getSafeMoneyNumber(item.spent),
        progress: getSafeMoneyNumber(item.progress_percentage),
        remaining: item.remaining_budget == null ? null : getSafeMoneyNumber(item.remaining_budget),
      }))
    : []

  if (budgetedStatuses.length) {
    const strongestOverspend = [...budgetedStatuses]
      .filter((item) => item.remaining != null && item.remaining < 0)
      .sort((left, right) => left.remaining - right.remaining)[0]

    if (strongestOverspend) {
      return {
        tone: 'warning',
        label: 'Strongest overspend',
        title: strongestOverspend.name,
        detail: `${formatCurrency(Math.abs(strongestOverspend.remaining))} over budget right now.`,
      }
    }

    const highestPressure = [...budgetedStatuses]
      .sort((left, right) => (
        right.progress - left.progress
        || ((left.remaining ?? Number.POSITIVE_INFINITY) - (right.remaining ?? Number.POSITIVE_INFINITY))
      ))[0]

    return {
      tone: highestPressure.progress >= BUDGET_NEAR_LIMIT_RATIO * 100 ? 'warning' : 'positive',
      label: 'Top category pressure',
      title: highestPressure.name,
      detail: highestPressure.remaining == null
        ? `${Math.round(highestPressure.progress)}% of budget used.`
        : `${Math.round(highestPressure.progress)}% used with ${formatCurrency(Math.abs(highestPressure.remaining))} left.`,
    }
  }

  const spendShareCards = buildDerivedCategoryCards(expenses)
  if (spendShareCards.length) {
    return {
      tone: 'neutral',
      label: 'Top spend area',
      title: spendShareCards[0].name,
      detail: `${spendShareCards[0].note} this month.`,
    }
  }

  return {
    tone: 'neutral',
    label: 'Category pressure',
    title: 'Waiting on categories',
    detail: 'Current-month category pressure will show once expenses land.',
  }
}

function LiveNotice({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="inline-status" role="status">
      <div>
        <strong>Live data is limited right now</strong>
        <span>{message}</span>
      </div>
      <button className="button-secondary page-retry" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  )
}

export default function DashboardView() {
  const router = useRouter()
  const { isReady, logout, session } = useAuth()
  const { isSampleMode } = useDataMode()
  const { dataChangedToken } = useDataChanged()
  const [currentMonth] = useState(getCurrentMonthStart)
  const [reloadToken, setReloadToken] = useState(0)
  const [liveState, setLiveState] = useState({
    status: 'loading',
    message: '',
    summary: null,
    expenses: [],
    income: [],
  })
  const [isBudgetSheetOpen, setIsBudgetSheetOpen] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState({ monthly_limit: '' })
  const [isBudgetSaving, setIsBudgetSaving] = useState(false)
  const [budgetSaveError, setBudgetSaveError] = useState('')

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return

    const controller = new AbortController()

    async function loadLiveDashboard() {
      setLiveState((current) => ({
        ...current,
        status: 'loading',
        message: '',
      }))

      const results = await Promise.allSettled([
        apiGet(`/api/budget/summary?month=${encodeURIComponent(currentMonth)}`, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet('/api/expenses', {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet('/api/income', {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
      ])

      if (controller.signal.aborted) return

      const authFailure = results.find(
        (result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401
      )

      if (authFailure) {
        logout()
        router.replace('/login')
        return
      }

      const summaryResult = results[0]
      const expensesResult = results[1]
      const incomeResult = results[2]
      const failedCount = results.filter((result) => result.status === 'rejected').length

      setLiveState({
        status: failedCount ? (failedCount === results.length ? 'error' : 'partial') : 'ready',
        message: failedCount
          ? failedCount === results.length
            ? 'We could not reach the live dashboard endpoints just now.'
            : 'Some live sections are missing for the moment, but the rest of the month is still visible.'
          : '',
        summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
        expenses: expensesResult.status === 'fulfilled' ? expensesResult.value : [],
        income: incomeResult.status === 'fulfilled' ? incomeResult.value : [],
      })
    }

    loadLiveDashboard().catch((error) => {
      if (controller.signal.aborted) return

      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }

      setLiveState({
        status: 'error',
        message: getErrorMessage(error),
        summary: null,
        expenses: [],
        income: [],
      })
    })

    return () => controller.abort()
  }, [currentMonth, dataChangedToken, isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  const openBudgetSheet = () => {
    const currentLimit = isSampleMode
      ? demoBudgetSummary?.monthly_limit
      : liveState.summary?.monthly_limit
    setBudgetDraft({ monthly_limit: currentLimit ? String(currentLimit) : '' })
    setBudgetSaveError('')
    setIsBudgetSheetOpen(true)
  }

  const closeBudgetSheet = () => {
    setIsBudgetSheetOpen(false)
    setBudgetSaveError('')
  }

  const handleSaveBudget = async () => {
    if (isBudgetSaving) return
    setIsBudgetSaving(true)
    setBudgetSaveError('')
    try {
      await apiPost(
        '/api/budget',
        { month: currentMonth, monthly_limit: Number(budgetDraft.monthly_limit) },
        { accessToken: session.accessToken }
      )
      closeBudgetSheet()
      setReloadToken((value) => value + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }
      setBudgetSaveError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setIsBudgetSaving(false)
    }
  }

  if (!isReady || !session?.accessToken) {
    return null
  }

  const summary = isSampleMode ? demoBudgetSummary : liveState.summary
  const currentMonthExpenses = isSampleMode
    ? []
    : liveState.expenses.filter((expense) => isInMonth(expense.date || expense.created_at, currentMonth))
  const activity = isSampleMode
    ? demoActivity
    : buildActivityFeed(liveState.expenses, liveState.income)
  const recentActivity = activity.slice(0, PREVIEW_LIMIT)
  const recentIncome = activity.filter((entry) => entry.kind === 'income').slice(0, INCOME_LIMIT)
  const chartMonth = isSampleMode ? DEMO_MONTH : summary?.month || currentMonth
  const categoryCards = isSampleMode
    ? demoCategoryBudgets.map((item) => {
      const visual = getCategoryVisual(item.name)
      const remaining = item.budget - item.spent
      return {
        id: item.id,
        name: visual.label,
        symbol: visual.symbol,
        color: visual.color,
        soft: visual.soft,
        progress: Math.min((item.spent / item.budget) * 100, 100),
        amount: item.spent,
        note: `${formatCurrency(Math.abs(remaining))} ${remaining < 0 ? 'over' : 'left'}`,
      }
    })
    : getCategoryCards(summary?.category_statuses, currentMonthExpenses)
  const budgetCtaLabel = getBudgetCtaLabel(summary)
  const trendPoints = isSampleMode
    ? demoBudgetTrend
    : buildMonthlySpendTrend(liveState.expenses, currentMonth)
  const hudState = getBudgetHudModel(summary, {
    month: chartMonth,
    observedDayCount: trendPoints.length,
  })
  const pressureHighlight = getBudgetPressureHighlight(summary, currentMonthExpenses)
  const projectedTrendPoints = buildProjectedTrend(chartMonth, hudState.budget, trendPoints.length)
  const chartCeiling = getTrendCeiling(trendPoints, projectedTrendPoints, hudState.budget)
  const linePath = buildTrendPath(trendPoints, CHART_WIDTH, CHART_HEIGHT, CHART_INSET, chartCeiling)
  const projectedPath = buildTrendPath(projectedTrendPoints, CHART_WIDTH, CHART_HEIGHT, CHART_INSET, chartCeiling)
  const areaPath = buildAreaPath(trendPoints, CHART_WIDTH, CHART_HEIGHT, CHART_INSET, chartCeiling)
  const overrunTrendPoints = trendPoints.map((point, index) => Math.max(point, projectedTrendPoints[index] ?? point))
  const hasPaceOverrun = projectedTrendPoints.some((point, index) => trendPoints[index] > point)
  const overrunPath = hasPaceOverrun
    ? buildComparisonAreaPath(overrunTrendPoints, projectedTrendPoints, CHART_WIDTH, CHART_HEIGHT, CHART_INSET, chartCeiling)
    : ''
  const overrunAmount = projectedTrendPoints.length
    ? Math.max((trendPoints.at(-1) ?? 0) - (projectedTrendPoints.at(-1) ?? 0), 0)
    : 0
  const currentPoint = getTrendPoint(trendPoints, CHART_WIDTH, CHART_HEIGHT, CHART_INSET, chartCeiling)
  const currentPointLeft = currentPoint ? `${(currentPoint.x / CHART_WIDTH) * 100}%` : '50%'
  const currentPointTop = currentPoint ? `${(currentPoint.y / CHART_HEIGHT) * 100}%` : '50%'
  const firstName = getFirstName(session?.user?.email)

  return (
    <>
    <section className="app-screen dashboard-screen">
      <div className="screen-topline">
        <div className="screen-persona">
          <div className="screen-persona__avatar">{getInitialsLabel(firstName, 'BB')}</div>
          <div>
            <span className="screen-persona__eyebrow">Good morning</span>
            <h1 className="screen-persona__title">{firstName}</h1>
          </div>
        </div>
        <span className={`screen-chip screen-chip--${isSampleMode ? 'sample' : 'live'}`}>
          {isSampleMode ? 'Sample' : 'Live'}
        </span>
      </div>

      <LiveNotice
        message={liveState.message}
        onRetry={() => setReloadToken((value) => value + 1)}
      />

      <article
        className={`budget-hero budget-hero--${hudState.tone}${hudState.isOverBudget ? ' budget-hero--over' : ''}${hudState.isNearLimit ? ' budget-hero--risk' : ''}`}
      >
        <div className="budget-hero__topline">
          <span className="budget-hero__eyebrow">{formatMonthPeriod(chartMonth)} budget HUD</span>
          <div className="budget-hero__actions">
            <span className={`budget-hero__badge budget-hero__badge--${hudState.tone}`}>{hudState.badge}</span>
            {!isSampleMode && (
              <button className="button-secondary page-retry" onClick={openBudgetSheet} type="button">
                {budgetCtaLabel}
              </button>
            )}
          </div>
        </div>

        <div className="budget-hero__header">
          <div className="budget-hero__headline">
            <h2 className="budget-hero__value">{hudState.value}</h2>
            <p className="budget-hero__suffix">{hudState.supportingText}</p>
          </div>
        </div>

        <div className="budget-hero__progress-block">
          <div
            aria-label="Monthly budget progress"
            className="budget-progress budget-hero__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hudState.progressPercentage)}
            aria-valuetext={hudState.progressLabel}
          >
            <span
              className={`budget-progress__fill budget-progress__fill--${hudState.tone}`}
              style={{ width: hudState.progressWidth }}
            />
          </div>
          <div className="budget-hero__progress-copy">
            <strong>{hudState.progressLabel}</strong>
            <span>{hudState.progressNote}</span>
          </div>
        </div>

        <div className="budget-hero__metrics">
          {hudState.metrics.map((metric) => (
            <div className="budget-hero__metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.hint}</small>
            </div>
          ))}
        </div>

        <div className={`budget-hero__pressure budget-hero__pressure--${pressureHighlight.tone}`}>
          <div>
            <span className="budget-hero__pressure-label">{pressureHighlight.label}</span>
            <strong>{pressureHighlight.title}</strong>
          </div>
          <p>{pressureHighlight.detail}</p>
        </div>

        {trendPoints.length ? (
          <div className="budget-hero__chart">
            <svg aria-hidden="true" className="trend-chart" viewBox="0 0 312 148">
              <defs>
                <linearGradient id="budgetHeroFill" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(122, 181, 146, 0.26)" />
                  <stop offset="100%" stopColor="rgba(122, 181, 146, 0.02)" />
                </linearGradient>
                <linearGradient id="budgetHeroOverrun" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(201, 130, 90, 0.28)" />
                  <stop offset="100%" stopColor="rgba(201, 130, 90, 0.05)" />
                </linearGradient>
              </defs>
              {projectedPath ? <path className="trend-chart__guide" d={projectedPath} fill="none" pathLength="1" /> : null}
              <path className="trend-chart__fill" d={areaPath} fill="url(#budgetHeroFill)" />
              {overrunPath ? <path className="trend-chart__overrun" d={overrunPath} fill="url(#budgetHeroOverrun)" /> : null}
              <path className="trend-chart__line" d={linePath} fill="none" pathLength="1" />
              {currentPoint ? (
                <circle
                  className={`trend-chart__point${overrunAmount > 0 ? ' trend-chart__point--warning' : ''}`}
                  cx={currentPoint.x}
                  cy={currentPoint.y}
                  r="4.5"
                />
              ) : null}
            </svg>
            {currentPoint && trendPoints.length ? (
              <div
                className="budget-hero__callout"
                style={{
                  left: currentPointLeft,
                  top: currentPointTop,
                }}
              >
                {formatCurrency(trendPoints.at(-1) ?? 0)} spent
              </div>
            ) : null}
          </div>
        ) : (
          <div className="blank-state blank-state--compact">
            <strong>Waiting on activity</strong>
            <span>This curve will appear once month-to-date spending lands.</span>
          </div>
        )}
      </article>

      <section className="section-block">
        <div className="section-headline">
          <h2>Budgets</h2>
          <Link className="section-link" href="/planner">
            View more
          </Link>
        </div>

        {categoryCards.length ? (
          <div className="budget-glance-scroll">
            <div className="budget-glance">
              {categoryCards.map((item) => (
                <div
                  className="budget-glance__item"
                  key={item.id}
                  style={{
                    '--entry-color': item.color,
                    '--entry-soft': item.soft,
                  }}
                >
                  <div
                    className="budget-glance__ring"
                    style={{
                      background: `conic-gradient(var(--entry-color) 0 ${item.progress}%, rgba(122, 136, 127, 0.12) ${item.progress}% 100%)`,
                    }}
                  >
                    <div className="budget-glance__inner">{item.symbol}</div>
                  </div>
                  <strong>{item.name}</strong>
                  <span>{formatCurrency(item.amount)}</span>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="blank-state blank-state--compact">
            <strong>No categories yet</strong>
            <span>Category snapshots appear as soon as current-month spending is grouped.</span>
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <section className="section-block dashboard-panel dashboard-panel--activity">
          <div className="section-headline">
            <h2>Recent activity</h2>
            <Link className="section-link" href="/transactions">
              View more
            </Link>
          </div>

          {recentActivity.length ? (
            <div className="activity-feed">
              {recentActivity.map((entry) => {
                const visual = getEntryVisual(entry)

                return (
                  <div
                    className="activity-feed__row"
                    key={entry.id}
                    style={{
                      '--entry-color': visual.color,
                      '--entry-soft': visual.soft,
                    }}
                  >
                    <div className="entry-avatar">
                      <span>{visual.symbol}</span>
                    </div>

                    <div className="entry-main">
                      <strong>{entry.merchant || entry.title}</strong>
                      <div className="entry-meta">
                        <span className="entry-chip">{entry.chip}</span>
                        <span>{formatShortDate(entry.occurredOn)}</span>
                      </div>
                    </div>

                    <div className={`entry-amount entry-amount--${entry.kind}`}>
                      {entry.kind === 'income' ? '+' : '-'}
                      {formatCurrency(entry.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="blank-state blank-state--compact">
              <strong>No activity yet</strong>
              <span>New transactions will land here once the month starts moving.</span>
            </div>
          )}
        </section>

        <section className="section-block dashboard-panel dashboard-panel--income">
          <div className="section-headline">
            <h2>Recent income</h2>
            <Link className="section-link" href="/transactions">
              View all
            </Link>
          </div>

          {recentIncome.length ? (
            <div className="activity-feed">
              {recentIncome.map((entry) => {
                const visual = getEntryVisual(entry)
                return (
                  <div
                    className="activity-feed__row"
                    key={entry.id}
                    style={{
                      '--entry-color': visual.color,
                      '--entry-soft': visual.soft,
                    }}
                  >
                    <div className="entry-avatar">
                      <span>{visual.symbol}</span>
                    </div>
                    <div className="entry-main">
                      <strong>{entry.title}</strong>
                      <div className="entry-meta">
                        <span className="entry-chip">{entry.chip}</span>
                        <span>{formatShortDate(entry.occurredOn)}</span>
                      </div>
                    </div>
                    <div className="entry-amount entry-amount--income">
                      +{formatCurrency(entry.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="blank-state blank-state--compact">
              <strong>No income yet</strong>
              <span>Income entries will show up here as they land.</span>
            </div>
          )}
        </section>
      </div>
    </section>

      {isBudgetSheetOpen ? (
        <div className="detail-overlay" role="presentation">
          <button
            aria-label="Close budget settings"
            className="detail-overlay__backdrop"
            onClick={closeBudgetSheet}
            type="button"
          />
          <div aria-labelledby="budget-sheet-title" aria-modal="true" className="detail-sheet entry-sheet" role="dialog">
            <div className="detail-sheet__handle" />

            <div
              className="detail-sheet__hero entry-sheet__hero"
              style={{ '--entry-color': 'var(--accent-strong)', '--entry-soft': 'var(--accent-soft)' }}
            >
              <div className="entry-avatar entry-avatar--large">
                <span>◎</span>
              </div>
              <div className="detail-sheet__copy">
                <span className="entry-chip">{formatMonthPeriod(currentMonth)}</span>
                <h2 className="detail-sheet__title" id="budget-sheet-title">
                  {budgetCtaLabel}
                </h2>
                <p className="detail-sheet__subtitle">
                  Monthly spending limit for {formatMonthPeriod(currentMonth)}
                </p>
              </div>
              <button className="button-secondary page-retry" onClick={closeBudgetSheet} type="button">
                Close
              </button>
            </div>

            <div className="entry-sheet__amount">
              <span className="entry-amount entry-amount--expense">
                {budgetDraft.monthly_limit ? formatCurrency(Number(budgetDraft.monthly_limit)) : '$0.00'}
              </span>
              <small>Monthly limit</small>
            </div>

            <form
              className="entry-sheet__form"
              onSubmit={(event) => { event.preventDefault(); handleSaveBudget() }}
            >
              <label className="entry-sheet__field">
                <span>Monthly limit ($)</span>
                <input
                  className="input-field"
                  inputMode="decimal"
                  min="1"
                  onChange={(event) => setBudgetDraft({ monthly_limit: event.target.value })}
                  placeholder="e.g. 2000"
                  type="number"
                  value={budgetDraft.monthly_limit}
                />
              </label>

              <div className="entry-sheet__footer">
                {budgetSaveError ? (
                  <div className="inline-error" role="alert">{budgetSaveError}</div>
                ) : (
                  <span className="entry-sheet__hint">
                    {getBudgetHintText(summary)}
                  </span>
                )}
                <div className="entry-sheet__actions">
                  <button
                    className="button-secondary"
                    disabled={isBudgetSaving}
                    onClick={closeBudgetSheet}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="button-primary"
                    disabled={isBudgetSaving || !budgetDraft.monthly_limit || Number(budgetDraft.monthly_limit) <= 0}
                    type="submit"
                  >
                    {isBudgetSaving ? 'Saving...' : hasOverallMonthlyLimit(summary) ? 'Update budget' : hasCategoryBudgets(summary) ? 'Set overall limit' : 'Set budget'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

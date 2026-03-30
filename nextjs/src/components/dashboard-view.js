'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode } from '@/components/providers'
import { ApiError, apiGet } from '@/lib/apiClient'
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
} from '@/lib/financeUtils'

const PREVIEW_LIMIT = 4
const INCOME_LIMIT = 2
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

function getHeroState(summary) {
  const budget = Number(summary?.monthly_limit ?? 0)
  const spent = Number(summary?.total_expenses ?? 0)
  const income = Number(summary?.total_income ?? 0)
  const remaining = Number(summary?.remaining_budget ?? 0)

  if (!summary) {
    return {
      tone: 'neutral',
      badge: 'Waiting',
      value: 'Waiting on live totals',
      supportingText: 'Budget snapshot',
      spent,
      budget,
      income,
    }
  }

  if (!budget) {
    return {
      tone: 'neutral',
      badge: 'Live spend',
      value: `${formatCurrency(spent)} spent`,
      supportingText: `${formatCurrency(income)} in income tracked so far.`,
      spent,
      budget,
      income,
    }
  }

  if (remaining < 0 || summary.threshold_exceeded) {
    return {
      tone: 'warning',
      badge: 'Over budget',
      value: `${formatCurrency(Math.abs(remaining))} over`,
      supportingText: `out of ${formatCurrency(budget)} budgeted`,
      spent,
      budget,
      income,
    }
  }

  return {
    tone: 'positive',
    badge: 'On track',
    value: `${formatCurrency(remaining)} left`,
    supportingText: `out of ${formatCurrency(budget)} budgeted`,
    spent,
    budget,
    income,
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

function buildLiveCategoryCards(breakdown = [], totalExpenses = 0) {
  return breakdown.map((item) => {
    const visual = getCategoryVisual(item.category_name || 'Uncategorized')
    const amount = Number(item.total_amount ?? 0)
    const share = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0

    return {
      id: item.category_id ?? item.category_name ?? `${item.category_name}-${amount}`,
      name: visual.label,
      symbol: visual.symbol,
      color: visual.color,
      soft: visual.soft,
      progress: Math.min(share, 100),
      amount,
      note: `${Math.round(share) || 0}% of spend`,
    }
  })
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
  const [currentMonth] = useState(getCurrentMonthStart)
  const [reloadToken, setReloadToken] = useState(0)
  const [liveState, setLiveState] = useState({
    status: 'loading',
    message: '',
    summary: null,
    breakdown: [],
    expenses: [],
    income: [],
  })

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
        apiGet(`/api/expenses/breakdown?month=${encodeURIComponent(currentMonth)}`, {
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
      const breakdownResult = results[1]
      const expensesResult = results[2]
      const incomeResult = results[3]
      const failedCount = results.filter((result) => result.status === 'rejected').length

      setLiveState({
        status: failedCount ? (failedCount === results.length ? 'error' : 'partial') : 'ready',
        message: failedCount
          ? failedCount === results.length
            ? 'We could not reach the live dashboard endpoints just now.'
            : 'Some live sections are missing for the moment, but the rest of the month is still visible.'
          : '',
        summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
        breakdown: breakdownResult.status === 'fulfilled' ? breakdownResult.value : [],
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
        breakdown: [],
        expenses: [],
        income: [],
      })
    })

    return () => controller.abort()
  }, [currentMonth, isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  if (!isReady || !session?.accessToken) {
    return null
  }

  const summary = isSampleMode ? demoBudgetSummary : liveState.summary
  const activity = isSampleMode
    ? demoActivity
    : buildActivityFeed(liveState.expenses, liveState.income)
  const recentActivity = activity.slice(0, PREVIEW_LIMIT)
  const recentIncome = activity.filter((entry) => entry.kind === 'income').slice(0, INCOME_LIMIT)
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
    : buildLiveCategoryCards(
      [...liveState.breakdown].sort((left, right) => Number(right.total_amount) - Number(left.total_amount)),
      Number(summary?.total_expenses ?? 0)
    )
  const heroState = getHeroState(summary)
  const chartMonth = isSampleMode ? DEMO_MONTH : summary?.month || currentMonth
  const trendPoints = isSampleMode
    ? demoBudgetTrend
    : buildMonthlySpendTrend(liveState.expenses, currentMonth)
  const projectedTrendPoints = buildProjectedTrend(chartMonth, heroState.budget, trendPoints.length)
  const chartCeiling = getTrendCeiling(trendPoints, projectedTrendPoints, heroState.budget)
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
  const balance = Number(summary?.total_income ?? 0) - Number(summary?.total_expenses ?? 0)
  const firstName = getFirstName(session?.user?.email)
  const remainingBudget = Number(summary?.remaining_budget ?? 0)
  const budgetStatus = heroState.budget
    ? remainingBudget >= 0
      ? `${formatCurrency(remainingBudget)} left in budget`
      : `${formatCurrency(Math.abs(remainingBudget))} over budget`
    : 'Budget not set'

  return (
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

      <article className={`budget-hero budget-hero--${heroState.tone}`}>
        <div className="budget-hero__header">
          <div className="budget-hero__headline">
            <h2 className="budget-hero__value">{heroState.value}</h2>
            <p className="budget-hero__suffix">{heroState.supportingText}</p>
          </div>
          <span className={`budget-hero__badge budget-hero__badge--${heroState.tone}`}>{heroState.badge}</span>
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
            {overrunAmount > 0 && currentPoint ? (
              <div
                className="budget-hero__callout"
                style={{
                  left: currentPointLeft,
                  top: currentPointTop,
                }}
              >
                {formatCurrency(overrunAmount)} over pace
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
          <Link className="section-link" href="/insights">
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

        <article className="dashboard-panel dashboard-pocket">
          <div className="dashboard-pocket__header">
            <div>
              <span className="dashboard-pocket__eyebrow">Income support</span>
              <h2 className="dashboard-pocket__title">{formatCurrency(summary?.total_income ?? 0)}</h2>
              <p className="dashboard-pocket__summary">{budgetStatus}</p>
            </div>
            <span className={`dashboard-pocket__trend${balance < 0 ? ' dashboard-pocket__trend--negative' : ''}`}>
              {balance < 0 ? `${formatCurrency(Math.abs(balance))} behind` : `${formatCurrency(balance)} ahead`}
            </span>
          </div>

          <div className="dashboard-pocket__stats">
            <div className="dashboard-pocket__metric">
              <span>Tracked</span>
              <strong>{formatCurrency(summary?.total_income ?? 0)}</strong>
            </div>
            <div className="dashboard-pocket__metric">
              <span>Net</span>
              <strong>{formatCurrency(balance)}</strong>
            </div>
          </div>

          <div className="dashboard-pocket__list">
            {recentIncome.length ? recentIncome.map((entry) => {
              const visual = getEntryVisual(entry)
              return (
                <div
                  className="dashboard-pocket__row"
                  key={entry.id}
                  style={{
                    '--entry-color': visual.color,
                    '--entry-soft': visual.soft,
                  }}
                >
                  <div className="entry-avatar entry-avatar--small">
                    <span>{visual.symbol}</span>
                  </div>
                  <div className="dashboard-pocket__copy">
                    <strong>{entry.title}</strong>
                    <span>{entry.note || formatMonthPeriod(entry.occurredOn)}</span>
                  </div>
                  <div className="entry-amount entry-amount--income">+{formatCurrency(entry.amount)}</div>
                </div>
              )
            }) : (
              <div className="blank-state blank-state--compact">
                <strong>No income rows yet</strong>
                <span>Income deposits will show up here as they land.</span>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

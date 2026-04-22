'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode } from '@/components/providers'
import { ApiError, apiGet } from '@/lib/apiClient'
import {
  DEMO_MONTH,
  demoActivity,
  demoBudgetSummary,
  demoCategoryBudgets,
  demoIncomeSources,
} from '@/lib/demoData'
import { getCategoryVisual, getEntryVisual } from '@/lib/financeVisuals'
import {
  buildActivityFeed,
  buildIncomeSourceBreakdown,
  formatCurrency,
  formatMonthLabel,
  formatPercentage,
  getCurrentMonthStart,
  getMonthStartValue,
  isInMonth,
  shiftMonth,
} from '@/lib/financeUtils'

const BREAKDOWN_LIMIT = 6
const SIDEBAR_LIMIT = 4
const DONUT_VIEWBOX = 320
const DONUT_CENTER = DONUT_VIEWBOX / 2
const DONUT_RADIUS = 104
const DONUT_ICON_RADIUS = 148

function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'The live insights snapshot is not available right now.'
}

function polarToCartesian(angle, radius) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: DONUT_CENTER + radius * Math.cos(radians),
    y: DONUT_CENTER + radius * Math.sin(radians),
  }
}

function describeArc(startAngle, endAngle) {
  const start = polarToCartesian(endAngle, DONUT_RADIUS)
  const end = polarToCartesian(startAngle, DONUT_RADIUS)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M',
    start.x.toFixed(3),
    start.y.toFixed(3),
    'A',
    DONUT_RADIUS,
    DONUT_RADIUS,
    0,
    largeArcFlag,
    0,
    end.x.toFixed(3),
    end.y.toFixed(3),
  ].join(' ')
}

function buildDonutSegments(items = []) {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  if (!total) return []

  const gapAngle = items.length > 1 ? 2.4 : 0
  let currentAngle = 0

  return items.map((item, index) => {
    const sliceAngle = (item.amount / total) * 360
    const startAngle = currentAngle + gapAngle / 2
    const endAngle = currentAngle + sliceAngle - gapAngle / 2
    const arcEndAngle = endAngle <= startAngle
      ? startAngle + Math.min(Math.max(sliceAngle, 1), 359.5)
      : Math.min(endAngle, startAngle + 359.5)
    const midAngle = startAngle + (arcEndAngle - startAngle) / 2
    const share = total > 0 ? (item.amount / total) * 100 : 0
    const iconPosition = polarToCartesian(midAngle, DONUT_ICON_RADIUS)

    currentAngle += sliceAngle

    return {
      ...item,
      animationDelay: `${index * 90}ms`,
      path: describeArc(startAngle, arcEndAngle),
      share,
      iconLeft: `${(iconPosition.x / DONUT_VIEWBOX) * 100}%`,
      iconTop: `${(iconPosition.y / DONUT_VIEWBOX) * 100}%`,
    }
  })
}

function buildLiveExpenseBreakdown(expenses = []) {
  const grouped = new Map()

  expenses.forEach((expense) => {
    const amount = Number(expense.amount ?? 0)
    const key = expense.category_id ?? expense.category_name ?? 'uncategorized'
    const lookupValue = [expense.category_name, expense.description].filter(Boolean).join(' ') || 'Uncategorized'

    if (!grouped.has(key)) {
      grouped.set(key, {
        lookupValue,
        amount: 0,
        count: 0,
      })
    }

    const current = grouped.get(key)
    current.amount += amount
    current.count += 1
  })

  return Array.from(grouped.entries())
    .map(([key, item]) => {
      const visual = getCategoryVisual(item.lookupValue)
      return {
        id: key,
        name: visual.label,
        amount: Number(item.amount.toFixed(2)),
        color: visual.color,
        soft: visual.soft,
        symbol: visual.symbol,
        count: item.count,
      }
    })
    .sort((left, right) => right.amount - left.amount)
}

export function getExpenseItems(categoryStatuses, monthlyExpenses = []) {
  if (Array.isArray(categoryStatuses)) {
    return [...categoryStatuses]
      .sort((left, right) => Number(right.spent ?? 0) - Number(left.spent ?? 0))
      .slice(0, BREAKDOWN_LIMIT)
      .map((item) => {
        const visual = getCategoryVisual(item.category_name)
        const spent = Number(item.spent ?? 0)
        const remainingBudget = item.remaining_budget == null ? null : Number(item.remaining_budget)
        return {
          id: item.category_id ?? item.category_name,
          name: item.category_name,
          amount: spent,
          summaryLine: `This month: ${formatCurrency(spent)}`,
          detailLine: item.monthly_limit == null
            ? 'No budget set'
            : `Budget: ${formatCurrency(item.monthly_limit)}`,
          secondary: item.monthly_limit == null
            ? 'No budget set'
            : `${formatCurrency(Math.abs(remainingBudget ?? 0))} ${remainingBudget != null && remainingBudget < 0 ? 'over' : 'left'}`,
          color: visual.color,
          soft: visual.soft,
          symbol: item.category_icon || visual.symbol,
        }
      })
  }

  return buildLiveExpenseBreakdown(monthlyExpenses)
    .slice(0, BREAKDOWN_LIMIT)
    .map((item) => ({
      ...item,
      summaryLine: `This month: ${formatCurrency(item.amount)}`,
      detailLine: `${item.count} transaction${item.count === 1 ? '' : 's'}`,
      secondary: `${item.count} transaction${item.count === 1 ? '' : 's'}`,
    }))
}

function getCombinedMessage(...messages) {
  return Array.from(new Set(messages.filter(Boolean))).join(' ')
}

function getPatternToken(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item'
}

function LiveNotice({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="inline-status" role="status">
      <div>
        <strong>Live insights are limited right now</strong>
        <span>{message}</span>
      </div>
      <button className="button-secondary page-retry" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  )
}

export default function InsightsView() {
  const router = useRouter()
  const { isReady, logout, session } = useAuth()
  const { isSampleMode } = useDataMode()
  const [viewMode, setViewMode] = useState('expenses')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStart)
  const [reloadToken, setReloadToken] = useState(0)
  const [liveState, setLiveState] = useState({
    listStatus: 'loading',
    listMessage: '',
    summaryStatus: 'loading',
    summaryMessage: '',
    summary: null,
    expenses: [],
    income: [],
  })

  const currentLiveMonth = getCurrentMonthStart()
  const activeMonth = isSampleMode ? DEMO_MONTH : selectedMonth

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return

    const controller = new AbortController()

    async function loadLiveLists() {
      setLiveState((current) => ({
        ...current,
        listStatus: 'loading',
        listMessage: '',
      }))

      const results = await Promise.allSettled([
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

      const failedCount = results.filter((result) => result.status === 'rejected').length
      setLiveState((current) => ({
        ...current,
        listStatus: failedCount ? (failedCount === results.length ? 'error' : 'partial') : 'ready',
        listMessage: failedCount
          ? failedCount === results.length
            ? 'We could not load the live spending and income rows.'
            : 'Some live rows are missing right now, so a few sections may look lighter than usual.'
          : '',
        expenses: results[0].status === 'fulfilled' ? results[0].value : [],
        income: results[1].status === 'fulfilled' ? results[1].value : [],
      }))
    }

    loadLiveLists().catch((error) => {
      if (controller.signal.aborted) return

      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }

      setLiveState((current) => ({
        ...current,
        listStatus: 'error',
        listMessage: getErrorMessage(error),
        expenses: [],
        income: [],
      }))
    })

    return () => controller.abort()
  }, [isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return

    const controller = new AbortController()

    async function loadLiveSummary() {
      setLiveState((current) => ({
        ...current,
        summaryStatus: 'loading',
        summaryMessage: '',
        summary: null,
      }))

      const summary = await apiGet(`/api/budget/summary?month=${encodeURIComponent(activeMonth)}`, {
        accessToken: session.accessToken,
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      setLiveState((current) => ({
        ...current,
        summaryStatus: 'ready',
        summaryMessage: '',
        summary,
      }))
    }

    loadLiveSummary().catch((error) => {
      if (controller.signal.aborted) return

      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }

      setLiveState((current) => ({
        ...current,
        summaryStatus: 'error',
        summaryMessage: getErrorMessage(error),
        summary: null,
      }))
    })

    return () => controller.abort()
  }, [activeMonth, isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  if (!isReady || !session?.accessToken) {
    return null
  }

  const availableMonths = isSampleMode
    ? [DEMO_MONTH]
    : [
      ...liveState.expenses.map((expense) => getMonthStartValue(expense.date || expense.created_at)),
      ...liveState.income.map((entry) => getMonthStartValue(entry.date || entry.created_at)),
    ].filter(Boolean)
  const earliestMonth = availableMonths.length ? [...availableMonths].sort()[0] : currentLiveMonth
  const previousMonth = shiftMonth(activeMonth, -1)
  const previousDisabled = isSampleMode || !earliestMonth || activeMonth <= earliestMonth
  const nextDisabled = isSampleMode || activeMonth >= currentLiveMonth

  const monthlyExpenses = isSampleMode
    ? []
    : liveState.expenses.filter((expense) => isInMonth(expense.date || expense.created_at, activeMonth))
  const monthlyIncome = isSampleMode
    ? []
    : liveState.income.filter((entry) => isInMonth(entry.date || entry.created_at, activeMonth))
  const monthlyActivity = isSampleMode
    ? demoActivity.filter((entry) => isInMonth(entry.occurredOn, activeMonth))
    : buildActivityFeed(liveState.expenses, liveState.income).filter((entry) => isInMonth(entry.occurredOn, activeMonth))

  const expenseItems = isSampleMode
    ? demoCategoryBudgets.map((item) => {
      const visual = getCategoryVisual(item.name)
      return {
        id: item.id,
        name: visual.label,
        amount: item.spent,
        summaryLine: `This month: ${formatCurrency(item.spent)}`,
        detailLine: `Budget: ${formatCurrency(item.budget)}`,
        secondary: `${formatCurrency(Math.abs(item.budget - item.spent))} ${item.budget - item.spent < 0 ? 'over' : 'left'}`,
        color: visual.color,
        soft: visual.soft,
        symbol: visual.symbol,
      }
    })
    : getExpenseItems(liveState.summary?.category_statuses, monthlyExpenses)

  const incomeSourceCounts = new Map()
  monthlyIncome.forEach((entry) => {
    const label = entry?.source_name || 'Income'
    incomeSourceCounts.set(label, (incomeSourceCounts.get(label) || 0) + 1)
  })

  const incomeItems = isSampleMode
    ? demoIncomeSources.map((item) => {
      const visual = getCategoryVisual(item.name, 'income')
      return {
        id: item.id,
        name: item.name,
        amount: item.amount,
        summaryLine: `This month: ${formatCurrency(item.amount)}`,
        detailLine: item.name === 'Transfers' ? '1 transfer' : '1 deposit',
        secondary: item.name === 'Transfers' ? '1 transfer' : '1 deposit',
        color: visual.color,
        soft: visual.soft,
        symbol: visual.symbol,
      }
    })
    : buildIncomeSourceBreakdown(liveState.income, activeMonth).map((item, index) => {
      const visual = getCategoryVisual(item.name, 'income')
      const count = incomeSourceCounts.get(item.name) || 0
      return {
        id: `income-${item.name}-${index}`,
        name: item.name,
        amount: item.amount,
        summaryLine: `This month: ${formatCurrency(item.amount)}`,
        detailLine: `${count || 1} deposit${count === 1 ? '' : 's'}`,
        secondary: `${count || 1} deposit${count === 1 ? '' : 's'}`,
        color: visual.color,
        soft: visual.soft,
        symbol: visual.symbol,
      }
    })

  const activeItems = viewMode === 'expenses' ? expenseItems : incomeItems
  const totalActiveAmount = activeItems.reduce((sum, item) => sum + item.amount, 0)
  const derivedSpent = isSampleMode
    ? Number(demoBudgetSummary.total_expenses)
    : monthlyExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
  const derivedIncome = isSampleMode
    ? Number(demoBudgetSummary.total_income)
    : monthlyIncome.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0)
  const summary = isSampleMode ? demoBudgetSummary : liveState.summary
  const spentValue = summary ? Number(summary.total_expenses ?? derivedSpent) : derivedSpent
  const incomeValue = summary ? Number(summary.total_income ?? derivedIncome) : derivedIncome
  const budgetLimit = summary?.total_budget == null
    ? (summary?.monthly_limit == null ? null : Number(summary.monthly_limit))
    : Number(summary.total_budget)
  const remainingBudget = budgetLimit == null
    ? null
    : summary?.remaining_budget != null
      ? Number(summary.remaining_budget)
      : budgetLimit - spentValue
  const netBalance = incomeValue - spentValue
  const activeMonthLabel = formatMonthLabel(activeMonth)
  const topExpenses = monthlyActivity
    .filter((entry) => entry.kind === 'expense')
    .sort((left, right) => right.amount - left.amount)
    .slice(0, SIDEBAR_LIMIT)
  const topExpensesCopy = `Highest spending items in ${activeMonthLabel}.`
  const topExpensesEmptyCopy = 'Top expenses will appear once the selected month has spending.'
  const budgetProgress = budgetLimit && budgetLimit > 0
    ? Math.min((spentValue / budgetLimit) * 100, 100)
    : 0
  const budgetTone = budgetLimit == null ? 'neutral' : remainingBudget >= 0 ? 'positive' : 'warning'
  const monthSummaryText = budgetLimit == null
    ? 'Set a budget to compare this month against a target.'
    : remainingBudget >= 0
      ? `${formatCurrency(remainingBudget)} left out of ${formatCurrency(budgetLimit)} budgeted`
      : `${formatCurrency(Math.abs(remainingBudget))} over ${formatCurrency(budgetLimit)} budgeted`
  const budgetProgressWidth = budgetLimit && budgetLimit > 0 ? `${budgetProgress}%` : '0%'
  const donutSegments = buildDonutSegments(activeItems)
  const donutPatternScope = `donut-${getPatternToken(activeMonth)}-${getPatternToken(viewMode)}`
  const donutSegmentsWithPattern = donutSegments.map((item, index) => ({
    ...item,
    patternId: `${donutPatternScope}-${getPatternToken(item.id)}-${index}`,
    patternRotation: index % 2 === 0 ? 34 : -34,
  }))
  const liveMessage = getCombinedMessage(liveState.summaryMessage, liveState.listMessage)
  const centerLabel = viewMode === 'expenses' ? 'Spent this month' : 'Income this month'
  const centerLabelWords = centerLabel.split(' ')
  const budgetStatusValue = budgetLimit == null
    ? 'Budget not set'
    : remainingBudget >= 0
      ? `${formatCurrency(remainingBudget)} left`
      : `${formatCurrency(Math.abs(remainingBudget))} over`

  return (
    <section className="app-screen insights-screen">
      <div className="insights-screen__masthead">
        <div className="insights-screen__masthead-row">
          <div className="screen-heading insights-screen__heading">
            <h1 className="screen-heading__title">Insights</h1>
          </div>
          <span className={`screen-chip screen-chip--${isSampleMode ? 'sample' : 'live'}`}>
            {isSampleMode ? 'Sample' : 'Live'}
          </span>
        </div>

        <div className="screen-topline screen-topline--month screen-topline--month-insights">
          <div className="month-switcher" role="group" aria-label="Selected month">
            <button
              aria-label={`Go to ${previousMonth ? formatMonthLabel(previousMonth) : 'previous month'}`}
              className="month-switcher__button"
              disabled={previousDisabled}
              onClick={() => setSelectedMonth((value) => shiftMonth(value, -1) || value)}
              type="button"
            >
              <span aria-hidden="true">{'\u2190'}</span>
            </button>
            <div className="month-switcher__copy">
              <span className="period-chip__label">Selected month</span>
              <strong>{activeMonthLabel}</strong>
            </div>
            <button
              aria-label={`Go to ${formatMonthLabel(shiftMonth(activeMonth, 1) || activeMonth)}`}
              className="month-switcher__button"
              disabled={nextDisabled}
              onClick={() => setSelectedMonth((value) => shiftMonth(value, 1) || value)}
              type="button"
            >
              <span aria-hidden="true">{'\u2192'}</span>
            </button>
          </div>
        </div>
      </div>

      <LiveNotice
        message={liveMessage}
        onRetry={() => setReloadToken((value) => value + 1)}
      />

      <div className="insights-layout insights-layout--stacked">
        <article className="insight-stage insight-stage--main insight-stage--hero">
          {activeItems.length ? (
            <div className="insight-stage__body insight-stage__body--hero">
              <div className="insight-stage__hero-visual">
                <div className="insight-stage__controls insight-stage__controls--hero">
                  <div className="segment-control segment-control--tight segment-control--strong insight-toggle" role="group" aria-label="Insights view mode">
                    <button
                      className={`segment-control__button${viewMode === 'expenses' ? ' segment-control__button--active' : ''}`}
                      onClick={() => setViewMode('expenses')}
                      type="button"
                    >
                      Expenses
                    </button>
                    <button
                      className={`segment-control__button${viewMode === 'income' ? ' segment-control__button--active' : ''}`}
                      onClick={() => setViewMode('income')}
                      type="button"
                    >
                      Income
                    </button>
                  </div>
                </div>

                <div className="insight-stage__chart">
                  <div className="donut-chart" key={`${viewMode}-${activeMonth}-${activeItems.length}`}>
                    <svg aria-hidden="true" className="donut-chart__svg" viewBox={`0 0 ${DONUT_VIEWBOX} ${DONUT_VIEWBOX}`}>
                      <defs>
                        {donutSegmentsWithPattern.map((item) => (
                          <pattern
                            height="8"
                            id={item.patternId}
                            key={`${item.id}-pattern`}
                            patternTransform={`rotate(${item.patternRotation})`}
                            patternUnits="userSpaceOnUse"
                            width="8"
                          >
                            <path d="M -2 4 L 10 4" stroke={item.color} strokeLinecap="round" strokeWidth="2.4" />
                          </pattern>
                        ))}
                      </defs>
                      <circle className="donut-chart__track" cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_RADIUS} />
                      {donutSegmentsWithPattern.map((item) => (
                        <path
                          className="donut-chart__segment"
                          d={item.path}
                          key={item.id}
                          pathLength="1"
                          style={{
                            animationDelay: item.animationDelay,
                            stroke: `url(#${item.patternId})`,
                          }}
                        />
                      ))}
                    </svg>

                    {donutSegmentsWithPattern.map((item) => (
                      <div
                        aria-hidden="true"
                        className="donut-chart__marker"
                        key={`${item.id}-marker`}
                        style={{
                          '--badge-color': item.color,
                          '--badge-soft': item.soft,
                          left: item.iconLeft,
                          top: item.iconTop,
                        }}
                      >
                        <div className="donut-chart__badge">
                          <span>{item.symbol}</span>
                        </div>
                        <span className="donut-chart__marker-label">{formatPercentage(item.share)}</span>
                      </div>
                    ))}

                    <div className="donut-chart__inner">
                      <span className="donut-chart__label">
                        {centerLabelWords.map((word, index) => (
                          <span key={`${word}-${index}`}>{word}</span>
                        ))}
                      </span>
                      <strong>{formatCurrency(totalActiveAmount)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="insight-stage__list insight-stage__breakdown">
                {activeItems.map((item) => (
                  <article className="insight-category-card" key={item.id}>
                    <div className="insight-category-card__main">
                      <div
                        className="insight-category-card__icon"
                        style={{
                          backgroundColor: item.soft,
                          color: item.color,
                        }}
                      >
                        {item.symbol}
                      </div>
                      <div className="insight-category-card__copy">
                        <strong>{item.name}</strong>
                        <span>{item.summaryLine}</span>
                        <small>{item.detailLine}</small>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="blank-state blank-state--hero">
              <strong>No {viewMode === 'expenses' ? 'expense' : 'income'} data yet</strong>
              <span>
                {viewMode === 'expenses'
                  ? 'Category insights appear once selected-month spending lands.'
                  : 'Income sources appear once deposits are part of the selected month.'}
              </span>
            </div>
          )}

        </article>

        <article aria-label="Monthly summary" className="insight-card insight-month-summary insight-card--budget-rail">
          <div className="insight-month-summary__progress">
            <div className={`insight-month-summary__bubble insight-month-summary__bubble--${budgetTone}`}>
              {budgetStatusValue}
            </div>
            <div className="budget-progress" role="presentation">
              <span
                className={`budget-progress__fill budget-progress__fill--${budgetTone}`}
                style={{ width: budgetProgressWidth }}
              />
            </div>
            <p className={`insight-month-summary__progress-note insight-month-summary__progress-note--${budgetTone}`}>
              {monthSummaryText}
            </p>
          </div>
        </article>

        <div className="insight-summary-strip insight-summary-strip--pills">
          <div className="insight-summary-strip__item">
            <span>Balance</span>
            <strong>{formatCurrency(netBalance)}</strong>
          </div>
          <div className="insight-summary-strip__item">
            <span>Income</span>
            <strong>{formatCurrency(incomeValue)}</strong>
          </div>
          <div className="insight-summary-strip__item">
            <span>Expenses</span>
            <strong>{formatCurrency(spentValue)}</strong>
          </div>
        </div>

        <div className="insights-bottom-grid">
          <article className="insight-card insight-card--expenses">
            <div className="insight-card__header">
              <div>
                <span className="insight-pocket__eyebrow">Top expenses</span>
                <h2 className="insight-card__title">Top expenses</h2>
                <p className="insight-card__copy">{topExpensesCopy}</p>
              </div>
            </div>

            {topExpenses.length ? (
              <div className="insight-card__list">
                {topExpenses.map((entry) => {
                  const visual = getEntryVisual(entry)
                  return (
                    <div
                      className="insight-expense"
                      key={entry.id}
                      style={{
                        '--entry-color': visual.color,
                        '--entry-soft': visual.soft,
                      }}
                    >
                      <div className="entry-avatar entry-avatar--small">
                        <span>{visual.symbol}</span>
                      </div>
                      <div className="insight-expense__copy">
                        <strong>{entry.merchant || entry.title}</strong>
                        <span>{entry.note && entry.note !== entry.chip ? entry.note : entry.chip}</span>
                      </div>
                      <div className="entry-amount entry-amount--expense">-{formatCurrency(entry.amount)}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="blank-state blank-state--compact">
                <strong>No expenses yet</strong>
                <span>{topExpensesEmptyCopy}</span>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}

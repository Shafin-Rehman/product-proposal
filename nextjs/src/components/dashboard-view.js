'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode, useDataChanged } from '@/components/providers'
import { ApiError, apiGet, apiPost } from '@/lib/apiClient'
import {
  DEMO_MONTH,
  demoActivity,
  demoBudgetSummary,
  demoBudgetTrend,
  demoCategoryBudgets,
  demoInsightsSnapshot,
  demoSavingsGoals,
} from '@/lib/demoData'
import { getEntryVisual, getInitialsLabel } from '@/lib/financeVisuals'
import {
  buildActivityFeed,
  buildDailySpendDetailsFromExpenses,
  buildMonthlySpendTrend,
  buildRecentCashFlow,
  formatCurrency,
  formatMonthPeriod,
  formatShortDate,
  getCurrentMonthStart,
  isInMonth,
} from '@/lib/financeUtils'
import {
  buildDashboardLivePaths,
  buildDemoRecentCashFlow,
  buildDerivedCategoryCards,
  buildSampleCategoryCards,
  getBudgetCtaLabel,
  getBudgetHintText,
  getBudgetHudModel,
  getCategoryCards,
  getFirstName,
  getPreviewCategories,
  getTopSavingsGoal,
  hasCategoryBudgets,
  hasOverallMonthlyLimit,
  mergeRowsById,
  sortRowsByDateDesc,
} from '@/lib/dashboardModels'
import {
  buildFinancialHealth,
} from '@/lib/budgetHealth'
import {
  getSavingsGoalAvatar,
  getSavingsGoalStatusLabel,
  getSavingsGoalStatusReason,
  getSavingsGoalStatusTone,
} from '@/lib/savingsGoalStatus'
import AllocationBar from '@/components/ui/AllocationBar'
import BudgetHudMetrics from '@/components/ui/BudgetHudMetrics'
import CashFlowSnapshot from '@/components/ui/CashFlowSnapshot'
import CategoryProgressRow from '@/components/ui/CategoryProgressRow'
import CategoryTransactionsModal from '@/components/ui/CategoryTransactionsModal'
import FinancialHealthTile from '@/components/ui/FinancialHealthTile'
import MonthPacingChart from '@/components/ui/MonthPacingChart'
import TransactionDetailSheet from '@/components/ui/TransactionDetailSheet'

const ACTIVITY_PREVIEW_LIMIT = 6
const BUDGET_DRAFT_VALIDATION_MESSAGE = 'Monthly limit must be a positive dollar amount with up to 2 decimal places.'
const BUDGET_DRAFT_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/

export {
  buildDerivedCategoryCards,
  getBudgetCtaLabel,
  getBudgetHintText,
  getBudgetHudModel,
  getCategoryCards,
  getMonthProgressState,
  getBudgetPressureHighlight,
} from '@/lib/dashboardModels'

function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong while loading the live snapshot.'
}

export function getBudgetDraftValidationMessage(value) {
  const rawValue = String(value ?? '').trim()
  if (!rawValue) return BUDGET_DRAFT_VALIDATION_MESSAGE
  if (!BUDGET_DRAFT_PATTERN.test(rawValue)) return BUDGET_DRAFT_VALIDATION_MESSAGE

  const amount = Number(rawValue)
  if (!Number.isFinite(amount) || amount <= 0) {
    return BUDGET_DRAFT_VALIDATION_MESSAGE
  }

  return ''
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
  const { isReady, logout, session, profileName } = useAuth()
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
    savingsGoals: null,
  })
  const [isBudgetSheetOpen, setIsBudgetSheetOpen] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState({ monthly_limit: '' })
  const [isBudgetSaving, setIsBudgetSaving] = useState(false)
  const [budgetSaveError, setBudgetSaveError] = useState('')
  const [activityFilter, setActivityFilter] = useState('all')
  const [categoryDrillDown, setCategoryDrillDown] = useState(null)
  const [activityDetailEntry, setActivityDetailEntry] = useState(null)

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return

    const controller = new AbortController()

    async function loadLiveDashboard() {
      setLiveState((current) => ({
        ...current,
        status: 'loading',
        message: '',
      }))

      const paths = buildDashboardLivePaths(currentMonth)
      const results = await Promise.allSettled([
        apiGet(paths.summary, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(paths.cashFlowExpenses, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(paths.recentExpenses, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(paths.cashFlowIncome, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(paths.recentIncome, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(paths.savingsGoals, {
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
      const cashFlowExpensesResult = results[1]
      const recentExpensesResult = results[2]
      const cashFlowIncomeResult = results[3]
      const recentIncomeResult = results[4]
      const savingsGoalsResult = results[5]
      const failedCount = results.filter((result) => result.status === 'rejected').length

      setLiveState({
        status: failedCount ? (failedCount === results.length ? 'error' : 'partial') : 'ready',
        message: failedCount
          ? failedCount === results.length
            ? 'We could not reach the live dashboard endpoints just now.'
            : 'Some live sections are missing for the moment, but the rest of the month is still visible.'
          : '',
        summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
        expenses: sortRowsByDateDesc(mergeRowsById(
          cashFlowExpensesResult.status === 'fulfilled' ? cashFlowExpensesResult.value : [],
          recentExpensesResult.status === 'fulfilled' ? recentExpensesResult.value : []
        )),
        income: sortRowsByDateDesc(mergeRowsById(
          cashFlowIncomeResult.status === 'fulfilled' ? cashFlowIncomeResult.value : [],
          recentIncomeResult.status === 'fulfilled' ? recentIncomeResult.value : []
        )),
        savingsGoals: savingsGoalsResult.status === 'fulfilled' ? savingsGoalsResult.value : null,
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
        savingsGoals: null,
      })
    })

    return () => controller.abort()
  }, [currentMonth, dataChangedToken, isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  useEffect(() => {
    if (!activityDetailEntry) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActivityDetailEntry(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activityDetailEntry])

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
    const validationMessage = getBudgetDraftValidationMessage(budgetDraft.monthly_limit)
    if (validationMessage) {
      setBudgetSaveError(validationMessage)
      return
    }

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

  const summary = isSampleMode ? demoBudgetSummary : liveState.summary
  const summaryAvailability = isSampleMode
    ? 'ready'
    : liveState.summary
      ? 'ready'
      : liveState.status === 'loading'
        ? 'loading'
        : 'unavailable'
  const currentMonthExpenses = useMemo(() => (
    isSampleMode
      ? []
      : liveState.expenses.filter((expense) => isInMonth(expense.date || expense.created_at, currentMonth))
  ), [currentMonth, isSampleMode, liveState.expenses])
  const categoryTransactionDetails = useMemo(() => (
    isSampleMode
      ? (demoInsightsSnapshot?.dailySpend?.details ?? [])
      : buildDailySpendDetailsFromExpenses(currentMonthExpenses)
  ), [currentMonthExpenses, isSampleMode])
  const activity = useMemo(() => (
    isSampleMode
      ? demoActivity
      : buildActivityFeed(liveState.expenses, liveState.income)
  ), [isSampleMode, liveState.expenses, liveState.income])
  const filteredActivity = useMemo(() => (
    activityFilter === 'all'
      ? activity
      : activity.filter((entry) => entry.kind === activityFilter)
  ), [activity, activityFilter])
  const recentActivity = useMemo(() => (
    filteredActivity.slice(0, ACTIVITY_PREVIEW_LIMIT)
  ), [filteredActivity])
  const chartMonth = isSampleMode ? DEMO_MONTH : summary?.month || currentMonth
  const hasBudgetedStatuses = hasCategoryBudgets(summary)
  const derivedCategoryCards = useMemo(() => (
    !isSampleMode && !hasBudgetedStatuses
      ? buildDerivedCategoryCards(currentMonthExpenses)
      : null
  ), [currentMonthExpenses, hasBudgetedStatuses, isSampleMode])
  const categoryCards = useMemo(() => (
    isSampleMode
      ? buildSampleCategoryCards(demoCategoryBudgets)
      : getCategoryCards(summary?.category_statuses, currentMonthExpenses, derivedCategoryCards)
  ), [currentMonthExpenses, derivedCategoryCards, isSampleMode, summary?.category_statuses])
  const budgetCtaLabel = getBudgetCtaLabel(summary)
  const trendPoints = useMemo(() => (
    isSampleMode
      ? demoBudgetTrend
      : buildMonthlySpendTrend(liveState.expenses, currentMonth)
  ), [currentMonth, isSampleMode, liveState.expenses])
  const hudState = useMemo(() => getBudgetHudModel(summary, {
    month: chartMonth,
    observedDayCount: trendPoints.length,
    availability: summaryAvailability,
  }), [chartMonth, summary, summaryAvailability, trendPoints.length])
  const financialHealth = useMemo(() => buildFinancialHealth({
    summary,
    availability: summaryAvailability,
  }), [summary, summaryAvailability])
  const savingsGoals = isSampleMode ? demoSavingsGoals : liveState.savingsGoals
  const topSavingsGoal = useMemo(() => (
    getTopSavingsGoal(savingsGoals)
  ), [savingsGoals])
  const recentCashFlow = useMemo(() => (
    isSampleMode
      ? buildDemoRecentCashFlow(demoBudgetSummary)
      : buildRecentCashFlow(liveState.expenses, liveState.income, chartMonth, 3)
  ), [chartMonth, isSampleMode, liveState.expenses, liveState.income])
  const firstName = profileName || (isSampleMode && !session?.user?.email ? 'Explorer' : getFirstName(session?.user?.email))
  const periodLabel = formatMonthPeriod(chartMonth)
  const previewCategories = useMemo(() => (
    getPreviewCategories(categoryCards)
  ), [categoryCards])
  const monthMarkerLabel = hudState.monthState?.monthLength
    ? `Today · Day ${hudState.monthState.activeDay}`
    : null
  const chartSpendValue = trendPoints.length ? formatCurrency(trendPoints.at(-1) ?? 0) : '--'

  if (!isSampleMode && (!isReady || !session?.accessToken)) {
    return null
  }

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
          <span className="budget-hero__eyebrow">{periodLabel} budget HUD</span>
          <div className="budget-hero__actions">
            <span className={`budget-hero__badge budget-hero__badge--${hudState.tone}`}>{hudState.badge}</span>
            {!isSampleMode && (
              <button className="button-secondary page-retry" onClick={openBudgetSheet} type="button">
                {budgetCtaLabel}
              </button>
            )}
          </div>
        </div>

        <div className="budget-hero__headline">
          <h2 className="budget-hero__value">{hudState.value}</h2>
          <p className="budget-hero__suffix">{hudState.supportingText}</p>
        </div>

        <AllocationBar
          progressPercentage={hudState.progressPercentage}
          tone={hudState.tone}
          ariaLabel="Monthly budget progress"
          ariaValueText={hudState.progressLabel}
          monthLength={hudState.monthState?.monthLength}
          activeDay={hudState.monthState?.activeDay}
          monthMarkerLabel={monthMarkerLabel}
          isOverBudget={hudState.isOverBudget}
          showMarker={hudState.hasBudget}
        />

        <BudgetHudMetrics metrics={hudState.metrics} />
      </article>

      <section className="section-block dashboard-trend">
        <div className="section-headline">
          <h2>Month pacing</h2>
          <span className="section-link">{chartSpendValue} spent</span>
        </div>

        <MonthPacingChart
          trendPoints={trendPoints}
          budget={hudState.budget}
          monthLength={hudState.monthState?.monthLength ?? 30}
          activeDay={hudState.monthState?.activeDay ?? 0}
          isOverBudget={hudState.isOverBudget}
          emptyState={(
            <div className="blank-state blank-state--compact">
              <strong>Waiting on activity</strong>
              <span>Your pacing line will appear once expenses land this month.</span>
            </div>
          )}
        />
      </section>

      <section className="dashboard-glance dashboard-glance--single" aria-label="At a glance">
        <FinancialHealthTile
          health={financialHealth}
          income={hudState.income}
          expenses={hudState.spent}
        />
      </section>

      <section className="section-block savings-goals savings-goals--dashboard">
        <div className="section-headline">
          <h2>Savings goals</h2>
          <Link className="section-link" href="/planner">
            Manage
          </Link>
        </div>
        {topSavingsGoal ? (
          <article className={`savings-goal savings-goal--${getSavingsGoalStatusTone(topSavingsGoal.budget_context?.status)}`}>
            <div className="savings-goal__top">
              <div className="savings-goal__identity">
                <div className="savings-goal__avatar" aria-hidden="true">{getSavingsGoalAvatar(topSavingsGoal)}</div>
                <div>
                  <strong>{topSavingsGoal.name}</strong>
                  <span>{Math.round(topSavingsGoal.progress_percentage ?? 0)}% saved toward {formatCurrency(topSavingsGoal.target_amount)}</span>
                  <small>{getSavingsGoalStatusReason(topSavingsGoal)}</small>
                </div>
              </div>
              <span className={`planner-status planner-status--${getSavingsGoalStatusTone(topSavingsGoal.budget_context?.status)}`}>
                {getSavingsGoalStatusLabel(topSavingsGoal.budget_context?.status)}
              </span>
            </div>
            <div className="savings-goal__progress" role="progressbar" aria-label={`${topSavingsGoal.name} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(topSavingsGoal.progress_percentage ?? 0)}>
              <span style={{ width: `${Math.min(Number(topSavingsGoal.progress_percentage ?? 0), 100)}%` }} />
            </div>
            <div className="savings-goal__metrics">
              <div><span>Saved</span><strong>{formatCurrency(topSavingsGoal.current_amount)}</strong></div>
              <div><span>Monthly</span><strong>{formatCurrency(topSavingsGoal.monthly_required)}</strong></div>
              <div><span>After goals</span><strong>{savingsGoals?.summary?.available_after_goal_contributions == null ? 'No budget' : formatCurrency(savingsGoals.summary.available_after_goal_contributions)}</strong></div>
            </div>
          </article>
        ) : (
          <div className="blank-state blank-state--compact">
            <strong>No savings goals yet</strong>
            <span>Add goals in the planner to connect targets with monthly budget room.</span>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-headline">
          <h2>Budgets</h2>
          <Link className="section-link" href="/planner">
            View more
          </Link>
        </div>

        {previewCategories.length ? (
          <div className="category-progress-list">
            {previewCategories.map((item) => (
              <CategoryProgressRow
                amount={item.amount}
                color={item.color}
                fallbackShareText={item.monthlyLimit == null ? item.note : null}
                key={item.id}
                monthlyLimit={item.monthlyLimit}
                name={item.name}
                onSelect={() => setCategoryDrillDown({
                  name: item.name,
                  symbol: item.symbol,
                  color: item.color,
                  soft: item.soft,
                })}
                progressPercentage={item.progress}
                remainingAmount={item.remainingAmount}
                selectLabel={`View ${item.name} transactions for ${periodLabel}`}
                soft={item.soft}
                statusLabel={item.statusLabel}
                symbol={item.symbol}
                tone={item.statusTone || 'neutral'}
              />
            ))}
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

          <div className="segment-control segment-control--strong dashboard-activity-filter" role="group" aria-label="Activity filter">
            <button
              aria-pressed={activityFilter === 'all'}
              className={`segment-control__button${activityFilter === 'all' ? ' segment-control__button--active' : ''}`}
              onClick={() => setActivityFilter('all')}
              type="button"
            >
              All
            </button>
            <button
              aria-pressed={activityFilter === 'expense'}
              className={`segment-control__button${activityFilter === 'expense' ? ' segment-control__button--active' : ''}`}
              onClick={() => setActivityFilter('expense')}
              type="button"
            >
              Expenses
            </button>
            <button
              aria-pressed={activityFilter === 'income'}
              className={`segment-control__button${activityFilter === 'income' ? ' segment-control__button--active' : ''}`}
              onClick={() => setActivityFilter('income')}
              type="button"
            >
              Income
            </button>
          </div>

          {recentActivity.length ? (
            <div className="activity-feed">
              {recentActivity.map((entry) => {
                const visual = getEntryVisual(entry)

                return (
                  <button
                    className={`activity-feed__row activity-feed__row--${entry.kind} activity-feed__row--interactive`}
                    key={entry.id}
                    onClick={() => setActivityDetailEntry(entry)}
                    style={{
                      '--entry-color': visual.color,
                      '--entry-soft': visual.soft,
                    }}
                    type="button"
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
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="blank-state blank-state--compact">
              <strong>
                {activityFilter === 'income'
                  ? 'No income yet'
                  : activityFilter === 'expense'
                    ? 'No expenses yet'
                    : 'No activity yet'}
              </strong>
              <span>
                {activityFilter === 'income'
                  ? 'Income entries will show up here as they land.'
                  : activityFilter === 'expense'
                    ? 'Expenses will show up here as they land.'
                    : 'New transactions will land here once the month starts moving.'}
              </span>
            </div>
          )}
        </section>

        <CashFlowSnapshot
          expenses={hudState.spent}
          income={hudState.income}
          monthLabel={periodLabel}
          trend={recentCashFlow}
          viewMoreHref="/insights"
        />
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
              noValidate
              onSubmit={(event) => { event.preventDefault(); handleSaveBudget() }}
            >
              <label className="entry-sheet__field">
                <span>Monthly limit ($)</span>
                <input
                  className="input-field"
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) => {
                    setBudgetDraft({ monthly_limit: event.target.value })
                    if (budgetSaveError) setBudgetSaveError('')
                  }}
                  placeholder="e.g. 2000"
                  step="0.01"
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

      <CategoryTransactionsModal
        category={categoryDrillDown}
        currentMonthDetails={categoryTransactionDetails}
        currentMonthLabel={periodLabel}
        isOpen={Boolean(categoryDrillDown)}
        onClose={() => setCategoryDrillDown(null)}
        previousMonthDetails={null}
        previousMonthLabel={null}
      />

      {activityDetailEntry ? (
        <TransactionDetailSheet
          entry={activityDetailEntry}
          onClose={() => setActivityDetailEntry(null)}
        />
      ) : null}
    </>
  )
}

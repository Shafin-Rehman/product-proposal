'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataChanged, useDataMode } from '@/components/providers'
import { ApiError, apiGet, apiPost } from '@/lib/apiClient'
import { DEMO_MONTH, demoBudgetSummary, demoCategoryBudgets } from '@/lib/demoData'
import { getCategoryVisual } from '@/lib/financeVisuals'
import {
  formatCurrency,
  formatMonthLabel,
  formatMonthPeriod,
  getCurrentMonthStart,
} from '@/lib/financeUtils'
import {
  buildFinancialHealth,
  buildOverallBudgetHealth,
} from '@/lib/budgetHealth'
import {
  areMoneyDraftValuesEquivalent,
  formatMoneyDraftValue,
  buildPlannerDraftSnapshot,
  buildCopyLastMonthPayload,
  buildPlannerRows,
  buildPlannerSummary,
  getCopyLastMonthState,
  getPlannerAdjacentMonths,
  mergePlannerDrafts,
  normalizeMoneyDraftForSave,
} from '@/lib/planner'

function areDraftMapsEqual(left = {}, right = {}) {
  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)

  if (leftEntries.length !== rightEntries.length) return false
  return leftEntries.every(([key, value]) => right[key] === value)
}

function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'The planner could not load this month right now.'
}

function buildSampleConfig() {
  return {
    month: DEMO_MONTH,
    monthly_limit: demoBudgetSummary.monthly_limit,
    category_budgets: demoBudgetSummary.category_statuses
      .filter((status) => status.monthly_limit != null)
      .map((status) => ({
        category_id: status.category_id,
        category_name: status.category_name,
        category_icon: status.category_icon,
        monthly_limit: status.monthly_limit,
      })),
  }
}

function buildSampleCategories() {
  return demoCategoryBudgets.map((item) => ({
    id: item.id,
    name: item.name,
    icon: null,
  }))
}

function LiveNotice({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="inline-status" role="status">
      <div>
        <strong>Planner data is limited right now</strong>
        <span>{message}</span>
      </div>
      <button className="button-secondary page-retry" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  )
}

function PlannerFeedback({ feedback }) {
  if (!feedback?.message) return null

  return (
    <div className={`planner-feedback planner-feedback--${feedback.tone || 'neutral'}`} role="status">
      {feedback.message}
    </div>
  )
}

export default function PlannerView() {
  const router = useRouter()
  const { isReady, session, handleAuthError } = useAuth()
  const { isSampleMode } = useDataMode()
  const { notifyDataChanged } = useDataChanged()
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStart)
  const [reloadToken, setReloadToken] = useState(0)
  const [liveState, setLiveState] = useState({
    month: null,
    status: 'loading',
    message: '',
    categories: [],
    config: null,
    summary: null,
    previousConfig: undefined,
    previousConfigStatus: 'loading',
  })
  const [rowDrafts, setRowDrafts] = useState({})
  const [overallDraft, setOverallDraft] = useState('')
  const [savingTarget, setSavingTarget] = useState('')
  const [copyingMonth, setCopyingMonth] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const hydratedMonthRef = useRef(null)
  const dirtyRowIdsRef = useRef(new Set())
  const isOverallDirtyRef = useRef(false)
  const rowDraftsRef = useRef({})
  const overallDraftRef = useRef('')

  const activeMonth = isSampleMode ? DEMO_MONTH : selectedMonth

  useEffect(() => {
    setFeedback(null)
  }, [activeMonth, isSampleMode])

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return

    const controller = new AbortController()
    const { previousMonth } = getPlannerAdjacentMonths(selectedMonth)

    async function loadPlanner() {
      setLiveState((current) => {
        const isSameMonthReload = current.month === selectedMonth

        return {
          month: selectedMonth,
          status: 'loading',
          message: '',
          categories: isSameMonthReload ? current.categories : [],
          config: isSameMonthReload ? current.config : null,
          summary: isSameMonthReload ? current.summary : null,
          previousConfig: undefined,
          previousConfigStatus: 'loading',
        }
      })

      const results = await Promise.allSettled([
        apiGet('/api/expenses/categories', {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(`/api/budget?month=${encodeURIComponent(selectedMonth)}`, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(`/api/budget/summary?month=${encodeURIComponent(selectedMonth)}`, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet(`/api/budget?month=${encodeURIComponent(previousMonth)}`, {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
      ])

      if (controller.signal.aborted) return

      const authFailure = results.find(
        (result) => result.status === 'rejected' && handleAuthError(result.reason, router)
      )
      if (authFailure) return

      const failedCount = results.filter((result) => result.status === 'rejected').length
      setLiveState({
        month: selectedMonth,
        status: failedCount ? (failedCount === results.length ? 'error' : 'partial') : 'ready',
        message: failedCount
          ? failedCount === results.length
            ? 'We could not reach the planner endpoints for this month.'
            : 'Some planner details are missing right now, but you can still review the rest of the month.'
          : '',
        categories: results[0].status === 'fulfilled' ? results[0].value : [],
        config: results[1].status === 'fulfilled' ? results[1].value : null,
        summary: results[2].status === 'fulfilled' ? results[2].value : null,
        previousConfig: results[3].status === 'fulfilled' ? results[3].value : null,
        previousConfigStatus: results[3].status === 'fulfilled' ? 'ready' : 'unavailable',
      })
    }

    loadPlanner().catch((error) => {
      if (controller.signal.aborted) return

      if (handleAuthError(error, router)) return

      setLiveState({
        month: selectedMonth,
        status: 'error',
        message: getErrorMessage(error),
        categories: [],
        config: null,
        summary: null,
        previousConfig: null,
        previousConfigStatus: 'unavailable',
      })
    })

    return () => controller.abort()
  }, [isReady, isSampleMode, reloadToken, router, selectedMonth, session?.accessToken])

  const isLiveMonthCurrent = isSampleMode || liveState.month === selectedMonth
  const activeCategories = isSampleMode ? buildSampleCategories() : (isLiveMonthCurrent ? liveState.categories : [])
  const activeConfig = isSampleMode ? buildSampleConfig() : (isLiveMonthCurrent ? liveState.config : null)
  const activeSummary = isSampleMode ? demoBudgetSummary : (isLiveMonthCurrent ? liveState.summary : null)
  const previousConfig = isSampleMode ? null : (isLiveMonthCurrent ? liveState.previousConfig : undefined)

  const plannerRows = useMemo(() => buildPlannerRows({
    categories: activeCategories,
    categoryBudgets: activeConfig?.category_budgets,
    categoryStatuses: activeSummary?.category_statuses,
    actualsAvailable: Boolean(activeSummary),
  }), [activeCategories, activeConfig?.category_budgets, activeSummary?.category_statuses, activeSummary])

  const plannerSummary = useMemo(() => buildPlannerSummary({
    rows: plannerRows,
    summary: activeSummary,
    config: activeConfig,
  }), [activeConfig, activeSummary, plannerRows])
  const serverDraftSnapshot = useMemo(() => buildPlannerDraftSnapshot(
    plannerRows,
    plannerSummary.overallLimit
  ), [plannerRows, plannerSummary.overallLimit])

  useEffect(() => {
    rowDraftsRef.current = rowDrafts
  }, [rowDrafts])

  useEffect(() => {
    overallDraftRef.current = overallDraft
  }, [overallDraft])

  useEffect(() => {
    if (hydratedMonthRef.current !== activeMonth) {
      hydratedMonthRef.current = activeMonth
      dirtyRowIdsRef.current = new Set()
      isOverallDirtyRef.current = false
      rowDraftsRef.current = serverDraftSnapshot.rowDrafts
      overallDraftRef.current = serverDraftSnapshot.overallDraft
      setRowDrafts(serverDraftSnapshot.rowDrafts)
      setOverallDraft(serverDraftSnapshot.overallDraft)
      return
    }

    const mergedDrafts = mergePlannerDrafts({
      currentRowDrafts: rowDraftsRef.current,
      currentOverallDraft: overallDraftRef.current,
      nextRowDrafts: serverDraftSnapshot.rowDrafts,
      nextOverallDraft: serverDraftSnapshot.overallDraft,
      dirtyRowIds: dirtyRowIdsRef.current,
      isOverallDirty: isOverallDirtyRef.current,
    })

    dirtyRowIdsRef.current = mergedDrafts.dirtyRowIds
    isOverallDirtyRef.current = mergedDrafts.isOverallDirty

    if (!areDraftMapsEqual(rowDraftsRef.current, mergedDrafts.rowDrafts)) {
      rowDraftsRef.current = mergedDrafts.rowDrafts
      setRowDrafts(mergedDrafts.rowDrafts)
    }

    if (overallDraftRef.current !== mergedDrafts.overallDraft) {
      overallDraftRef.current = mergedDrafts.overallDraft
      setOverallDraft(mergedDrafts.overallDraft)
    }
  }, [activeMonth, serverDraftSnapshot])

  if (!isReady || !session?.accessToken) {
    return null
  }

  const { previousMonth, nextMonth } = getPlannerAdjacentMonths(activeMonth)
  const actualSpendState = isSampleMode
    ? 'ready'
    : !isLiveMonthCurrent
      ? 'loading'
    : activeSummary
      ? 'ready'
      : liveState.status === 'loading'
        ? 'loading'
        : 'unavailable'
  const summaryAvailability = actualSpendState === 'ready'
    ? 'ready'
    : actualSpendState === 'loading'
      ? 'loading'
      : 'unavailable'
  const copyState = getCopyLastMonthState({
    currentConfig: activeConfig,
    previousConfig,
    isSampleMode,
    isPreviousMonthLoading: !isSampleMode && (!isLiveMonthCurrent || liveState.previousConfigStatus === 'loading'),
    isPreviousMonthUnavailable: !isSampleMode && liveState.previousConfigStatus === 'unavailable',
  })
  const planDeltaValue = !plannerSummary.hasActualSpendData
    ? actualSpendState === 'loading'
      ? 'Loading...'
      : 'Unavailable'
    : plannerSummary.remainingTotal == null
      ? 'No plan'
      : plannerSummary.remainingTotal >= 0
        ? `${formatCurrency(plannerSummary.remainingTotal)} under plan`
        : `${formatCurrency(Math.abs(plannerSummary.remainingTotal))} over plan`
  const overallCapLabel = plannerSummary.overallLimit == null
    ? 'No overall cap set'
    : !plannerSummary.hasActualSpendData
      ? actualSpendState === 'loading'
        ? 'Waiting for live actual spend'
        : 'Actual spend unavailable for this month'
      : plannerSummary.overallRemaining >= 0
        ? `${formatCurrency(plannerSummary.overallRemaining)} left in cap`
        : `${formatCurrency(Math.abs(plannerSummary.overallRemaining))} over cap`
  const actualSpendValue = actualSpendState === 'ready'
    ? formatCurrency(plannerSummary.spentTotal)
    : actualSpendState === 'loading'
      ? 'Loading...'
      : 'Unavailable'
  const actualSpendCopy = actualSpendState === 'ready'
    ? 'Live expenses recorded in the selected month.'
    : actualSpendState === 'loading'
      ? 'Waiting for the live budget summary to load.'
      : 'The live budget summary is unavailable, so actual spend is not being guessed.'
  const normalizedOverallDraft = normalizeMoneyDraftForSave(overallDraft)
  const normalizedOverallLimit = normalizeMoneyDraftForSave(plannerSummary.overallLimit)
  const planDeltaTone = !plannerSummary.hasActualSpendData || plannerSummary.remainingTotal == null
    ? 'neutral'
    : plannerSummary.remainingTotal < 0
      ? 'danger'
      : plannerSummary.remainingTotal > 0
        ? 'positive'
        : 'neutral'
  const overallCapTone = plannerSummary.overallLimit == null || !plannerSummary.hasActualSpendData || plannerSummary.overallRemaining == null
    ? 'neutral'
    : plannerSummary.overallRemaining < 0
      ? 'danger'
      : plannerSummary.overallRemaining > 0
        ? 'positive'
        : 'neutral'
  const overallBudgetHealth = buildOverallBudgetHealth({
    summary: activeSummary,
    availability: summaryAvailability,
    month: activeMonth,
  })
  const financialHealth = buildFinancialHealth({
    summary: activeSummary,
    availability: summaryAvailability,
  })

  const handleRetry = () => setReloadToken((value) => value + 1)

  const handleRowDraftChange = (rowId, value) => {
    const serverValue = serverDraftSnapshot.rowDrafts[rowId] ?? ''
    if (areMoneyDraftValuesEquivalent(value, serverValue)) {
      dirtyRowIdsRef.current.delete(rowId)
    } else {
      dirtyRowIdsRef.current.add(rowId)
    }

    setRowDrafts((current) => ({
      ...current,
      [rowId]: value,
    }))
  }


  const handleSaveOverall = async (event) => {
    event.preventDefault()
    if (isSampleMode || savingTarget) return

    const nextLimit = normalizeMoneyDraftForSave(overallDraft)
    if (nextLimit == null) return

    setSavingTarget('overall')
    try {
      await apiPost(
        '/api/budget',
        { month: activeMonth, monthly_limit: nextLimit },
        { accessToken: session.accessToken }
      )
      const savedDraft = formatMoneyDraftValue(nextLimit)
      setLiveState((current) => {
        if (current.month !== activeMonth) return current

        return {
          ...current,
          config: {
            month: activeMonth,
            monthly_limit: nextLimit,
            category_budgets: current.config?.category_budgets ?? [],
          },
        }
      })
      overallDraftRef.current = savedDraft
      setOverallDraft(savedDraft)
      isOverallDirtyRef.current = false
      notifyDataChanged()
      setFeedback({
        tone: 'success',
        message: `Overall monthly cap updated for ${formatMonthPeriod(activeMonth)}.`,
      })
      handleRetry()
    } catch (error) {
      if (handleAuthError(error, router)) return

      setFeedback({
        tone: 'warning',
        message: getErrorMessage(error),
      })
    } finally {
      setSavingTarget('')
    }
  }

  const handleSaveCategory = async (row) => {
    if (isSampleMode || savingTarget || !row.isEditable) return

    const draftValue = rowDrafts[row.id]
    const nextLimit = normalizeMoneyDraftForSave(draftValue)
    if (nextLimit == null) return

    setSavingTarget(row.id)
    try {
      await apiPost(
        '/api/budget',
        {
          month: activeMonth,
          category_budgets: [{ category_id: row.categoryId, monthly_limit: nextLimit }],
        },
        { accessToken: session.accessToken }
      )
      const savedDraft = formatMoneyDraftValue(nextLimit)
      setLiveState((current) => {
        if (current.month !== activeMonth) return current

        const currentBudgets = current.config?.category_budgets ?? []
        const nextBudget = {
          category_id: row.categoryId,
          category_name: row.categoryName,
          category_icon: row.categoryIcon,
          monthly_limit: nextLimit,
        }
        const budgetExists = currentBudgets.some((budget) => budget.category_id === row.categoryId)
        const categoryBudgets = budgetExists
          ? currentBudgets.map((budget) => (
            budget.category_id === row.categoryId
              ? { ...budget, ...nextBudget }
              : budget
          ))
          : [...currentBudgets, nextBudget]

        return {
          ...current,
          config: {
            month: activeMonth,
            monthly_limit: current.config?.monthly_limit ?? null,
            category_budgets: categoryBudgets,
          },
        }
      })
      dirtyRowIdsRef.current.delete(row.id)
      rowDraftsRef.current = {
        ...rowDraftsRef.current,
        [row.id]: savedDraft,
      }
      setRowDrafts((current) => ({
        ...current,
        [row.id]: savedDraft,
      }))
      notifyDataChanged()
      setFeedback({
        tone: 'success',
        message: `${row.categoryName} plan saved for ${formatMonthPeriod(activeMonth)}.`,
      })
      handleRetry()
    } catch (error) {
      if (handleAuthError(error, router)) return

      setFeedback({
        tone: 'warning',
        message: getErrorMessage(error),
      })
    } finally {
      setSavingTarget('')
    }
  }

  const handleCopyLastMonth = async () => {
    if (copyState.disabled || copyingMonth || isSampleMode) return

    const payload = buildCopyLastMonthPayload(activeMonth, previousConfig, activeConfig)
    if (!payload) {
      setFeedback({
        tone: 'warning',
        message: 'There was no safe planner data to copy from last month.',
      })
      return
    }

    setCopyingMonth(true)
    try {
      await apiPost('/api/budget', payload, { accessToken: session.accessToken })
      notifyDataChanged()
      setFeedback({
        tone: 'success',
        message: `Copied the ${formatMonthPeriod(previousMonth)} plan into ${formatMonthPeriod(activeMonth)}.`,
      })
      handleRetry()
    } catch (error) {
      if (handleAuthError(error, router)) return

      setFeedback({
        tone: 'warning',
        message: getErrorMessage(error),
      })
    } finally {
      setCopyingMonth(false)
    }
  }

  return (
    <section className="app-screen planner-screen screen-rise">
      <div className="planner-screen__masthead">
        <div className="screen-heading">
          <h1 className="screen-heading__title">Planner</h1>
        </div>
        <span className={`screen-chip screen-chip--${isSampleMode ? 'sample' : 'live'}`}>
          {isSampleMode ? 'Sample' : 'Live'}
        </span>
      </div>

      <div className="screen-topline screen-topline--month planner-topline">
        <div className="month-switcher" role="group" aria-label="Planner month">
          <button
            aria-label={`Go to ${formatMonthLabel(previousMonth)}`}
            className="month-switcher__button"
            disabled={isSampleMode}
            onClick={() => setSelectedMonth((value) => getPlannerAdjacentMonths(value).previousMonth || value)}
            type="button"
          >
            <span aria-hidden="true">&lt;</span>
          </button>
          <div className="month-switcher__copy">
            <span className="period-chip__label">Selected month</span>
            <strong>{formatMonthLabel(activeMonth)}</strong>
          </div>
          <button
            aria-label={`Go to ${formatMonthLabel(nextMonth)}`}
            className="month-switcher__button"
            disabled={isSampleMode}
            onClick={() => setSelectedMonth((value) => getPlannerAdjacentMonths(value).nextMonth || value)}
            type="button"
          >
            <span aria-hidden="true">&gt;</span>
          </button>
        </div>
      </div>

      <LiveNotice message={isLiveMonthCurrent ? liveState.message : ''} onRetry={handleRetry} />
      <PlannerFeedback feedback={feedback} />

      <article className="planner-summary">
        <div className="planner-summary__header">
          <div>
            <span className="period-chip__label">Plan vs actual</span>
            <h2>{formatMonthPeriod(activeMonth)}</h2>
            {isSampleMode ? (
              <p>Compare your saved category plan to this month&apos;s live spending.</p>
            ) : null}
          </div>

          <div className="planner-summary__actions">
            <button
              className="button-secondary"
              disabled={copyState.disabled || copyingMonth}
              onClick={handleCopyLastMonth}
              type="button"
            >
              {copyingMonth ? 'Copying...' : 'Copy last month'}
            </button>
            <small>{copyState.reason}</small>
          </div>
        </div>

        <div className="planner-summary__health">
          <article className={`planner-health-card planner-health-card--${overallBudgetHealth.tone}`}>
            <span className="planner-health-card__label">Monthly budget health</span>
            <strong>{overallBudgetHealth.label}</strong>
            <p>{overallBudgetHealth.primaryValue}</p>
            <small>{overallBudgetHealth.progressNote}</small>
          </article>
          <article className={`planner-health-card planner-health-card--${financialHealth.tone}`}>
            <span className="planner-health-card__label">Financial health</span>
            <strong>{financialHealth.label}</strong>
            <p>{financialHealth.valueText}</p>
            <small>{financialHealth.detailText}</small>
          </article>
        </div>

        <div className="planner-summary__stats">
          <article className="planner-metric">
            <span>Category plan</span>
            <strong>{formatCurrency(plannerSummary.plannedTotal)}</strong>
            {isSampleMode ? <small>Saved category budgets for this month.</small> : null}
          </article>
          <article className="planner-metric">
            <span>Actual spend</span>
            <strong>{actualSpendValue}</strong>
            {isSampleMode ? <small>{actualSpendCopy}</small> : null}
          </article>
          <article className={`planner-metric planner-metric--${planDeltaTone}`}>
            <span>Plan delta</span>
            <strong>{planDeltaValue}</strong>
            {isSampleMode ? <small>How the category plan compares to actual spending.</small> : null}
          </article>
        </div>

        <form className="planner-summary__form" onSubmit={handleSaveOverall}>
          <label className="planner-summary__field">
            <span>Overall monthly cap</span>
            <input
              className="input-field"
              disabled={isSampleMode}
              inputMode="decimal"
              min="0.01"
              onChange={(event) => {
                const nextValue = event.target.value
                isOverallDirtyRef.current = !areMoneyDraftValuesEquivalent(nextValue, serverDraftSnapshot.overallDraft)
                setOverallDraft(nextValue)
              }}
              placeholder="e.g. 2500"
              step="0.01"
              type="number"
              value={overallDraft}
            />
          </label>

          <div className={`planner-summary__form-copy planner-summary__form-copy--${overallCapTone}`}>
            <strong>{plannerSummary.overallLimit == null ? 'No overall cap set' : formatCurrency(plannerSummary.overallLimit)}</strong>
            <small>{overallCapLabel}</small>
          </div>

          <button
            className="button-primary"
            disabled={
              isSampleMode
              || savingTarget === 'overall'
              || normalizedOverallDraft == null
              || normalizedOverallDraft === normalizedOverallLimit
            }
            type="submit"
          >
            {savingTarget === 'overall' ? 'Saving...' : plannerSummary.overallLimit == null ? 'Save cap' : 'Update cap'}
          </button>
        </form>
      </article>

      <section className="section-block planner-section">
        <div className="section-headline">
          <h2>Category progress</h2>
          {isSampleMode ? (
            <span className="planner-section__caption">Budgeted, spent, remaining, and visible status per category.</span>
          ) : null}
        </div>

        {plannerRows.length ? (
          <div className="planner-rows">
            {plannerRows.map((row) => {
              const visual = getCategoryVisual(row.categoryName)
              const rowDraft = rowDrafts[row.id] ?? ''
              const normalizedRowDraft = normalizeMoneyDraftForSave(rowDraft)
              const normalizedPlannedAmount = normalizeMoneyDraftForSave(row.plannedAmount)
              const hasValidDraft = normalizedRowDraft != null
              const isUnchanged = hasValidDraft
                && normalizedPlannedAmount != null
                && normalizedRowDraft === normalizedPlannedAmount
              const remainingLabel = row.spentAmount == null
                ? actualSpendState === 'loading'
                  ? 'Waiting for actual spend'
                  : 'Actual spend unavailable'
                : row.remainingAmount == null
                  ? 'Not set'
                  : row.remainingAmount >= 0
                    ? `${formatCurrency(row.remainingAmount)} left`
                    : `${formatCurrency(Math.abs(row.remainingAmount))} over`
              const progressAccessibilityProps = row.spentAmount == null
                ? {
                  'aria-label': `${row.categoryName} budget progress`,
                  'aria-valuemin': 0,
                  'aria-valuemax': 100,
                  'aria-valuetext': actualSpendState === 'loading'
                    ? `${row.categoryName} actual spend is loading`
                    : `${row.categoryName} actual spend is unavailable`,
                }
                : {
                  'aria-label': `${row.categoryName} budget progress`,
                  'aria-valuemin': 0,
                  'aria-valuemax': 100,
                  'aria-valuenow': Math.round(row.progressPercentage),
                  'aria-valuetext': row.plannedAmount == null
                    ? `${formatCurrency(row.spentAmount)} spent without a saved plan`
                    : `${Math.round(row.progressPercentage)} percent used, ${remainingLabel}`,
                }

              return (
                <article className={`planner-row planner-row--${row.statusTone}`} key={row.id}>
                  <div className="planner-row__top">
                    <div className="planner-row__main">
                      <div
                        className="planner-row__icon"
                        style={{
                          '--planner-color': visual.color,
                          '--planner-soft': visual.soft,
                        }}
                      >
                        <span>{row.categoryIcon || visual.symbol}</span>
                      </div>
                      <div className="planner-row__copy">
                        <strong>{row.categoryName}</strong>
                      </div>
                    </div>

                    <span className={`planner-status planner-status--${row.statusTone}`}>{row.statusLabel}</span>
                  </div>

                  <div className="planner-row__metrics">
                    <div>
                      <span>Planned</span>
                      <strong>{row.plannedAmount == null ? 'Not set' : formatCurrency(row.plannedAmount)}</strong>
                    </div>
                    <div>
                      <span>Actual</span>
                      <strong>{row.spentAmount == null ? actualSpendValue : formatCurrency(row.spentAmount)}</strong>
                    </div>
                    <div>
                      <span>Remaining</span>
                      <strong>{row.remainingText}</strong>
                    </div>
                  </div>

                  <div className="planner-row__progress">
                    <div
                      className="planner-row__progress-track"
                      role="progressbar"
                      {...progressAccessibilityProps}
                    >
                      <span
                        className={`planner-row__progress-fill planner-row__progress-fill--${row.statusTone}`}
                        style={{ width: `${row.progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="planner-row__editor">
                    <label className="planner-row__field">
                      <span>{row.isEditable ? 'Plan amount ($)' : 'Plan amount'}</span>
                      <input
                        className="input-field"
                        disabled={isSampleMode || !row.isEditable}
                        inputMode="decimal"
                        min="0.01"
                        onChange={(event) => handleRowDraftChange(row.id, event.target.value)}
                        placeholder={row.isEditable ? 'e.g. 250' : 'Read-only'}
                        step="0.01"
                        type="number"
                        value={rowDraft}
                      />
                    </label>

                    <button
                      className="button-secondary"
                      disabled={
                        isSampleMode
                        || !row.isEditable
                        || savingTarget === row.id
                        || !hasValidDraft
                        || isUnchanged
                      }
                      onClick={() => handleSaveCategory(row)}
                      type="button"
                    >
                      {savingTarget === row.id ? 'Saving...' : row.hasSavedPlan ? 'Save update' : 'Save plan'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="blank-state">
            <strong>No planner categories yet</strong>
            <span>Once categories are available, this month&apos;s planning rows will show up here.</span>
          </div>
        )}
      </section>
    </section>
  )
}

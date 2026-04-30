'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataChanged, useDataMode } from '@/components/providers'
import { ApiError, apiGet, apiPost } from '@/lib/apiClient'
import { DEMO_MONTH, demoBudgetSummary, demoCategoryBudgets, demoSavingsGoals } from '@/lib/demoData'
import { getCategoryPresentation } from '@/lib/financeVisuals'
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
import {
  getSavingsGoalAvatar,
  getSavingsGoalStatusLabel,
  getSavingsGoalStatusReason,
  getSavingsGoalStatusTone,
} from '@/lib/savingsGoalStatus'

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

const GOAL_ICON_OPTIONS = [
  { icon: '\u{1F6E1}\uFE0F', label: 'Emergency' },
  { icon: '\u2708\uFE0F', label: 'Travel' },
  { icon: '\u{1F3E0}', label: 'Home' },
  { icon: '\u{1F697}', label: 'Car' },
  { icon: '\u{1F381}', label: 'Gift' },
  { icon: '\u{1F393}', label: 'Education' },
  { icon: '\u{1FA7A}', label: 'Medical' },
  { icon: '\u{1F48D}', label: 'Wedding' },
  { icon: '\u{1F4BB}', label: 'Laptop' },
  { icon: '\u{1F43E}', label: 'Pet' },
  { icon: '\u{1F4E6}', label: 'Moving' },
  { icon: '\u{1F3D6}\uFE0F', label: 'Vacation' },
  { icon: '\u{1F527}', label: 'Repair' },
  { icon: '\u{1F37C}', label: 'Family' },
  { icon: '\u{1F4B5}', label: 'Savings' },
  { icon: '\u{1F9F0}', label: 'Tools' },
  { icon: '\u{1F6B2}', label: 'Bike' },
  { icon: '\u{1F4F7}', label: 'Camera' },
  { icon: '\u{1F3B5}', label: 'Concert' },
  { icon: '\u{1FA91}', label: 'Furniture' },
  { icon: '\u{1F476}', label: 'Baby' },
  { icon: '\u{1F384}', label: 'Holiday' },
  { icon: '\u{1F9FE}', label: 'Taxes' },
  { icon: '\u{1F4AA}', label: 'Fitness' },
]

const GOAL_FORM_CLOSE_MS = 230
const GOAL_ICON_PICKER_CLOSE_MS = 140

function getMotionSafeDuration(duration) {
  if (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 0
  }

  return duration
}

function getGoalFormDefaults(goal = null) {
  return {
    name: goal?.name ?? '',
    icon: goal?.icon ?? '',
    target_amount: goal?.target_amount ?? '',
    current_amount: goal?.current_amount ?? '0.00',
    target_date: goal?.target_date ?? '',
  }
}

export default function PlannerView() {
  const router = useRouter()
  const { isReady, logout, session } = useAuth()
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
    savingsGoals: null,
    previousConfig: undefined,
    previousConfigStatus: 'loading',
  })
  const [rowDrafts, setRowDrafts] = useState({})
  const [overallDraft, setOverallDraft] = useState('')
  const [savingTarget, setSavingTarget] = useState('')
  const [copyingMonth, setCopyingMonth] = useState(false)
  const [goalFormMode, setGoalFormMode] = useState('closed')
  const [isGoalFormClosing, setIsGoalFormClosing] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [goalDraft, setGoalDraft] = useState(getGoalFormDefaults)
  const [isGoalIconPickerOpen, setIsGoalIconPickerOpen] = useState(false)
  const [isGoalIconPickerClosing, setIsGoalIconPickerClosing] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [archivingGoalId, setArchivingGoalId] = useState('')
  const [goalFormError, setGoalFormError] = useState('')
  const [feedback, setFeedback] = useState(null)
  const hydratedMonthRef = useRef(null)
  const dirtyRowIdsRef = useRef(new Set())
  const isOverallDirtyRef = useRef(false)
  const rowDraftsRef = useRef({})
  const overallDraftRef = useRef('')
  const goalIconPickerRef = useRef(null)
  const goalIconButtonRef = useRef(null)
  const goalCtaRef = useRef(null)
  const goalFormCloseTimerRef = useRef(null)
  const goalIconPickerCloseTimerRef = useRef(null)
  const isGoalFormClosingRef = useRef(false)
  const isGoalIconPickerClosingRef = useRef(false)
  const shouldFocusGoalCtaAfterCloseRef = useRef(false)

  const activeMonth = isSampleMode ? DEMO_MONTH : selectedMonth

  const finishGoalIconPickerClose = () => {
    if (!isGoalIconPickerClosingRef.current) return
    window.clearTimeout(goalIconPickerCloseTimerRef.current)
    isGoalIconPickerClosingRef.current = false
    setIsGoalIconPickerClosing(false)
  }

  const openGoalIconPicker = () => {
    window.clearTimeout(goalIconPickerCloseTimerRef.current)
    isGoalIconPickerClosingRef.current = false
    setIsGoalIconPickerClosing(false)
    setIsGoalIconPickerOpen(true)
  }

  const closeGoalIconPicker = ({ focusButton = false } = {}) => {
    if (!isGoalIconPickerOpen && !isGoalIconPickerClosingRef.current) return
    if (focusButton) goalIconButtonRef.current?.focus()

    window.clearTimeout(goalIconPickerCloseTimerRef.current)
    setIsGoalIconPickerOpen(false)
    isGoalIconPickerClosingRef.current = true
    setIsGoalIconPickerClosing(true)
    goalIconPickerCloseTimerRef.current = window.setTimeout(
      finishGoalIconPickerClose,
      getMotionSafeDuration(GOAL_ICON_PICKER_CLOSE_MS)
    )
  }

  const toggleGoalIconPicker = () => {
    if (isGoalIconPickerOpen) {
      closeGoalIconPicker({ focusButton: true })
      return
    }

    openGoalIconPicker()
  }

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
          savingsGoals: isSameMonthReload ? current.savingsGoals : null,
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
        apiGet(`/api/savings-goals?month=${encodeURIComponent(selectedMonth)}`, {
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
        savingsGoals: results[4].status === 'fulfilled' ? results[4].value : null,
      })
    }

    loadPlanner().catch((error) => {
      if (controller.signal.aborted) return

      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }

      setLiveState({
        month: selectedMonth,
        status: 'error',
        message: getErrorMessage(error),
        categories: [],
        config: null,
        summary: null,
        savingsGoals: null,
        previousConfig: null,
        previousConfigStatus: 'unavailable',
      })
    })

    return () => controller.abort()
  }, [isReady, isSampleMode, logout, reloadToken, router, selectedMonth, session?.accessToken])

  useEffect(() => {
    if (!isGoalIconPickerOpen) return undefined

    const handlePointerDown = (event) => {
      if (!goalIconPickerRef.current?.contains(event.target)) {
        closeGoalIconPicker()
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeGoalIconPicker({ focusButton: true })
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isGoalIconPickerOpen])

  const isLiveMonthCurrent = isSampleMode || liveState.month === selectedMonth
  const activeCategories = isSampleMode ? buildSampleCategories() : (isLiveMonthCurrent ? liveState.categories : [])
  const activeConfig = isSampleMode ? buildSampleConfig() : (isLiveMonthCurrent ? liveState.config : null)
  const activeSummary = isSampleMode ? demoBudgetSummary : (isLiveMonthCurrent ? liveState.summary : null)
  const activeSavingsGoals = isSampleMode ? demoSavingsGoals : (isLiveMonthCurrent ? liveState.savingsGoals : null)
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
    isGoalFormClosingRef.current = isGoalFormClosing
  }, [isGoalFormClosing])

  useEffect(() => {
    isGoalIconPickerClosingRef.current = isGoalIconPickerClosing
  }, [isGoalIconPickerClosing])

  useEffect(() => () => {
    window.clearTimeout(goalFormCloseTimerRef.current)
    window.clearTimeout(goalIconPickerCloseTimerRef.current)
  }, [])

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
  const goalRows = activeSavingsGoals?.goals ?? []
  const goalSummary = activeSavingsGoals?.summary ?? {
    active_count: 0,
    target_total: '0.00',
    current_total: '0.00',
    remaining_total: '0.00',
    monthly_required_total: '0.00',
    available_after_goal_contributions: null,
    pressure_level: 'none',
  }
  const goalsAvailability = isSampleMode || activeSavingsGoals
    ? 'ready'
    : !isLiveMonthCurrent || liveState.status === 'loading'
      ? 'loading'
      : 'unavailable'
  const goalFormOpen = goalFormMode !== 'closed'
  const goalFormRendered = goalFormOpen || isGoalFormClosing
  const goalFormInteractive = goalFormOpen && !isGoalFormClosing
  const goalIconPickerRendered = isGoalIconPickerOpen || isGoalIconPickerClosing
  const isGoalDraftValid = goalDraft.name.trim()
    && Number(goalDraft.target_amount) > 0
    && Number(goalDraft.current_amount) >= 0
    && goalDraft.target_date

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

  const handleAuthError = () => {
    logout()
    router.replace('/login')
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
      if (error instanceof ApiError && error.status === 401) {
        handleAuthError()
        return
      }

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
        message: `${getCategoryPresentation({
          name: row.categoryName,
          icon: row.categoryIcon,
          kind: 'expense',
        }).label} plan saved for ${formatMonthPeriod(activeMonth)}.`,
      })
      handleRetry()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleAuthError()
        return
      }

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
      if (error instanceof ApiError && error.status === 401) {
        handleAuthError()
        return
      }

      setFeedback({
        tone: 'warning',
        message: getErrorMessage(error),
      })
    } finally {
      setCopyingMonth(false)
    }
  }

  const finishGoalFormClose = () => {
    if (!isGoalFormClosingRef.current) return

    window.clearTimeout(goalFormCloseTimerRef.current)
    isGoalFormClosingRef.current = false
    setIsGoalFormClosing(false)
    setGoalFormMode('closed')
    setEditingGoal(null)
    setGoalDraft(getGoalFormDefaults())
    setGoalFormError('')
    window.clearTimeout(goalIconPickerCloseTimerRef.current)
    isGoalIconPickerClosingRef.current = false
    setIsGoalIconPickerOpen(false)
    setIsGoalIconPickerClosing(false)

    if (shouldFocusGoalCtaAfterCloseRef.current) {
      shouldFocusGoalCtaAfterCloseRef.current = false
      goalCtaRef.current?.focus()
    }
  }

  const closeGoalForm = ({ focusCta = true } = {}) => {
    if (!goalFormOpen || isGoalFormClosingRef.current) return

    window.clearTimeout(goalFormCloseTimerRef.current)
    shouldFocusGoalCtaAfterCloseRef.current = focusCta
    closeGoalIconPicker()
    isGoalFormClosingRef.current = true
    setIsGoalFormClosing(true)
    goalFormCloseTimerRef.current = window.setTimeout(
      finishGoalFormClose,
      getMotionSafeDuration(GOAL_FORM_CLOSE_MS)
    )
  }

  const openCreateGoalForm = () => {
    if (goalFormOpen && !isGoalFormClosingRef.current) {
      closeGoalForm()
      return
    }

    window.clearTimeout(goalFormCloseTimerRef.current)
    isGoalFormClosingRef.current = false
    shouldFocusGoalCtaAfterCloseRef.current = false
    setIsGoalFormClosing(false)
    setEditingGoal(null)
    setGoalDraft(getGoalFormDefaults())
    setGoalFormError('')
    closeGoalIconPicker()
    setGoalFormMode('create')
  }

  const openEditGoalForm = (goal) => {
    window.clearTimeout(goalFormCloseTimerRef.current)
    isGoalFormClosingRef.current = false
    shouldFocusGoalCtaAfterCloseRef.current = false
    setIsGoalFormClosing(false)
    setEditingGoal(goal)
    setGoalDraft(getGoalFormDefaults(goal))
    setGoalFormError('')
    closeGoalIconPicker()
    setGoalFormMode('edit')
  }

  const handleSaveGoal = async (event) => {
    event.preventDefault()
    if (isSampleMode || savingGoal || !isGoalDraftValid || !goalFormInteractive) return

    setSavingGoal(true)
    setGoalFormError('')
    try {
      const payload = {
        name: goalDraft.name,
        target_amount: Number(goalDraft.target_amount),
        current_amount: Number(goalDraft.current_amount || 0),
        target_date: goalDraft.target_date,
        icon: goalDraft.icon || null,
      }
      await apiPost(
        goalFormMode === 'edit' ? '/api/savings-goals/update' : '/api/savings-goals',
        goalFormMode === 'edit' ? { goal_id: editingGoal.id, month: selectedMonth, ...payload } : { month: selectedMonth, ...payload },
        { accessToken: session.accessToken }
      )
      notifyDataChanged()
      setFeedback({
        tone: 'success',
        message: goalFormMode === 'edit' ? 'Savings goal updated.' : 'Savings goal created.',
      })
      closeGoalForm()
      handleRetry()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleAuthError()
        return
      }
      setFeedback({
        tone: 'warning',
        message: error instanceof ApiError ? error.message : 'The savings goal could not be saved.',
      })
      setGoalFormError(error instanceof ApiError ? error.message : 'The savings goal could not be saved. Check the fields and try again.')
    } finally {
      setSavingGoal(false)
    }
  }

  const handleArchiveGoal = async (goal) => {
    if (isSampleMode || archivingGoalId) return
    setArchivingGoalId(goal.id)
    try {
      await apiPost('/api/savings-goals/archive', { goal_id: goal.id }, { accessToken: session.accessToken })
      notifyDataChanged()
      setFeedback({ tone: 'success', message: `${goal.name} archived.` })
      handleRetry()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleAuthError()
        return
      }
      setFeedback({
        tone: 'warning',
        message: error instanceof ApiError ? error.message : 'The savings goal could not be archived.',
      })
    } finally {
      setArchivingGoalId('')
    }
  }

  return (
    <section className="app-screen planner-screen">
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

      <section className="section-block savings-goals">
        <div className="section-headline savings-goals__headline">
          <div>
            <h2>Savings goals</h2>
            {isSampleMode ? (
              <span className="planner-section__caption">Sample goals show how target dates affect monthly room.</span>
            ) : null}
          </div>
          <button
            aria-expanded={goalFormInteractive}
            className="button-primary savings-goals__cta"
            disabled={isSampleMode}
            onClick={openCreateGoalForm}
            ref={goalCtaRef}
            type="button"
          >
            <span aria-hidden="true">+</span>
            Add goal
          </button>
        </div>

        <div className={`savings-goals__summary savings-goals__summary--${getSavingsGoalStatusTone(goalSummary.pressure_level)}`}>
          <article>
            <span>Active goals</span>
            <strong>{goalSummary.active_count ?? 0}</strong>
          </article>
          <article>
            <span>Total saved</span>
            <strong>{formatCurrency(goalSummary.current_total)}</strong>
          </article>
          <article>
            <span>Remaining</span>
            <strong>{formatCurrency(goalSummary.remaining_total)}</strong>
          </article>
          <article>
            <span>Monthly needed</span>
            <strong>{formatCurrency(goalSummary.monthly_required_total)}</strong>
          </article>
          <article>
            <span>After goals</span>
            <strong>{goalSummary.available_after_goal_contributions == null ? 'No budget' : formatCurrency(goalSummary.available_after_goal_contributions)}</strong>
          </article>
        </div>

        {goalFormRendered ? (
          <div
            className={`savings-goal-form-shell${isGoalFormClosing ? ' savings-goal-form-shell--closing' : ''}`}
            data-state={isGoalFormClosing ? 'closing' : 'open'}
            onTransitionEnd={(event) => {
              if (
                event.currentTarget === event.target
                && (!event.propertyName || event.propertyName === 'grid-template-rows')
              ) {
                finishGoalFormClose()
              }
            }}
          >
            <form
              className={`savings-goal-form${isGoalFormClosing ? ' savings-goal-form--closing' : ''}`}
              onSubmit={handleSaveGoal}
            >
              <div className="savings-goal-form__header">
                <div className="savings-goal-form__icon" ref={goalIconPickerRef}>
                  <button
                    aria-expanded={isGoalIconPickerOpen && !isGoalIconPickerClosing}
                    aria-label="Choose goal icon"
                    className="savings-goal__avatar savings-goal__avatar--form savings-goal__avatar--button"
                    onClick={toggleGoalIconPicker}
                    ref={goalIconButtonRef}
                    type="button"
                  >
                    {getSavingsGoalAvatar({ name: goalDraft.name || 'Savings goal', icon: goalDraft.icon }, { semanticFallbacks: true })}
                  </button>
                  {goalIconPickerRendered ? (
                    <div
                      aria-hidden={isGoalIconPickerClosing ? 'true' : undefined}
                      aria-label="Goal icons"
                      className={`savings-goal-icon-picker${isGoalIconPickerClosing ? ' savings-goal-icon-picker--closing' : ''}`}
                      data-state={isGoalIconPickerClosing ? 'closing' : 'open'}
                      onAnimationEnd={(event) => {
                        if (event.currentTarget === event.target) finishGoalIconPickerClose()
                      }}
                      role="group"
                    >
                      {GOAL_ICON_OPTIONS.map((option) => (
                        <button
                          aria-label={`Use ${option.label} icon`}
                          aria-pressed={goalDraft.icon === option.icon}
                          className={goalDraft.icon === option.icon ? 'is-selected' : ''}
                          key={option.icon}
                          onClick={() => {
                            setGoalDraft((current) => ({ ...current, icon: option.icon }))
                            closeGoalIconPicker({ focusButton: true })
                          }}
                          title={option.label}
                          type="button"
                        >
                          <span className="savings-goal-icon-picker__glyph" aria-hidden="true">{option.icon}</span>
                        </button>
                      ))}
                      <button
                        aria-label="Use initials icon"
                        aria-pressed={!goalDraft.icon}
                        className={!goalDraft.icon ? 'is-selected' : ''}
                        onClick={() => {
                          setGoalDraft((current) => ({ ...current, icon: '' }))
                          closeGoalIconPicker({ focusButton: true })
                        }}
                        title="Initials"
                        type="button"
                      >
                        <span className="savings-goal-icon-picker__glyph" aria-hidden="true">Aa</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div>
                  <span className="period-chip__label">{formatMonthPeriod(activeMonth)}</span>
                  <h3>{goalFormMode === 'edit' ? 'Edit savings goal' : 'Add savings goal'}</h3>
                  <p>Set the target, what you have saved, and when you want to get there.</p>
                </div>
              </div>

              {goalFormError ? (
                <div className="inline-error" role="alert">{goalFormError}</div>
              ) : null}

              <div className="savings-goal-form__grid">
                <label className="entry-sheet__field">
                  <span>Goal name</span>
                  <input
                    className="input-field"
                    maxLength={80}
                    onChange={(event) => setGoalDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Emergency cushion"
                    type="text"
                    value={goalDraft.name}
                  />
                </label>
                <label className="entry-sheet__field">
                  <span>Target amount ($)</span>
                  <input
                    className="input-field"
                    inputMode="decimal"
                    min="0.01"
                    onChange={(event) => setGoalDraft((current) => ({ ...current, target_amount: event.target.value }))}
                    step="0.01"
                    type="number"
                    value={goalDraft.target_amount}
                  />
                </label>
                <label className="entry-sheet__field">
                  <span>Current saved ($)</span>
                  <input
                    className="input-field"
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setGoalDraft((current) => ({ ...current, current_amount: event.target.value }))}
                    step="0.01"
                    type="number"
                    value={goalDraft.current_amount}
                  />
                </label>
                <label className="entry-sheet__field">
                  <span>Target date</span>
                  <input
                    className="input-field"
                    onChange={(event) => setGoalDraft((current) => ({ ...current, target_date: event.target.value }))}
                    type="date"
                    value={goalDraft.target_date}
                  />
                </label>
              </div>

              <div className="savings-goal-form__footer">
                <span>Monthly need is calculated against the selected month&apos;s budget context after saving.</span>
                <div className="savings-goal-form__actions">
                  <button className="button-secondary" disabled={savingGoal} onClick={() => closeGoalForm()} type="button">
                    Cancel
                  </button>
                  <button className="button-primary" disabled={savingGoal || !isGoalDraftValid || !goalFormInteractive} type="submit">
                    {savingGoal ? 'Saving...' : goalFormMode === 'edit' ? 'Save goal' : 'Create goal'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}

        {goalsAvailability === 'loading' ? (
          <div className="blank-state blank-state--compact">
            <strong>Loading savings goals</strong>
            <span>Goal progress will appear with this month&apos;s budget context.</span>
          </div>
        ) : goalRows.length ? (
          <div className="savings-goals__list">
            {goalRows.map((goal) => {
              const status = goal.budget_context?.status ?? 'ready'
              const tone = getSavingsGoalStatusTone(status)
              return (
                <article className={`savings-goal savings-goal--${tone}`} key={goal.id}>
                  <div className="savings-goal__top">
                    <div className="savings-goal__identity">
                      <div className="savings-goal__avatar" aria-hidden="true">{getSavingsGoalAvatar(goal, { semanticFallbacks: true })}</div>
                      <div>
                        <strong>{goal.name}</strong>
                        <span>Target {formatMonthPeriod(goal.target_date)}</span>
                        <small>{getSavingsGoalStatusReason(goal)}</small>
                      </div>
                    </div>
                    <span className={`planner-status planner-status--${tone} savings-goal__status`}>{getSavingsGoalStatusLabel(status)}</span>
                  </div>
                  <div
                    aria-label={`${goal.name} savings progress`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={Math.round(goal.progress_percentage ?? 0)}
                    aria-valuetext={`${Math.round(goal.progress_percentage ?? 0)}% saved`}
                    className="savings-goal__progress"
                    role="progressbar"
                  >
                    <span style={{ width: `${Math.min(Number(goal.progress_percentage ?? 0), 100)}%` }} />
                  </div>
                  <div className="savings-goal__metrics">
                    <div><span>Saved</span><strong>{formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}</strong></div>
                    <div><span>Monthly</span><strong>{formatCurrency(goal.monthly_required)}</strong></div>
                    <div><span>Left</span><strong>{formatCurrency(goal.remaining_amount)}</strong></div>
                  </div>
                  <div className="savings-goal__actions">
                    <button className="button-secondary" disabled={isSampleMode} onClick={() => openEditGoalForm(goal)} type="button">
                      Edit
                    </button>
                    <button className="button-secondary" disabled={isSampleMode || archivingGoalId === goal.id} onClick={() => handleArchiveGoal(goal)} type="button">
                      {archivingGoalId === goal.id ? 'Archiving...' : 'Archive'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="blank-state">
            <strong>No savings goals yet</strong>
            <span>Add a goal to see how target dates and monthly contributions fit with this month&apos;s budget.</span>
          </div>
        )}
      </section>

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
              const presentation = getCategoryPresentation({
                name: row.categoryName,
                icon: row.categoryIcon,
                kind: 'expense',
              })
              const rowDraft = rowDrafts[row.id] ?? ''
              const normalizedRowDraft = normalizeMoneyDraftForSave(rowDraft)
              const normalizedPlannedAmount = normalizeMoneyDraftForSave(row.plannedAmount)
              const hasValidDraft = normalizedRowDraft != null
              const isUnchanged = hasValidDraft
                && normalizedPlannedAmount != null
                && normalizedRowDraft === normalizedPlannedAmount
              const progressAccessibilityProps = row.spentAmount == null
                ? {
                    'aria-label': `${presentation.label} budget progress`,
                    'aria-valuemin': 0,
                    'aria-valuemax': 100,
                    'aria-valuetext': row.progressAriaValueText,
                  }
                : {
                    'aria-label': `${presentation.label} budget progress`,
                    'aria-valuemin': 0,
                    'aria-valuemax': 100,
                    'aria-valuenow': Math.round(row.progressPercentage),
                    'aria-valuetext': row.progressAriaValueText,
                  }

              return (
                <article className={`planner-row planner-row--${row.statusTone}`} key={row.id}>
                  <div className="planner-row__top">
                    <div className="planner-row__main">
                      <div
                        className="planner-row__icon"
                        style={{
                          '--planner-color': presentation.color,
                          '--planner-soft': presentation.soft,
                        }}
                      >
                        <span>{presentation.symbol}</span>
                      </div>
                      <div className="planner-row__copy">
                        <strong>{presentation.label}</strong>
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

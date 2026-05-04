'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode } from '@/components/providers'
import { ApiError, apiGet } from '@/lib/apiClient'
import { DEMO_MONTH, demoInsightsSnapshot, demoSavingsGoals } from '@/lib/demoData'
import {
  formatCurrency,
  formatLongDate,
  formatMonthLabel,
  formatPercentage,
  formatShortDate,
  getCurrentMonthStart,
  shiftMonth,
} from '@/lib/financeUtils'
import AllocationBar from '@/components/ui/AllocationBar'
import CategoryProgressRow from '@/components/ui/CategoryProgressRow'
import CategoryTransactionsModal from '@/components/ui/CategoryTransactionsModal'
import PaceVsLastMonthChart from '@/components/ui/PaceVsLastMonthChart'
import TransactionDetailSheet from '@/components/ui/TransactionDetailSheet'

const DONUT_VIEWBOX = 520
const DONUT_CENTER = DONUT_VIEWBOX / 2
const DONUT_RADIUS = 164
const DONUT_STROKE_WIDTH = 42
const DONUT_OUTER_RADIUS = DONUT_RADIUS + (DONUT_STROKE_WIDTH / 2)
const DONUT_MARKER_RADIUS = DONUT_OUTER_RADIUS + 42

const CASHFLOW_WIDTH = 560
const CASHFLOW_HEIGHT = 344
const CASHFLOW_INSET_X = 32
const CASHFLOW_INSET_TOP = 24
const CASHFLOW_INSET_BOTTOM = 52
const CASHFLOW_BASELINE_RATIO = 0.53

const CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const RHYTHM_TICK_DAYS = [1, 7, 14, 21, 28]

function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'The live insights snapshot is not available right now.'
}

export function getActiveBreakdownItems(snapshot, viewMode = 'expenses') {
  if (!snapshot) return []
  return viewMode === 'income'
    ? (snapshot.incomeBreakdown ?? [])
    : (snapshot.expenseBreakdown ?? [])
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatSignedCurrency(value) {
  const amount = Number(value ?? 0)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(amount))}`
}

function formatSignedPercentage(value) {
  const amount = Number(value ?? 0)
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  const absolute = Math.abs(amount)
  const decimals = absolute >= 10 || Number.isInteger(absolute) ? 0 : 1
  return `${sign}${absolute.toFixed(decimals)}%`
}

function getMetricValue(metric) {
  if (metric.id === 'budget-left' && metric.currentAmount == null) return 'No budget'
  return formatCurrency(metric.currentAmount ?? 0)
}

function getMetricDeltaValue(metric) {
  if (metric.id === 'budget-left' && metric.currentAmount == null) return 'Set budget'
  if (metric.deltaAmount == null) return 'No baseline'
  if (metric.deltaAmount === 0) return 'Flat'
  if ((metric.previousAmount ?? 0) > 0 && metric.deltaPercentage != null) {
    return formatSignedPercentage(metric.deltaPercentage)
  }
  return formatSignedCurrency(metric.deltaAmount)
}

function getMetricDeltaContext(metric) {
  if (metric.id === 'budget-left' && metric.currentAmount == null) return null
  if (metric.deltaAmount == null) return null
  return 'vs last month'
}

function getMetricAccent(metricId) {
  if (metricId === 'income') return '\u2197'
  if (metricId === 'expenses') return '\u2198'
  if (metricId === 'net') return '\u223F'
  if (metricId === 'budget-left') return '\u25CE'
  return '\u2022'
}

function pickTopExpensesFromDetails(details = [], limit = 10) {
  if (!Array.isArray(details) || !details.length) return []
  return [...details]
    .sort((left, right) => Number(right.amount ?? 0) - Number(left.amount ?? 0))
    .slice(0, limit)
}

function getBudgetUsageHeadline(budgetHealth) {
  if (!budgetHealth || budgetHealth.budgetAmount == null) return 'Budget not set'
  return `${Math.round(budgetHealth.progressValue ?? 0)}% used`
}

function polarToCartesian(angle, radius) {
  const radians = ((angle - 90) * Math.PI) / 180
  return {
    x: DONUT_CENTER + (radius * Math.cos(radians)),
    y: DONUT_CENTER + (radius * Math.sin(radians)),
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

function normalizeAngle(angle) {
  const mod = angle % 360
  return mod < 0 ? mod + 360 : mod
}

function getMinMarkerGap(count) {
  if (count <= 1) return 360
  if (count <= 2) return 110
  if (count <= 3) return 70
  if (count <= 4) return 52
  if (count <= 5) return 38
  return Math.max(Math.floor(360 / count) - 4, 28)
}

function resolveMarkerAngles(rawAngles, minGap) {
  const count = rawAngles.length
  if (count === 0) return []
  if (count === 1) return [normalizeAngle(rawAngles[0])]

  const sorted = rawAngles
    .map((angle, index) => ({ angle: normalizeAngle(angle), index }))
    .sort((left, right) => left.angle - right.angle)

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false

    for (let i = 1; i < count; i += 1) {
      const gap = sorted[i].angle - sorted[i - 1].angle
      if (gap < minGap) {
        sorted[i].angle = sorted[i - 1].angle + minGap
        moved = true
      }
    }

    const wrapGap = (360 + sorted[0].angle) - sorted[count - 1].angle
    if (wrapGap < minGap) {
      const shift = (minGap - wrapGap) / 2 + 0.01
      sorted[count - 1].angle -= shift
      sorted[0].angle += shift
      moved = true
    }

    for (let i = count - 2; i >= 0; i -= 1) {
      const gap = sorted[i + 1].angle - sorted[i].angle
      if (gap < minGap) {
        sorted[i].angle = sorted[i + 1].angle - minGap
        moved = true
      }
    }

    if (!moved) break
  }

  sorted.forEach((item) => {
    item.angle = normalizeAngle(item.angle)
    if (item.angle > 170 && item.angle < 190) {
      item.angle = item.angle <= 180 ? 168 : 192
    }
  })

  const result = new Array(count)
  sorted.forEach(({ angle, index }) => { result[index] = normalizeAngle(angle) })
  return result
}

function buildDonutSegments(items = []) {
  const total = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  if (!total) return []

  const gapAngle = items.length > 1 ? 3.2 : 0
  const midAngles = []
  let currentAngle = 0

  const rawSegments = items.map((item, index) => {
    const sliceAngle = (Number(item.amount ?? 0) / total) * 360
    const startAngle = currentAngle + (gapAngle / 2)
    const endAngle = currentAngle + sliceAngle - (gapAngle / 2)
    const safeEndAngle = endAngle <= startAngle
      ? startAngle + Math.min(Math.max(sliceAngle, 1), 359.5)
      : Math.min(endAngle, startAngle + 359.5)
    const midAngle = startAngle + ((safeEndAngle - startAngle) / 2)
    midAngles.push(midAngle)
    currentAngle += sliceAngle

    return {
      ...item,
      index,
      path: describeArc(startAngle, safeEndAngle),
      animationDelay: `${index * 90}ms`,
    }
  })

  const resolvedAngles = resolveMarkerAngles(midAngles, getMinMarkerGap(items.length))

  return rawSegments.map((segment, index) => {
    const angle = resolvedAngles[index]
    const anchor = polarToCartesian(angle, DONUT_MARKER_RADIUS)
    return {
      ...segment,
      markerAngle: angle,
      x: anchor.x,
      y: anchor.y,
      markerLeft: `${(anchor.x / DONUT_VIEWBOX) * 100}%`,
      markerTop: `${(anchor.y / DONUT_VIEWBOX) * 100}%`,
    }
  })
}

function buildSmoothPath(points = []) {
  if (!points.length) return ''
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    const previous = points[index - 1]
    const controlX = (previous.x + point.x) / 2
    return `${path} C ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }, '')
}

function buildCashFlowGeometry(series = []) {
  const plotBottom = CASHFLOW_HEIGHT - CASHFLOW_INSET_BOTTOM
  const chartHeight = plotBottom - CASHFLOW_INSET_TOP
  const baselineY = CASHFLOW_INSET_TOP + (chartHeight * CASHFLOW_BASELINE_RATIO)
  const innerWidth = CASHFLOW_WIDTH - (CASHFLOW_INSET_X * 2)
  const groupWidth = innerWidth / Math.max(series.length, 1)
  const barWidth = clamp(groupWidth * 0.28, 18, 30)
  const maxBarValue = Math.max(...series.flatMap((item) => [Number(item.incomeAmount ?? 0), Number(item.expenseAmount ?? 0)]), 1)
  const maxNetValue = Math.max(...series.map((item) => Math.abs(Number(item.netAmount ?? 0))), 1)
  const topBandHeight = baselineY - CASHFLOW_INSET_TOP - 8
  const bottomBandHeight = plotBottom - baselineY - 10
  const netBandHeight = Math.min(topBandHeight, bottomBandHeight) + 14
  const guides = [
    baselineY - (topBandHeight * 0.82),
    baselineY - (topBandHeight * 0.48),
    baselineY,
    baselineY + (bottomBandHeight * 0.48),
    baselineY + (bottomBandHeight * 0.82),
  ]

  const groups = series.map((item, index) => {
    const centerX = CASHFLOW_INSET_X + (groupWidth * index) + (groupWidth / 2)
    const incomeHeight = (Number(item.incomeAmount ?? 0) / maxBarValue) * topBandHeight
    const expenseHeight = (Number(item.expenseAmount ?? 0) / maxBarValue) * bottomBandHeight
    const visibleTop = clamp(Math.min(baselineY, baselineY - incomeHeight, baselineY - ((Number(item.netAmount ?? 0) / maxNetValue) * netBandHeight)) - 14, CASHFLOW_INSET_TOP + 4, plotBottom - 80)
    const visibleBottom = clamp(Math.max(baselineY + expenseHeight, baselineY - ((Number(item.netAmount ?? 0) / maxNetValue) * netBandHeight)) + 14, CASHFLOW_INSET_TOP + 56, plotBottom + 6)
    return {
      ...item,
      centerX,
      barX: centerX - (barWidth / 2),
      barWidth,
      incomeY: baselineY - incomeHeight,
      incomeHeight,
      expenseY: baselineY,
      expenseHeight,
      netY: baselineY - ((Number(item.netAmount ?? 0) / maxNetValue) * netBandHeight),
      labelY: CASHFLOW_HEIGHT - 10,
      interactionX: centerX - (groupWidth / 2),
      interactionY: visibleTop,
      interactionWidth: groupWidth,
      interactionHeight: visibleBottom - visibleTop,
    }
  })

  return {
    baselineY,
    guides,
    groups,
    maxBarValue,
    linePath: buildSmoothPath(groups.map((item) => ({ x: item.centerX, y: item.netY }))),
  }
}

function buildCalendarGrid(series = [], month) {
  if (!series.length || !month) return { weeks: [], weekdayLabels: CALENDAR_WEEKDAYS }
  const monthDate = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(monthDate.getTime())) return { weeks: [], weekdayLabels: CALENDAR_WEEKDAYS }

  const firstDay = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 1, 12)).getUTCDay()
  const maxAmount = Math.max(...series.map((item) => Number(item.amount ?? 0)), 1)
  const cells = [
    ...Array.from({ length: firstDay }, (_, index) => ({ key: `blank-start-${index}`, isBlank: true })),
    ...series.map((item) => {
      const ratio = Number(item.amount ?? 0) / maxAmount
      let intensity = 0
      if (item.amount > 0.001) intensity = 1
      if (ratio >= 0.24) intensity = 2
      if (ratio >= 0.5) intensity = 3
      if (ratio >= 0.78) intensity = 4
      return { ...item, intensity, isBlank: false }
    }),
  ]

  while (cells.length % 7 !== 0) {
    cells.push({ key: `blank-end-${cells.length}`, isBlank: true })
  }

  return {
    weekdayLabels: CALENDAR_WEEKDAYS,
    weeks: Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, (index + 1) * 7)),
  }
}

function buildRhythmBars(series = []) {
  const maxAmount = Math.max(...series.map((item) => Number(item.amount ?? 0)), 1)
  const lastDay = series.at(-1)?.day ?? 0
  const tickDays = [...new Set([...RHYTHM_TICK_DAYS, lastDay].filter((day) => day > 0 && day <= lastDay))]
  return {
    tickDays,
    columns: series.map((item) => ({
      ...item,
      heightRatio: maxAmount > 0 ? Number(item.amount ?? 0) / maxAmount : 0,
    })),
  }
}

function buildDailyDetailMap(entries = []) {
  return entries.reduce((map, entry) => {
    if (!entry?.key) return map
    if (!map[entry.key]) map[entry.key] = []
    map[entry.key].push(entry)
    return map
  }, {})
}

function buildCumulativeSeries(series = []) {
  let running = 0
  return series.map((item) => {
    running += Number(item?.amount ?? 0)
    return {
      day: Number(item?.day ?? 0),
      amount: Number(running.toFixed(2)),
    }
  })
}

function getMonthLength(month) {
  if (!month) return 31
  const date = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 31
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

function getMonthShortLabel(month) {
  if (!month) return 'Month'
  const date = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Month'
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

function getDefaultSelectedDay(dailySpend) {
  if (dailySpend?.peakDay?.key) return dailySpend.peakDay.key
  const firstActiveDay = dailySpend?.series?.find((item) => Number(item.amount ?? 0) > 0)
  return firstActiveDay?.key ?? null
}

function LiveNotice({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="inline-status" role="status">
      <div>
        <strong>Live insights are limited right now</strong>
        <span>{message}</span>
      </div>
      <button className="button-secondary page-retry" onClick={onRetry} type="button">Retry</button>
    </div>
  )
}

export default function InsightsView() {
  const router = useRouter()
  const { isReady, logout, session } = useAuth()
  const { isSampleMode } = useDataMode()
  const rhythmStageRef = useRef(null)
  const cashFlowStageRef = useRef(null)
  const [portalRoot, setPortalRoot] = useState(null)
  const [viewMode, setViewMode] = useState('expenses')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStart)
  const [reloadToken, setReloadToken] = useState(0)
  const [activeCashMonth, setActiveCashMonth] = useState(null)
  const [activeRhythmDay, setActiveRhythmDay] = useState(null)
  const [rhythmTooltip, setRhythmTooltip] = useState(null)
  const [isMonthViewOpen, setIsMonthViewOpen] = useState(false)
  const [selectedDayKey, setSelectedDayKey] = useState(null)
  const [drillDown, setDrillDown] = useState(null)
  const [topExpenseDetail, setTopExpenseDetail] = useState(null)
  const [liveState, setLiveState] = useState({ status: 'loading', message: '', snapshot: null })

  const activeMonth = isSampleMode ? DEMO_MONTH : selectedMonth
  const snapshot = isSampleMode ? demoInsightsSnapshot : liveState.snapshot
  const cashFlowSeries = snapshot?.cashFlowSeries ?? []
  const rhythmTopExpenses = useMemo(() => {
    const fromDetails = pickTopExpensesFromDetails(snapshot?.dailySpend?.details, 10)
    const topMeta = snapshot?.topExpenses ?? []
    const source = fromDetails.length ? fromDetails : topMeta.slice(0, 10)
    if (!source.length) return []
    return source.map((row) => {
      const match = topMeta.find((m) => String(m.id) === String(row.id))
      return {
        ...row,
        categoryIcon: row.categoryIcon ?? match?.categoryIcon ?? null,
      }
    })
  }, [snapshot?.dailySpend?.details, snapshot?.topExpenses])

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return
    const controller = new AbortController()

    async function loadInsights() {
      setLiveState({ status: 'loading', message: '', snapshot: null })
      const nextSnapshot = await apiGet(`/api/insights?month=${encodeURIComponent(activeMonth)}`, {
        accessToken: session.accessToken,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setLiveState({ status: 'ready', message: '', snapshot: nextSnapshot })
    }

    loadInsights().catch((error) => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }
      setLiveState({ status: 'error', message: getErrorMessage(error), snapshot: null })
    })

    return () => controller.abort()
  }, [activeMonth, isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalRoot(document.body)
  }, [])

  useEffect(() => {
    setActiveCashMonth(null)
  }, [activeMonth, snapshot?.cashFlowRangeLabel])

  useEffect(() => {
    setActiveRhythmDay(null)
    setRhythmTooltip(null)
    setSelectedDayKey(getDefaultSelectedDay(snapshot?.dailySpend))
  }, [activeMonth, snapshot?.dailySpend])

  function showRhythmTooltip(event, item) {
    const stageRect = rhythmStageRef.current?.getBoundingClientRect()
    const barRect = event.currentTarget.getBoundingClientRect()
    const fillRect = event.currentTarget.querySelector('.insights-v57__rhythm-column-fill')?.getBoundingClientRect()
    if (!stageRect) return
    const barTop = fillRect?.height ? fillRect.top : barRect.bottom
    setRhythmTooltip({
      left: clamp((barRect.left - stageRect.left) + (barRect.width / 2), 72, stageRect.width - 72),
      top: clamp((barTop - stageRect.top) - 6, 48, stageRect.height - 8),
    })
    setActiveRhythmDay(item.key)
  }

  useEffect(() => {
    if (!isMonthViewOpen || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsMonthViewOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMonthViewOpen])

  useEffect(() => {
    if (!topExpenseDetail) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setTopExpenseDetail(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [topExpenseDetail])

  function openMonthView(event) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    setSelectedDayKey((current) => current ?? getDefaultSelectedDay(snapshot?.dailySpend))
    setIsMonthViewOpen(true)
  }

  if (!isSampleMode && (!isReady || !session?.accessToken)) return null

  const activeItems = getActiveBreakdownItems(snapshot, viewMode)
  const donutSegments = buildDonutSegments(activeItems)
  const comparisonMetrics = snapshot?.comparisonMetrics ?? []
  const budgetHealth = snapshot?.budgetHealth ?? { tone: 'neutral', statusLabel: 'No budget', budgetAmount: null, spentAmount: 0, remainingAmount: null, progressValue: 0, pressureCategories: [] }
  const savingsGoals = isSampleMode ? demoSavingsGoals : snapshot?.savingsGoals
  const categoryMovers = snapshot?.categoryMovers ?? []
  const dailySpend = snapshot?.dailySpend ?? { series: [], totalAmount: 0, averageAmount: 0, activeDayAverage: 0, peakDay: null, activeDays: 0 }
  const previousDailySpend = snapshot?.previousDailySpend ?? { series: [], totalAmount: 0 }
  const currentLiveMonth = getCurrentMonthStart()
  const earliestMonth = isSampleMode ? DEMO_MONTH : snapshot?.earliestMonth
  const previousMonth = shiftMonth(activeMonth, -1)
  const previousDisabled = isSampleMode || !earliestMonth || activeMonth <= earliestMonth
  const nextDisabled = isSampleMode || activeMonth >= currentLiveMonth
  const activeMonthLabel = formatMonthLabel(activeMonth)
  const activeTotal = activeItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const cashFlowGeometry = buildCashFlowGeometry(cashFlowSeries)
  const activeCashGroup = activeCashMonth ? cashFlowGeometry.groups.find((item) => item.month === activeCashMonth) ?? null : null
  const focusCashGroup = activeCashGroup ?? cashFlowGeometry.groups.at(-1) ?? null
  const dailyPeak = dailySpend.peakDay
  const calendarGrid = buildCalendarGrid(dailySpend.series, activeMonth)
  const rhythmBars = buildRhythmBars(dailySpend.series)
  const dailyDetailMap = buildDailyDetailMap(dailySpend.details ?? [])
  const selectedDayEntries = selectedDayKey ? (dailyDetailMap[selectedDayKey] ?? []) : []
  const selectedDayLabel = selectedDayKey ? formatLongDate(selectedDayKey) : activeMonthLabel
  const activeRhythmEntry = activeRhythmDay ? dailySpend.series.find((item) => item.key === activeRhythmDay) ?? null : null
  const centerLabelLines = viewMode === 'expenses' ? ['Spent', 'this month'] : ['Income', 'this month']
  const detailSectionLabel = viewMode === 'income' ? 'Source detail' : 'Category detail'
  const trailingCategoryId = activeItems.length > 2 && activeItems.length % 2 === 1 ? activeItems.at(-1)?.id : null
  const moverScaleMax = Math.max(
    ...categoryMovers.flatMap((entry) => [Number(entry.amount ?? 0), Number(entry.previousAmount ?? 0)]),
    1
  )
  const positiveCashMonths = cashFlowSeries.filter((item) => Number(item.netAmount ?? 0) >= 0).length
  const strongestCashMonth = cashFlowSeries.reduce((best, item) => (
    !best || Number(item.netAmount ?? 0) > Number(best.netAmount ?? 0) ? item : best
  ), null)
  const highestExpenseMonth = cashFlowSeries.reduce((best, item) => (
    !best || Number(item.expenseAmount ?? 0) > Number(best.expenseAmount ?? 0) ? item : best
  ), null)
  const focusSavingsRate = focusCashGroup && Number(focusCashGroup.incomeAmount ?? 0) > 0
    ? (Number(focusCashGroup.netAmount ?? 0) / Number(focusCashGroup.incomeAmount ?? 0)) * 100
    : null
  const cashFlowFocusTone = focusCashGroup && Number(focusCashGroup.netAmount ?? 0) < 0 ? 'negative' : 'positive'
  const cashFlowHealthLabel = cashFlowSeries.length && positiveCashMonths === cashFlowSeries.length
    ? 'Every month positive'
    : `${positiveCashMonths}/${cashFlowSeries.length} positive months`
  const cashFlowHealthCopy = focusCashGroup
    ? `${focusCashGroup.label} kept ${formatPercentage(focusSavingsRate ?? 0)} of income after expenses.`
    : 'Cash-flow highlights appear after a few months of activity.'

  const paceCurrentSeries = buildCumulativeSeries(dailySpend.series)
  const pacePreviousSeries = buildCumulativeSeries(previousDailySpend.series || [])
  const previousMonthShortLabel = getMonthShortLabel(snapshot?.previousMonth || previousMonth)
  const currentMonthShortLabel = getMonthShortLabel(activeMonth)
  const isViewingCurrentMonth = activeMonth === currentLiveMonth
  const todayDay = isViewingCurrentMonth ? new Date().getDate() : null

  const monthModal = isMonthViewOpen && portalRoot
    ? createPortal(
      <div className="insights-screen--issue57 insights-v57__month-modal-portal">
        <div className="insights-v57__month-modal-backdrop" onClick={() => setIsMonthViewOpen(false)} role="presentation">
          <div aria-labelledby="insights-month-view-title" aria-modal="true" className="insights-v57__month-modal" onClick={(event) => event.stopPropagation()} role="dialog">
          <div className="insights-v57__month-modal-header">
            <div className="insights-v57__month-modal-copy">
              <span className="insights-v57__month-modal-kicker">Spend this month</span>
              <strong id="insights-month-view-title">{formatCurrency(dailySpend.totalAmount)}</strong>
              <span>{activeMonthLabel}</span>
            </div>
            <button aria-label="Close month view" className="insights-v57__month-modal-close" onClick={() => setIsMonthViewOpen(false)} type="button">{'\u00D7'}</button>
          </div>

          <div className="insights-v57__month-modal-stats">
            <span>{dailySpend.activeDays} active days</span>
            <span>Spend / active day {formatCurrency(dailySpend.activeDayAverage ?? dailySpend.averageAmount)}</span>
            <span>{dailyPeak ? `${formatShortDate(dailyPeak.key)} peak` : 'No peak yet'}</span>
          </div>

          {calendarGrid.weeks.length ? (
            <>
              <div className="insights-v57__calendar-head insights-v57__calendar-head--modal">
                {calendarGrid.weekdayLabels.map((day, index) => <span className="insights-v57__calendar-dayhead" key={`modal-day-${day}-${index}`}>{day}</span>)}
              </div>

              <div className="insights-v57__calendar-grid insights-v57__calendar-grid--modal">
                {calendarGrid.weeks.flat().map((cell) => (
                  cell.isBlank ? (
                    <span className="insights-v57__calendar-cell insights-v57__calendar-cell--blank" key={`modal-${cell.key}`} />
                  ) : (
                    <button
                      aria-label={`${formatShortDate(cell.key)} spending ${formatCurrency(cell.amount)}`}
                      className={`insights-v57__calendar-cell insights-v57__calendar-cell--modal insights-v57__calendar-cell--${cell.intensity}${dailyPeak?.key === cell.key ? ' insights-v57__calendar-cell--peak' : ''}${selectedDayKey === cell.key ? ' insights-v57__calendar-cell--selected' : ''}`}
                      key={`modal-${cell.key}`}
                      onClick={() => setSelectedDayKey(cell.key)}
                      type="button"
                    >
                      <span className="insights-v57__calendar-date">{cell.day}</span>
                      {cell.amount > 0 ? <span className="insights-v57__calendar-amount">{formatCurrency(cell.amount)}</span> : <span className="insights-v57__calendar-amount insights-v57__calendar-amount--empty">-</span>}
                    </button>
                  )
                ))}
              </div>

              <div className="insights-v57__day-detail">
                <div className="insights-v57__day-detail-head">
                  <strong>{selectedDayLabel}</strong>
                  <span>{selectedDayEntries.length ? `${selectedDayEntries.length} expense${selectedDayEntries.length === 1 ? '' : 's'}` : 'No expenses recorded'}</span>
                </div>
                {selectedDayEntries.length ? (
                  <div className="insights-v57__day-detail-list">
                    {selectedDayEntries.map((entry) => (
                      <div className="insights-v57__day-detail-row" key={entry.id}>
                        <div className="insights-v57__day-detail-main">
                          <div className="insights-v57__top-expense-icon" style={{ backgroundColor: entry.soft, color: entry.color }}>{entry.symbol}</div>
                          <div>
                            <strong>{entry.title}</strong>
                            <span>{entry.categoryName}</span>
                          </div>
                        </div>
                        <strong className="insights-v57__day-detail-amount">-{formatCurrency(entry.amount)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="blank-state blank-state--compact">
                    <strong>No expenses on this day</strong>
                    <span>Pick another day with activity to see the largest expenses first.</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="blank-state blank-state--compact">
              <strong>No daily spend pattern yet</strong>
              <span>Spend will appear here once the selected month starts recording expenses.</span>
            </div>
          )}
          </div>
        </div>
      </div>,
      portalRoot
    )
    : null

  return (
    <section className="app-screen insights-screen insights-screen--issue57">
      <div className="insights-screen__masthead">
        <div className="insights-screen__masthead-row">
          <div className="screen-heading insights-screen__heading">
            <h1 className="screen-heading__title">Insights</h1>
          </div>
          <span className={`screen-chip screen-chip--${isSampleMode ? 'sample' : 'live'}`}>{isSampleMode ? 'Sample' : 'Live'}</span>
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

            <button
              aria-label={`Open ${activeMonthLabel} month view`}
              aria-expanded={isMonthViewOpen}
              aria-haspopup="dialog"
              className="month-switcher__copy month-switcher__copy--button"
              data-hint="Open month view"
              onClick={openMonthView}
              onPointerUp={openMonthView}
              title="Click to open month view"
              type="button"
            >
              <span className="period-chip__label">Selected month</span>
              <strong>{activeMonthLabel}</strong>
            </button>

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

      <LiveNotice message={liveState.message} onRetry={() => setReloadToken((value) => value + 1)} />

      <div className="insights-v57">
        <div className="insights-v57__metric-strip">
          {comparisonMetrics.map((metric) => (
            <article className={`insights-v57__metric-card insights-v57__metric-card--${metric.deltaTone} insights-v57__metric-card--${metric.id}`} key={metric.id}>
              <div className="insights-v57__metric-head">
                <div className="insights-v57__metric-label">
                  <span className={`insights-v57__metric-accent insights-v57__metric-accent--${metric.id}`}>{getMetricAccent(metric.id)}</span>
                  <span>{metric.label}</span>
                </div>
                <div className="insights-v57__metric-trend">
                  <span className={`insights-v57__metric-delta insights-v57__metric-delta--${metric.deltaTone}`}>{getMetricDeltaValue(metric)}</span>
                  {getMetricDeltaContext(metric) ? <small>{getMetricDeltaContext(metric)}</small> : null}
                </div>
              </div>
              <strong className="insights-v57__metric-value">{getMetricValue(metric)}</strong>
            </article>
          ))}
        </div>

        <div className="insights-v57__top-grid">
          <article className="insights-v57__card insights-v57__hero">
            <div className="insights-v57__card-header insights-v57__card-header--hero">
              <h2 className="insights-v57__title">Spending breakdown</h2>
              <div className="insights-v57__hero-actions">
                <div className="segment-control segment-control--tight segment-control--strong" role="group" aria-label="Insights view mode">
                  <button className={`segment-control__button${viewMode === 'expenses' ? ' segment-control__button--active' : ''}`} onClick={() => setViewMode('expenses')} type="button">Expenses</button>
                  <button className={`segment-control__button${viewMode === 'income' ? ' segment-control__button--active' : ''}`} onClick={() => setViewMode('income')} type="button">Income</button>
                </div>
              </div>
            </div>

            {activeItems.length ? (
              <div className="insights-v57__hero-body insights-v57__hero-body--donut-only">
                <div className="insights-v57__donut-shell">
                  <div className="insights-v57__donut" key={`${viewMode}-${activeMonth}`}>
                    <svg aria-hidden="true" className="insights-v57__donut-svg" viewBox={`0 0 ${DONUT_VIEWBOX} ${DONUT_VIEWBOX}`}>
                      <circle className="insights-v57__donut-track" cx={DONUT_CENTER} cy={DONUT_CENTER} r={DONUT_RADIUS} />
                      {donutSegments.map((item) => (
                        <path
                          className="insights-v57__donut-segment"
                          d={item.path}
                          key={item.id}
                          pathLength="1"
                          style={{ animationDelay: item.animationDelay, stroke: item.color }}
                        />
                      ))}
                    </svg>

                    {donutSegments.map((item) => (
                      <div
                        aria-hidden="true"
                        className="insights-v57__donut-marker"
                        key={`${item.id}-marker`}
                        style={{ left: item.markerLeft, top: item.markerTop, animationDelay: item.animationDelay }}
                      >
                        <span className="insights-v57__donut-marker-icon" style={{ backgroundColor: item.soft, color: item.color }}>{item.symbol}</span>
                        <div className="insights-v57__donut-marker-copy">
                          <strong>{formatPercentage(item.share)}</strong>
                          <span>{item.name}</span>
                        </div>
                      </div>
                    ))}

                    <div className="insights-v57__donut-center">
                      <span className="insights-v57__donut-caption">
                        {centerLabelLines.map((line) => <span key={line}>{line}</span>)}
                      </span>
                      <strong>{formatCurrency(activeTotal)}</strong>
                    </div>
                  </div>

                  <div className="insights-v57__donut-legend">
                    {activeItems.map((item) => (
                      <div className="insights-v57__donut-legend-item" key={`${item.id}-legend`}>
                        <span className="insights-v57__donut-marker-icon" style={{ backgroundColor: item.soft, color: item.color }}>{item.symbol}</span>
                        <div>
                          <strong>{item.name}</strong>
                          <span>{formatPercentage(item.share)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="blank-state blank-state--hero">
                <strong>No {viewMode === 'expenses' ? 'expense' : 'income'} breakdown yet</strong>
                <span>{viewMode === 'expenses' ? 'Add spending in the selected month to unlock the category breakdown.' : 'Income sources will appear here once deposits land in the selected month.'}</span>
              </div>
            )}
          </article>

          <article className="insights-v57__card insights-v57__cashflow">
            <div className="insights-v57__card-header insights-v57__card-header--tight">
              <h2 className="insights-v57__title">Cash flow</h2>
              <div className="insights-v57__cashflow-header-meta">
                <span className="insights-v57__range-chip">{snapshot?.cashFlowRangeLabel ?? 'Last 6 months'}</span>
              </div>
            </div>

            {cashFlowSeries.length ? (
              <>
                <div className="insights-v57__cashflow-legend">
                  <span className="insights-v57__legend insights-v57__legend--income">Income</span>
                  <span className="insights-v57__legend insights-v57__legend--expense">Expenses</span>
                  <span className="insights-v57__legend insights-v57__legend--net">Net</span>
                </div>

                <div className="insights-v57__cashflow-stage">
                  <div className="insights-v57__cashflow-plot" onMouseLeave={() => setActiveCashMonth(null)} ref={cashFlowStageRef}>
                    <svg aria-hidden="true" className="insights-v57__cashflow-svg" viewBox={`0 0 ${CASHFLOW_WIDTH} ${CASHFLOW_HEIGHT}`}>
                      {cashFlowGeometry.guides.map((guide, index) => (
                        <line
                          className={`insights-v57__cashflow-guide${Math.abs(guide - cashFlowGeometry.baselineY) < 0.5 ? ' insights-v57__cashflow-guide--baseline' : ''}`}
                          key={`guide-${index}`}
                          x1={CASHFLOW_INSET_X}
                          x2={CASHFLOW_WIDTH - CASHFLOW_INSET_X}
                          y1={guide}
                          y2={guide}
                        />
                      ))}

                      {cashFlowGeometry.linePath ? <path className="insights-v57__cashflow-line" d={cashFlowGeometry.linePath} /> : null}

                      {cashFlowGeometry.groups.map((item) => (
                        <g className={`insights-v57__cashflow-group${activeCashGroup?.month === item.month ? ' insights-v57__cashflow-group--active' : ''}`} key={item.month}>
                          <rect
                            aria-label={`${item.label} cash flow details: income ${formatCurrency(item.incomeAmount)}, expenses ${formatCurrency(item.expenseAmount)}, net ${formatSignedCurrency(item.netAmount)}`}
                            className="insights-v57__cashflow-hit"
                            height={item.interactionHeight}
                            onBlur={(event) => {
                              if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setActiveCashMonth(null)
                            }}
                            onFocus={() => setActiveCashMonth(item.month)}
                            onMouseEnter={() => setActiveCashMonth(item.month)}
                            rx="18"
                            tabIndex="0"
                            width={item.interactionWidth}
                            x={item.interactionX}
                            y={item.interactionY}
                          />
                          <rect className="insights-v57__cashflow-bar insights-v57__cashflow-bar--income" height={item.incomeHeight} rx="11" width={item.barWidth} x={item.barX} y={item.incomeY} />
                          <rect className="insights-v57__cashflow-bar insights-v57__cashflow-bar--expense" height={item.expenseHeight} rx="11" width={item.barWidth} x={item.barX} y={item.expenseY} />
                          <circle className="insights-v57__cashflow-point" cx={item.centerX} cy={item.netY} r="4.25" />
                          <text className="insights-v57__cashflow-label" textAnchor="middle" x={item.centerX} y={item.labelY}>{item.label}</text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  {focusCashGroup ? (
                    <div aria-live="polite" className="insights-v57__cashflow-focus">
                      <div
                        className={`insights-v57__cashflow-focus-card insights-v57__cashflow-focus-card--${cashFlowFocusTone}`}
                        key={focusCashGroup.month}
                      >
                        <div className="insights-v57__cashflow-focus-head">
                          <span className="insights-v57__cashflow-focus-label">{focusCashGroup.label}</span>
                          {focusSavingsRate == null ? null : (
                            <span className={`insights-v57__cashflow-focus-chip insights-v57__cashflow-focus-chip--${cashFlowFocusTone}`}>
                              {formatPercentage(focusSavingsRate)} saved
                            </span>
                          )}
                        </div>
                        <strong className="insights-v57__cashflow-focus-value">{formatSignedCurrency(focusCashGroup.netAmount)}</strong>
                        <div className="insights-v57__cashflow-focus-meta">
                          <span>Income <strong>{formatCurrency(focusCashGroup.incomeAmount)}</strong></span>
                          <span>Expenses <strong>{formatCurrency(focusCashGroup.expenseAmount)}</strong></span>
                        </div>
                      </div>

                      <div className="insights-v57__cashflow-story">
                        <div className="insights-v57__cashflow-story-copy">
                          <span>Flow health</span>
                          <strong>{cashFlowHealthLabel}</strong>
                        </div>
                        <div className="insights-v57__cashflow-streak" aria-label={`${positiveCashMonths} positive cash-flow months out of ${cashFlowSeries.length}`}>
                          {cashFlowSeries.map((item) => (
                            <span
                              aria-hidden="true"
                              className={`insights-v57__cashflow-streak-dot${Number(item.netAmount ?? 0) >= 0 ? ' insights-v57__cashflow-streak-dot--positive' : ' insights-v57__cashflow-streak-dot--negative'}`}
                              key={`streak-${item.month}`}
                            />
                          ))}
                        </div>
                        <p>{cashFlowHealthCopy}</p>
                      </div>

                      <div className="insights-v57__cashflow-peaks">
                        <div className="insights-v57__cashflow-peak insights-v57__cashflow-peak--positive">
                          <span>Peak net</span>
                          <strong>{strongestCashMonth ? formatSignedCurrency(strongestCashMonth.netAmount) : '—'}</strong>
                          <small>{strongestCashMonth?.label ?? '—'}</small>
                        </div>
                        <div className="insights-v57__cashflow-peak insights-v57__cashflow-peak--warning">
                          <span>Peak spend</span>
                          <strong>{highestExpenseMonth ? formatCurrency(highestExpenseMonth.expenseAmount) : '—'}</strong>
                          <small>{highestExpenseMonth?.label ?? '—'}</small>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="blank-state blank-state--compact">
                <strong>No multi-month cash flow yet</strong>
                <span>Add a few months of income and expenses to unlock trend comparison.</span>
              </div>
            )}
          </article>
        </div>

        {activeItems.length ? (
          <section className="section-block insights-v57__detail-section" aria-label={detailSectionLabel}>
            <div className="section-headline">
              <h2>{detailSectionLabel}</h2>
              <span className="section-link">{formatCurrency(activeTotal)} {viewMode === 'expenses' ? 'spent' : 'earned'}</span>
            </div>
            <div className="category-progress-list category-progress-list--insights">
              {activeItems.map((item) => (
                <CategoryProgressRow
                  amount={item.amount}
                  color={item.color}
                  fallbackShareText={!item.hasBudget ? item.progressLabel : null}
                  key={item.id}
                  monthlyLimit={item.hasBudget ? item.monthlyLimit : null}
                  name={item.name}
                  onSelect={viewMode === 'expenses' ? () => setDrillDown({ category: item, mode: 'single' }) : null}
                  progressPercentage={item.progressValue ?? item.share ?? 0}
                  remainingAmount={item.remainingBudget ?? null}
                  selectLabel={`View ${item.name} transactions for ${activeMonthLabel}`}
                  showStatusChip="always"
                  soft={item.soft}
                  statusLabel={item.statusLabel}
                  symbol={item.symbol}
                  tone={item.tone || 'neutral'}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="insights-v57__bottom-grid">
          <article className="insights-v57__card insights-v57__budget-card">
            <div className="insights-v57__card-header insights-v57__card-header--tight"><h2 className="insights-v57__title">Budget health</h2></div>

            <div className={`insights-v57__budget-overview insights-v57__budget-overview--${budgetHealth.tone}`}>
              <div className="insights-v57__budget-overview-copy">
                <span className={`insights-v57__status-chip insights-v57__status-chip--${budgetHealth.tone}`}>{budgetHealth.statusLabel}</span>
                <strong>{getBudgetUsageHeadline(budgetHealth)}</strong>
              </div>

              <AllocationBar
                activeDay={isViewingCurrentMonth ? todayDay : null}
                ariaLabel="Budget health progress"
                ariaValueText={`${Math.round(budgetHealth.progressValue ?? 0)}% used`}
                isOverBudget={(budgetHealth.remainingAmount ?? 0) < 0}
                monthLength={getMonthLength(activeMonth)}
                monthMarkerLabel={isViewingCurrentMonth ? `Today · Day ${todayDay}` : null}
                progressPercentage={budgetHealth.progressValue ?? 0}
                showMarker={Boolean(budgetHealth.budgetAmount) && isViewingCurrentMonth}
                tone={budgetHealth.tone}
              />

              <div className="insights-v57__budget-overview-scale">
                <span>Spent <strong>{formatCurrency(budgetHealth.spentAmount ?? 0)}</strong></span>
                <span>{(budgetHealth.remainingAmount ?? 0) < 0 ? 'Over' : 'Left'} <strong>{budgetHealth.remainingAmount == null ? 'None' : formatCurrency(Math.abs(budgetHealth.remainingAmount))}</strong></span>
                <span>Budget <strong>{budgetHealth.budgetAmount == null ? 'None' : formatCurrency(budgetHealth.budgetAmount)}</strong></span>
              </div>
            </div>

            <div className="insights-v57__budget-panels">
              <section className="insights-v57__budget-panel">
                <div className="insights-v57__panel-head"><h3>Pressure</h3></div>
                {budgetHealth.pressureCategories.length ? (
                  <div className="category-progress-list category-progress-list--insights category-progress-list--compact">
                    {budgetHealth.pressureCategories.map((item) => (
                      <CategoryProgressRow
                        amount={item.amount}
                        color={item.color}
                        key={`pressure-${item.id}`}
                        monthlyLimit={item.monthlyLimit}
                        name={item.name}
                        onSelect={() => setDrillDown({ category: item, mode: 'single' })}
                        progressPercentage={item.progressValue ?? 0}
                        remainingAmount={item.remainingBudget}
                        selectLabel={`View ${item.name} pressure transactions for ${activeMonthLabel}`}
                        showStatusChip="never"
                        soft={item.soft}
                        statusLabel={item.statusLabel}
                        symbol={item.symbol}
                        tone={item.tone || 'neutral'}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="blank-state blank-state--compact">
                    <strong>No budget pressure yet</strong>
                    <span>Pressure categories appear once the selected month has budget-aware activity.</span>
                  </div>
                )}
              </section>

              <section className="insights-v57__budget-panel">
                <div className="insights-v57__panel-head"><h3>Movers vs last month</h3></div>
                {categoryMovers.length ? (
                  <div className="insights-v57__mover-list">
                    {categoryMovers.map((item) => (
                      <button
                        aria-label={`Compare ${item.name} between ${currentMonthShortLabel} and ${previousMonthShortLabel}`}
                        className={`insights-v57__mover-row insights-v57__mover-row--${item.tone || 'neutral'} insights-v57__mover-row--interactive`}
                        key={item.id}
                        onClick={() => setDrillDown({ category: item, mode: 'compare' })}
                        type="button"
                      >
                        <div className="insights-v57__mover-head">
                          <div className="insights-v57__mover-main">
                            <div className="insights-v57__mover-icon" style={{ backgroundColor: item.soft, color: item.color }}>{item.symbol}</div>
                            <div className="insights-v57__mover-copy">
                              <strong>{item.name}</strong>
                              <span className={`insights-v57__status-chip insights-v57__status-chip--${item.tone}`}>{item.statusLabel}</span>
                            </div>
                          </div>
                          <span className={`insights-v57__mover-delta insights-v57__mover-delta--${item.deltaTone}`}>{formatSignedCurrency(item.deltaAmount)}</span>
                        </div>
                        <div className="insights-v57__mover-compare">
                          <div className="insights-v57__mover-compare-item">
                            <span>Last month</span>
                            <strong>{formatCurrency(item.previousAmount)}</strong>
                            <div className="insights-v57__mover-meter insights-v57__mover-meter--previous">
                              <span className="insights-v57__mover-meter-fill insights-v57__mover-meter-fill--previous" style={{ width: `${Math.max((Number(item.previousAmount ?? 0) / moverScaleMax) * 100, item.previousAmount > 0 ? 5 : 0)}%` }} />
                            </div>
                          </div>
                          <div className="insights-v57__mover-compare-item">
                            <span>This month</span>
                            <strong>{formatCurrency(item.amount)}</strong>
                            <div className="insights-v57__mover-meter insights-v57__mover-meter--current">
                              <span className={`insights-v57__mover-meter-fill insights-v57__mover-meter-fill--current insights-v57__mover-meter-fill--${item.tone}`} style={{ width: `${Math.max((Number(item.amount ?? 0) / moverScaleMax) * 100, item.amount > 0 ? 5 : 0)}%` }} />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="blank-state blank-state--compact">
                    <strong>No category movement yet</strong>
                    <span>Movers appear once there is current and previous month spending to compare.</span>
                  </div>
                )}
              </section>
            </div>
          </article>

          <article className="insights-v57__card savings-goals savings-goals--insights">
            <div className="insights-v57__card-header insights-v57__card-header--tight">
              <h2 className="insights-v57__title">Goals</h2>
              <span className="insights-v57__range-chip">{savingsGoals?.summary?.active_count ?? 0} active</span>
            </div>
            {savingsGoals?.summary?.active_count ? (
              <>
                <div className="savings-goals__summary savings-goals__summary--insights">
                  <article><span>Saved</span><strong>{formatCurrency(savingsGoals.summary.current_total)}</strong></article>
                  <article><span>Remaining</span><strong>{formatCurrency(savingsGoals.summary.remaining_total)}</strong></article>
                  <article><span>Monthly</span><strong>{formatCurrency(savingsGoals.summary.monthly_required_total)}</strong></article>
                </div>
                <div className="savings-goals__list savings-goals__list--compact">
                  {(savingsGoals.goals ?? []).slice(0, 2).map((goal) => (
                    <div className="savings-goal savings-goal--compact" key={goal.id}>
                      <div className="savings-goal__top">
                        <div><strong>{goal.name}</strong><span>{Math.round(goal.progress_percentage ?? 0)}% saved</span></div>
                        <span className="planner-status">{formatCurrency(goal.monthly_required)}/mo</span>
                      </div>
                      <div className="savings-goal__progress" role="progressbar" aria-label={`${goal.name} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goal.progress_percentage ?? 0)}>
                        <span style={{ width: `${Math.min(Number(goal.progress_percentage ?? 0), 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="blank-state blank-state--compact">
                <strong>No savings goals yet</strong>
                <span>Goals will show how future targets affect monthly budget room.</span>
              </div>
            )}
          </article>

          <article className="insights-v57__card insights-v57__rhythm-card">
            <div className="insights-v57__card-header insights-v57__card-header--tight">
              <h2 className="insights-v57__title">Daily rhythm</h2>
              <span className="insights-v57__range-chip">{activeMonthLabel}</span>
            </div>

            {dailySpend.series.length ? (
              <>
                <div className="insights-v57__rhythm-stage" ref={rhythmStageRef}>
                  {activeRhythmDay && rhythmTooltip ? (
                    <div className="insights-v57__rhythm-tooltip" role="status" style={{ left: `${rhythmTooltip.left}px`, top: `${rhythmTooltip.top}px` }}>
                      <strong>{formatShortDate(activeRhythmDay)}</strong>
                      <span>{formatCurrency(activeRhythmEntry?.amount ?? 0)} spent</span>
                    </div>
                  ) : null}
                  <div className="insights-v57__rhythm-bars">
                    {rhythmBars.columns.map((item) => (
                      <button
                        aria-label={`${formatShortDate(item.key)} spending: ${formatCurrency(item.amount)}`}
                        className={`insights-v57__rhythm-column${dailyPeak?.key === item.key ? ' insights-v57__rhythm-column--peak' : ''}`}
                        key={item.key}
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setActiveRhythmDay(null)
                            setRhythmTooltip(null)
                          }
                        }}
                        onFocus={(event) => showRhythmTooltip(event, item)}
                        onMouseEnter={(event) => showRhythmTooltip(event, item)}
                        onMouseLeave={() => {
                          setActiveRhythmDay(null)
                          setRhythmTooltip(null)
                        }}
                        type="button"
                      >
                        <span className="insights-v57__rhythm-column-fill" style={{ height: `${Math.max(item.heightRatio * 100, item.amount > 0 ? 8 : 0)}%` }} />
                      </button>
                    ))}
                  </div>
                  <div className="insights-v57__rhythm-axis">
                    {rhythmBars.tickDays.map((day) => <span className="insights-v57__rhythm-axis-tick" key={`tick-${day}`}>{day}</span>)}
                  </div>
                </div>

                <div className="insights-v57__rhythm-summary">
                  <div className="insights-v57__rhythm-ribbon-item"><span>Active days</span><strong>{dailySpend.activeDays}</strong></div>
                  <div className="insights-v57__rhythm-ribbon-item"><span>Spend / active day</span><strong>{formatCurrency(dailySpend.activeDayAverage ?? dailySpend.averageAmount)}</strong></div>
                  <div className="insights-v57__rhythm-ribbon-item insights-v57__rhythm-ribbon-item--peak">
                    <span>Peak day</span>
                    <strong>{dailyPeak ? formatShortDate(dailyPeak.key) : 'None yet'}</strong>
                    {dailyPeak ? <small>{formatCurrency(dailyPeak.amount)}</small> : null}
                  </div>
                </div>
              </>
            ) : (
              <div className="blank-state blank-state--compact">
                <strong>No daily spend pattern yet</strong>
                <span>Daily rhythm appears once the selected month starts recording expenses.</span>
              </div>
            )}

            {rhythmTopExpenses.length ? (
              <section className="insights-v57__rhythm-top-expenses" aria-label="Top expenses">
                <div className="insights-v57__rhythm-top-expenses-head">
                  <h3 className="insights-v57__rhythm-top-expenses-title">Top expenses</h3>
                  <Link className="insights-v57__top-expenses-more" href="/transactions">
                    View more
                  </Link>
                </div>
                <div className="insights-v57__top-expense-list insights-v57__top-expense-list--nested">
                  {rhythmTopExpenses.map((item, index) => (
                    <button
                      className="insights-v57__top-expense-row insights-v57__top-expense-row--interactive"
                      key={item.id}
                      onClick={() => setTopExpenseDetail({
                        id: item.id,
                        kind: 'expense',
                        title: item.title,
                        chip: item.categoryName,
                        categoryIcon: item.categoryIcon ?? null,
                        amount: item.amount,
                        occurredOn: item.occurredOn || item.key,
                        note: item.categoryName,
                        merchant: item.title,
                      })}
                      type="button"
                    >
                      <div className="insights-v57__top-expense-head">
                        <span className="insights-v57__top-expense-rank">{String(index + 1).padStart(2, '0')}</span>
                        <div className="insights-v57__top-expense-main">
                          <div className="insights-v57__top-expense-icon" style={{ backgroundColor: item.soft, color: item.color }}>{item.symbol}</div>
                          <div><strong>{item.title}</strong><span>{item.categoryName} · {formatShortDate(item.occurredOn)}</span></div>
                        </div>
                        <strong className="insights-v57__top-expense-amount">-{formatCurrency(item.amount)}</strong>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </article>
        </div>

        <section className="section-block insights-v57__pace-section" aria-label="Month over month pace">
          <div className="section-headline">
            <h2>Pace vs last month</h2>
            <span className="section-link">{currentMonthShortLabel} vs {previousMonthShortLabel}</span>
          </div>
          <div className="insights-v57__pace-card">
            <PaceVsLastMonthChart
              currentMonthSeries={paceCurrentSeries}
              previousMonthSeries={pacePreviousSeries}
              currentMonthLabel={currentMonthShortLabel}
              previousMonthLabel={previousMonthShortLabel}
              monthLength={getMonthLength(activeMonth)}
            />
          </div>
        </section>

      </div>
      {monthModal}
      <CategoryTransactionsModal
        isOpen={Boolean(drillDown)}
        onClose={() => setDrillDown(null)}
        category={drillDown?.category ?? null}
        currentMonthDetails={dailySpend.details ?? []}
        previousMonthDetails={drillDown?.mode === 'compare' ? (previousDailySpend.details ?? []) : null}
        currentMonthLabel={activeMonthLabel}
        previousMonthLabel={formatMonthLabel(snapshot?.previousMonth || previousMonth)}
      />
      {topExpenseDetail ? (
        <TransactionDetailSheet
          entry={topExpenseDetail}
          onClose={() => setTopExpenseDetail(null)}
        />
      ) : null}
    </section>
  )
}

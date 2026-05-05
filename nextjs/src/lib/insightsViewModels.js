import {
  formatCurrency,
  formatPercentage,
} from './financeUtils'

export const DONUT_VIEWBOX = 520
export const DONUT_CENTER = DONUT_VIEWBOX / 2
export const DONUT_RADIUS = 164
const DONUT_STROKE_WIDTH = 42
const DONUT_OUTER_RADIUS = DONUT_RADIUS + (DONUT_STROKE_WIDTH / 2)
const DONUT_MARKER_RADIUS = DONUT_OUTER_RADIUS + 42

export const CASHFLOW_WIDTH = 560
export const CASHFLOW_HEIGHT = 344
export const CASHFLOW_INSET_X = 32
const CASHFLOW_INSET_TOP = 24
const CASHFLOW_INSET_BOTTOM = 52
const CASHFLOW_BASELINE_RATIO = 0.53

const CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const RHYTHM_TICK_DAYS = [1, 7, 14, 21, 28]

export function getActiveBreakdownItems(snapshot, viewMode = 'expenses') {
  if (!snapshot) return []
  return viewMode === 'income'
    ? (snapshot.incomeBreakdown ?? [])
    : (snapshot.expenseBreakdown ?? [])
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export function formatSignedCurrency(value) {
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

export function getMetricValue(metric) {
  if (metric.id === 'budget-left' && metric.currentAmount == null) return 'No budget'
  return formatCurrency(metric.currentAmount ?? 0)
}

export function getMetricDeltaValue(metric) {
  if (metric.id === 'budget-left' && metric.currentAmount == null) return 'Set budget'
  if (metric.deltaAmount == null) return 'No baseline'
  if (metric.deltaAmount === 0) return 'Flat'
  if ((metric.previousAmount ?? 0) > 0 && metric.deltaPercentage != null) {
    return formatSignedPercentage(metric.deltaPercentage)
  }
  return formatSignedCurrency(metric.deltaAmount)
}

export function getMetricDeltaContext(metric) {
  if (metric.id === 'budget-left' && metric.currentAmount == null) return null
  if (metric.deltaAmount == null) return null
  return 'vs last month'
}

export function getMetricAccent(metricId) {
  if (metricId === 'income') return '\u2197'
  if (metricId === 'expenses') return '\u2198'
  if (metricId === 'net') return '\u223F'
  if (metricId === 'budget-left') return '\u25CE'
  return '\u2022'
}

export function pickTopExpensesFromDetails(details = [], limit = 10) {
  if (!Array.isArray(details) || !details.length) return []
  return [...details]
    .sort((left, right) => Number(right.amount ?? 0) - Number(left.amount ?? 0))
    .slice(0, limit)
}

export function getBudgetUsageHeadline(budgetHealth) {
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

export function buildDonutSegments(items = []) {
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

export function buildCashFlowGeometry(series = []) {
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

export function buildCalendarGrid(series = [], month) {
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

export function buildRhythmBars(series = []) {
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

export function buildDailyDetailMap(entries = []) {
  return entries.reduce((map, entry) => {
    if (!entry?.key) return map
    if (!map[entry.key]) map[entry.key] = []
    map[entry.key].push(entry)
    return map
  }, {})
}

export function buildCumulativeSeries(series = []) {
  let running = 0
  return series.map((item) => {
    running += Number(item?.amount ?? 0)
    return {
      day: Number(item?.day ?? 0),
      amount: Number(running.toFixed(2)),
    }
  })
}

export function getMonthLength(month) {
  if (!month) return 31
  const date = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 31
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
}

export function getMonthShortLabel(month) {
  if (!month) return 'Month'
  const date = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Month'
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

export function getDefaultSelectedDay(dailySpend) {
  if (dailySpend?.peakDay?.key) return dailySpend.peakDay.key
  const firstActiveDay = dailySpend?.series?.find((item) => Number(item.amount ?? 0) > 0)
  return firstActiveDay?.key ?? null
}

export function getCashFlowHighlights(cashFlowSeries = [], focusCashGroup = null) {
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

  return {
    cashFlowFocusTone,
    cashFlowHealthCopy,
    cashFlowHealthLabel,
    focusSavingsRate,
    highestExpenseMonth,
    positiveCashMonths,
    strongestCashMonth,
  }
}

export function getMoverScaleMax(categoryMovers = []) {
  return Math.max(
    ...categoryMovers.flatMap((entry) => [Number(entry.amount ?? 0), Number(entry.previousAmount ?? 0)]),
    1
  )
}

export function getFilenameFromDisposition(value, fallback) {
  if (!value) return fallback
  const filenameStarMatch = value.match(/(?:^|;)\s*filename\*\s*=\s*([^;]+)/i)
  const filenameMatch = value.match(/(?:^|;)\s*filename\s*=\s*("[^"]*"|[^;]+)/i)
  const candidate = filenameStarMatch
    ? decodeDispositionFilename(filenameStarMatch[1])
    : decodeDispositionFilename(filenameMatch?.[1])
  return sanitizeDownloadFilename(candidate, fallback)
}

function decodeDispositionFilename(value) {
  if (!value) return ''
  const text = value.trim().replace(/^"|"$/g, '')
  const encodedMatch = text.match(/^([^']*)'[^']*'(.*)$/)
  if (!encodedMatch) return text

  try {
    return decodeURIComponent(encodedMatch[2])
  } catch {
    return ''
  }
}

function sanitizeDownloadFilename(value, fallback) {
  const cleaned = String(value || '')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]+/g, '_')
    .trim()
    .slice(0, 120)

  if (!cleaned || cleaned === '.' || cleaned === '..' || !/[A-Za-z0-9]/.test(cleaned)) return fallback
  return cleaned
}

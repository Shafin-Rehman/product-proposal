'use client'

import { useMemo, useState } from 'react'
import { buildTrendChartAxes, formatCurrency } from '@/lib/financeUtils'
import TrendChartAxes from '@/components/ui/TrendChartAxes'

const CHART_WIDTH = 360
const CHART_HEIGHT = 168
const CHART_INSET_X = 12
const CHART_INSET_TOP = 16
const CHART_INSET_BOTTOM = 22

function buildLinePath(points) {
  if (!points.length) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function buildAreaPath(points, baselineY) {
  if (points.length < 2) return ''
  const linePath = buildLinePath(points)
  const last = points[points.length - 1]
  const first = points[0]
  return `${linePath} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`
}

function getCeiling(values, budget) {
  const filtered = values.filter((value) => Number.isFinite(value))
  const max = filtered.length ? Math.max(...filtered) : 0
  if (budget > 0) return Math.max(max * 1.06, budget * 1.06, 1)
  return Math.max(max * 1.18, max + 120, 1)
}

function projectPoints(values, ceiling) {
  const plotWidth = CHART_WIDTH - CHART_INSET_X * 2
  const plotHeight = CHART_HEIGHT - CHART_INSET_TOP - CHART_INSET_BOTTOM
  return values.map((value, index) => {
    const xRatio = values.length > 1 ? index / (values.length - 1) : 0
    const yRatio = ceiling > 0 ? Math.min(value / ceiling, 1) : 0
    return {
      x: CHART_INSET_X + plotWidth * xRatio,
      y: CHART_INSET_TOP + plotHeight * (1 - yRatio),
      value,
      day: index + 1,
    }
  })
}

function clampIndex(index, length) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

function getDeltaTone(actual, pace) {
  if (pace == null) return 'neutral'
  const delta = actual - pace
  const threshold = Math.max(pace * 0.03, 5)
  if (Math.abs(delta) <= threshold) return 'warning'
  return delta > 0 ? 'danger' : 'positive'
}

function getSegmentTone(actualValue, paceValue) {
  if (paceValue == null || paceValue <= 0) return 'neutral'
  const delta = actualValue - paceValue
  const threshold = Math.max(paceValue * 0.03, 5)
  if (Math.abs(delta) <= threshold) return 'warning'
  return delta > 0 ? 'danger' : 'positive'
}

function buildSegmentedPaths(points, paceValues) {
  if (points.length < 2 || !paceValues.length) {
    return [{ tone: 'neutral', d: buildLinePath(points) }]
  }
  const segments = []
  let currentTone = getSegmentTone(points[0].value, paceValues[0])
  let currentPoints = [points[0]]

  for (let i = 1; i < points.length; i += 1) {
    const tone = getSegmentTone(points[i].value, paceValues[i])
    if (tone !== currentTone) {
      segments.push({ tone: currentTone, d: buildLinePath(currentPoints) })
      currentPoints = [points[i - 1]]
      currentTone = tone
    }
    currentPoints.push(points[i])
  }
  if (currentPoints.length >= 1) {
    segments.push({ tone: currentTone, d: buildLinePath(currentPoints) })
  }
  return segments
}

export default function MonthPacingChart({
  trendPoints = [],
  budget = 0,
  monthLength = 30,
  activeDay = null,
  isOverBudget = false,
  emptyState = null,
}) {
  const [hoverIndex, setHoverIndex] = useState(null)

  const ceiling = useMemo(() => getCeiling(trendPoints, budget), [trendPoints, budget])
  const points = useMemo(() => projectPoints(trendPoints, ceiling), [trendPoints, ceiling])

  const paceValues = useMemo(() => {
    if (budget <= 0 || monthLength <= 0) return []
    return trendPoints.map((_, index) => {
      const day = index + 1
      return Number(((budget * day) / Math.max(monthLength, 1)).toFixed(2))
    })
  }, [budget, monthLength, trendPoints])

  const segmentedPaths = useMemo(
    () => buildSegmentedPaths(points, paceValues),
    [points, paceValues]
  )
  const axes = useMemo(() => buildTrendChartAxes({
    budget,
    monthLength,
    activeDay: activeDay ?? trendPoints.length,
    pointCount: trendPoints.length,
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    inset: CHART_INSET_X,
    insetTop: CHART_INSET_TOP,
    insetBottom: CHART_INSET_BOTTOM,
    valueCeiling: ceiling,
  }), [budget, ceiling, monthLength, activeDay, trendPoints.length])

  if (!trendPoints.length) {
    return emptyState
  }

  const baselineY = CHART_HEIGHT - CHART_INSET_BOTTOM
  const linePath = buildLinePath(points)
  const areaPath = buildAreaPath(points, baselineY)
  const lastIndex = points.length - 1
  const focusedIndex = hoverIndex == null ? lastIndex : clampIndex(hoverIndex, points.length)
  const focusedPoint = points[focusedIndex]
  const focusedActual = trendPoints[focusedIndex] ?? 0
  const focusedDay = focusedPoint?.day ?? 0
  const monthLengthSafe = Math.max(monthLength, 1)
  const focusedPace = budget > 0 ? Number(((budget * focusedDay) / monthLengthSafe).toFixed(2)) : null
  const focusedDelta = focusedPace == null ? null : Number((focusedActual - focusedPace).toFixed(2))
  const deltaTone = isOverBudget && focusedIndex === lastIndex
    ? 'danger'
    : getDeltaTone(focusedActual, focusedPace)
  const plotHeight = CHART_HEIGHT - CHART_INSET_TOP - CHART_INSET_BOTTOM
  const midPlotY = CHART_INSET_TOP + plotHeight * 0.4
  const calloutLeftRaw = (focusedPoint.x / CHART_WIDTH) * 100
  const calloutLeft = Math.max(4, Math.min(calloutLeftRaw, 96))
  const calloutNudgeY = 6
  const placeCalloutBelow = focusedPoint.y < midPlotY
  const calloutPosition = placeCalloutBelow
    ? {
      left: `${calloutLeft}%`,
      top: `${Math.min(focusedPoint.y + calloutNudgeY, baselineY - 4)}px`,
      transform: 'translate(-50%, 0)',
    }
    : {
      left: `${calloutLeft}%`,
      top: `${Math.max(focusedPoint.y - calloutNudgeY, CHART_INSET_TOP + 4)}px`,
      transform: 'translate(-50%, -100%)',
    }
  const isAhead = focusedDelta != null && focusedDelta > 0
  const isBehind = focusedDelta != null && focusedDelta < 0
  const deltaLabel = focusedDelta == null
    ? 'No budget'
    : Math.abs(focusedDelta) < 0.5
      ? 'On pace'
      : isAhead
        ? `${formatCurrency(Math.abs(focusedDelta))} over pace`
        : `${formatCurrency(Math.abs(focusedDelta))} under pace`
  const chartSpendTone = focusedPace == null
    ? 'neutral'
    : getDeltaTone(focusedActual, focusedPace)
  const areaFillId = 'monthPacingFillNeutral'

  function pickIndexFromLocalX(localX) {
    if (!points.length) return 0
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length; i += 1) {
      const d = Math.abs(points[i].x - localX)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }

  function handlePointerMove(event) {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0) return
    const localX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH
    setHoverIndex(pickIndexFromLocalX(localX))
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      setHoverIndex((current) => clampIndex((current ?? lastIndex) - 1, points.length))
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      setHoverIndex((current) => clampIndex((current ?? lastIndex) + 1, points.length))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHoverIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHoverIndex(lastIndex)
    } else if (event.key === 'Escape') {
      setHoverIndex(null)
    }
  }

  const focusedAriaLabel = `Day ${focusedDay}: ${formatCurrency(focusedActual)} cumulative spend${
    focusedPace != null ? `, pace ${formatCurrency(focusedPace)}, ${deltaLabel.toLowerCase()}` : ''
  }`

  return (
    <div
      className={`month-pacing month-pacing--spend-${chartSpendTone}${isOverBudget ? ' month-pacing--over' : ''}${hoverIndex != null ? ' month-pacing--inspecting' : ''}`}
    >
      <div className="month-pacing__frame">
        <div className="month-pacing__y-axis" aria-hidden="true"></div>
        <div className="month-pacing__plot">
          <svg
            aria-label={focusedAriaLabel}
            className="month-pacing__svg"
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={handlePointerMove}
            onKeyDown={handleKeyDown}
            onBlur={() => setHoverIndex(null)}
            preserveAspectRatio="none"
            role="img"
            tabIndex={0}
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          >
            <defs>
              <linearGradient id="monthPacingFillPositive" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(79, 123, 97, 0.38)" />
                <stop offset="100%" stopColor="rgba(79, 123, 97, 0.04)" />
              </linearGradient>
              <linearGradient id="monthPacingFillWarning" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(201, 130, 90, 0.4)" />
                <stop offset="100%" stopColor="rgba(201, 130, 90, 0.05)" />
              </linearGradient>
              <linearGradient id="monthPacingFillDanger" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(183, 95, 103, 0.42)" />
                <stop offset="100%" stopColor="rgba(183, 95, 103, 0.06)" />
              </linearGradient>
              <linearGradient id="monthPacingFillNeutral" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(111, 126, 116, 0.16)" />
                <stop offset="100%" stopColor="rgba(111, 126, 116, 0.02)" />
              </linearGradient>
            </defs>
            <TrendChartAxes axes={axes} />
            <path className="month-pacing__area" d={areaPath} fill={`url(#${areaFillId})`} />
            {segmentedPaths.map((segment, segIndex) => (
              <path
                className={`month-pacing__line month-pacing__line--${segment.tone}`}
                d={segment.d}
                fill="none"
                key={`seg-${segIndex}`}
              />
            ))}
            <line
              className="month-pacing__guide"
              x1={focusedPoint.x}
              x2={focusedPoint.x}
              y1={CHART_INSET_TOP}
              y2={baselineY}
            />
            <circle
              className={`month-pacing__point${isOverBudget && focusedIndex === lastIndex ? ' month-pacing__point--warning' : ''}`}
              cx={focusedPoint.x}
              cy={focusedPoint.y}
              r="5"
            />
          </svg>
          <div
            className={`month-pacing__callout month-pacing__callout--${deltaTone}${placeCalloutBelow ? ' month-pacing__callout--below' : ''}`}
            style={calloutPosition}
            role="status"
          >
            <span className="month-pacing__callout-day">Day {focusedDay}</span>
            <strong className="month-pacing__callout-value">{formatCurrency(focusedActual)}</strong>
            <span className="month-pacing__callout-delta">{deltaLabel}</span>
          </div>
        </div>
      </div>
      <div className="month-pacing__x-axis" aria-hidden="true">
        <span>Day 1</span>
        <span>{`Day ${monthLength}`}</span>
      </div>
      <div className="month-pacing__snapshot" aria-live="polite">
        <span className="month-pacing__snapshot-label">Through day {focusedDay}</span>
        <span className="month-pacing__snapshot-actual">
          <strong>{formatCurrency(focusedActual)}</strong> actual
        </span>
        {focusedPace != null ? (
          <span className="month-pacing__snapshot-pace">
            {formatCurrency(focusedPace)} pace · <em>{deltaLabel}</em>
          </span>
        ) : (
          <span className="month-pacing__snapshot-pace">Set a budget to see pace</span>
        )}
      </div>
      <dl className="month-pacing__legend">
        <div className="month-pacing__legend-item month-pacing__legend-item--actual">
          <dt>Actual</dt>
          <dd>{formatCurrency(focusedActual)}</dd>
        </div>
        {focusedPace != null ? (
          <div className="month-pacing__legend-item month-pacing__legend-item--pace">
            <dt>Pace</dt>
            <dd>{formatCurrency(focusedPace)}</dd>
          </div>
        ) : null}
        {budget > 0 ? (
          <div className="month-pacing__legend-item month-pacing__legend-item--budget">
            <dt>Budget</dt>
            <dd>{formatCurrency(budget)}</dd>
          </div>
        ) : null}
        {focusedDelta != null ? (
          <div className={`month-pacing__legend-item month-pacing__legend-item--delta month-pacing__legend-item--${isAhead ? 'over' : isBehind ? 'under' : 'even'}`}>
            <dt>Status</dt>
            <dd>{deltaLabel}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

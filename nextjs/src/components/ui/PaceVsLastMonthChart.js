'use client'

import { useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/financeUtils'

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 156
const INSET_X = 16
const INSET_TOP = 18
const INSET_BOTTOM = 26

function toSafeAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
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

function buildSegmentedSmoothPaths(points, previousPoints) {
  if (points.length < 2 || !previousPoints.length) {
    return [{ tone: 'positive', d: buildSmoothPath(points) }]
  }

  const previousByDay = new Map(previousPoints.map((point) => [point.day, point.amount]))
  const getTone = (point) => {
    const previousAmount = previousByDay.get(point.day)
    if (previousAmount == null) return 'positive'
    const threshold = Math.max(previousAmount * 0.03, 5)
    return point.amount > previousAmount + threshold ? 'warning' : 'positive'
  }

  return points.slice(1).map((point, index) => ({
    tone: getTone(point),
    d: buildSmoothPath([points[index], point]),
  }))
}

function projectPoints(series, maxDayCount, maxAmount) {
  if (!series.length || maxDayCount <= 0 || maxAmount <= 0) return []
  const plotWidth = VIEW_WIDTH - INSET_X * 2
  const plotHeight = VIEW_HEIGHT - INSET_TOP - INSET_BOTTOM
  return series.map((item) => {
    const day = Math.max(1, Math.min(Number(item.day ?? 0), maxDayCount))
    const amount = toSafeAmount(item.amount)
    const xRatio = maxDayCount > 1 ? (day - 1) / (maxDayCount - 1) : 0
    const yRatio = Math.min(amount / maxAmount, 1)
    return {
      x: INSET_X + plotWidth * xRatio,
      y: INSET_TOP + plotHeight * (1 - yRatio),
      day,
      amount,
    }
  })
}

function clampIndex(value, length) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(value, length - 1))
}

export default function PaceVsLastMonthChart({
  currentMonthSeries = [],
  previousMonthSeries = [],
  currentMonthLabel = 'This month',
  previousMonthLabel = 'Last month',
  monthLength = 31,
}) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const [isPlotActive, setIsPlotActive] = useState(false)

  const hasCurrent = currentMonthSeries.some((item) => toSafeAmount(item?.amount) > 0)
  const hasPrevious = previousMonthSeries.some((item) => toSafeAmount(item?.amount) > 0)

  const maxDayCount = useMemo(() => Math.max(
    monthLength,
    previousMonthSeries.at(-1)?.day ?? 0,
    currentMonthSeries.at(-1)?.day ?? 0,
    1,
  ), [currentMonthSeries, previousMonthSeries, monthLength])

  const maxAmount = useMemo(() => Math.max(
    ...currentMonthSeries.map((item) => toSafeAmount(item?.amount)),
    ...previousMonthSeries.map((item) => toSafeAmount(item?.amount)),
    1,
  ), [currentMonthSeries, previousMonthSeries])

  const currentPoints = useMemo(
    () => projectPoints(currentMonthSeries, maxDayCount, maxAmount),
    [currentMonthSeries, maxDayCount, maxAmount],
  )
  const previousPoints = useMemo(
    () => projectPoints(previousMonthSeries, maxDayCount, maxAmount),
    [previousMonthSeries, maxDayCount, maxAmount],
  )

  if (!hasPrevious && !hasCurrent) {
    return (
      <div className="pace-chart pace-chart--empty">
        <strong>Month-over-month pace appears once you have activity to compare.</strong>
        <span>Add transactions this month and last month to see how your pace compares.</span>
      </div>
    )
  }

  const currentEnd = currentPoints[currentPoints.length - 1] ?? null
  const lastIndex = (hasCurrent ? currentPoints.length : previousPoints.length) - 1
  const focusedIndex = hoverIndex == null ? lastIndex : clampIndex(hoverIndex, hasCurrent ? currentPoints.length : previousPoints.length)
  const focusedDay = (hasCurrent ? currentPoints[focusedIndex] : previousPoints[focusedIndex])?.day ?? 0
  const focusedCurrent = hasCurrent ? currentPoints[focusedIndex] : null
  const focusedPrevious = hasPrevious
    ? previousPoints.find((point) => point.day === focusedDay)
      ?? previousPoints[focusedDay - 1]
      ?? previousPoints[previousPoints.length - 1]
    : null
  const focusedDelta = focusedCurrent && focusedPrevious
    ? Number((toSafeAmount(focusedCurrent.amount) - toSafeAmount(focusedPrevious.amount)).toFixed(2))
    : null
  const isAhead = focusedDelta != null && focusedDelta > 0
  const isBehind = focusedDelta != null && focusedDelta < 0
  const focusedDeltaLabel = focusedDelta == null
    ? 'No baseline'
    : Math.abs(focusedDelta) < 0.5
      ? 'On pace with last month'
      : isAhead
        ? `Faster than last month by ${formatCurrency(Math.abs(focusedDelta))}`
        : `Slower than last month by ${formatCurrency(Math.abs(focusedDelta))}`

  const currentSegments = buildSegmentedSmoothPaths(currentPoints, previousPoints)
  const previousPath = buildSmoothPath(previousPoints)

  const guideX = focusedCurrent?.x ?? focusedPrevious?.x ?? null
  const plotPoints = hasCurrent ? currentPoints : previousPoints
  const calloutLeftRaw = guideX != null ? (guideX / VIEW_WIDTH) * 100 : 50
  const calloutLeft = Math.max(4, Math.min(calloutLeftRaw, 96))
  const showCallout = isPlotActive
  const plotHeight = VIEW_HEIGHT - INSET_TOP - INSET_BOTTOM
  const midY = INSET_TOP + plotHeight * 0.38
  const anchorY = focusedCurrent?.y ?? focusedPrevious?.y ?? midY
  const placeCalloutBelow = anchorY < midY
  const calloutStyle = placeCalloutBelow
    ? {
      left: `${calloutLeft}%`,
      top: `${Math.min(anchorY + 12, VIEW_HEIGHT - INSET_BOTTOM - 2)}px`,
      transform: 'translate(-50%, 0)',
      maxWidth: 'min(200px, 46vw)',
    }
    : {
      left: `${calloutLeft}%`,
      top: `${Math.max(anchorY - 10, INSET_TOP + 2)}px`,
      transform: 'translate(-50%, -100%)',
      maxWidth: 'min(200px, 46vw)',
    }

  function pickIndexFromLocalX(localX) {
    const linePoints = plotPoints
    if (!linePoints.length) return 0
    if (linePoints.length === 1) return 0
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < linePoints.length; i += 1) {
      const d = Math.abs(linePoints[i].x - localX)
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
    const localX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH
    const idx = pickIndexFromLocalX(localX)
    setHoverIndex(idx)
  }

  function handleKeyDown(event) {
    if (
      event.key === 'ArrowLeft'
      || event.key === 'ArrowDown'
      || event.key === 'ArrowRight'
      || event.key === 'ArrowUp'
      || event.key === 'Home'
      || event.key === 'End'
    ) {
      setIsPlotActive(true)
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      setHoverIndex((current) => clampIndex((current ?? lastIndex) - 1, lastIndex + 1))
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      setHoverIndex((current) => clampIndex((current ?? lastIndex) + 1, lastIndex + 1))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHoverIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHoverIndex(lastIndex)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setHoverIndex(null)
      setIsPlotActive(false)
      event.currentTarget.blur()
    }
  }

  const ariaLabel = `Cumulative spend ${currentMonthLabel} vs ${previousMonthLabel}. Day ${focusedDay}: ${currentMonthLabel} ${formatCurrency(focusedCurrent?.amount ?? 0)}, ${previousMonthLabel} ${formatCurrency(focusedPrevious?.amount ?? 0)}.`

  return (
    <div
      className={`pace-chart${hoverIndex != null ? ' pace-chart--inspecting' : ''}`}
      data-has-previous={hasPrevious ? 'true' : 'false'}
    >
      <div className="pace-chart__legend" role="list">
        <span className="pace-chart__legend-item pace-chart__legend-item--current" role="listitem">
          <span className="pace-chart__swatch pace-chart__swatch--current" aria-hidden="true" />
          {currentMonthLabel}
        </span>
        <span className="pace-chart__legend-item pace-chart__legend-item--previous" role="listitem">
          <span className="pace-chart__swatch pace-chart__swatch--previous" aria-hidden="true" />
          {previousMonthLabel}
        </span>
      </div>

      <div className="pace-chart__default-summary" aria-live="polite">
        <span className="pace-chart__default-day">Day {focusedDay}</span>
        <span className="pace-chart__default-current">{currentMonthLabel} <strong>{formatCurrency(focusedCurrent?.amount ?? 0)}</strong></span>
        {focusedPrevious ? (
          <span className="pace-chart__default-prev">{previousMonthLabel} {formatCurrency(focusedPrevious.amount)}</span>
        ) : null}
        <span className={`pace-chart__default-delta pace-chart__default-delta--${isAhead ? 'ahead' : isBehind ? 'behind' : 'even'}`}>{focusedDeltaLabel}</span>
      </div>

      <div
        className="pace-chart__plot"
        onMouseEnter={() => setIsPlotActive(true)}
        onMouseLeave={() => {
          setIsPlotActive(false)
          setHoverIndex(null)
        }}
      >
        <svg
          aria-label={ariaLabel}
          className="pace-chart__svg"
          onMouseMove={handlePointerMove}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsPlotActive(true)}
          onBlur={() => {
            setIsPlotActive(false)
            setHoverIndex(null)
          }}
          preserveAspectRatio="none"
          role="img"
          tabIndex={0}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        >
          <line
            className="pace-chart__baseline"
            x1={INSET_X}
            x2={VIEW_WIDTH - INSET_X}
            y1={VIEW_HEIGHT - INSET_BOTTOM}
            y2={VIEW_HEIGHT - INSET_BOTTOM}
          />

          {previousPath ? <path className="pace-chart__line pace-chart__line--previous" d={previousPath} /> : null}
          {currentSegments.map((segment, index) => (
            segment.d ? (
              <path
                className={`pace-chart__line pace-chart__line--current pace-chart__line--current-${segment.tone}`}
                d={segment.d}
                key={`current-${index}`}
              />
            ) : null
          ))}

          {currentEnd ? (
            <line
              className="pace-chart__today-divider"
              x1={currentEnd.x}
              x2={currentEnd.x}
              y1={INSET_TOP}
              y2={VIEW_HEIGHT - INSET_BOTTOM}
            />
          ) : null}

          {guideX != null ? (
            <line
              className="pace-chart__guide"
              x1={guideX}
              x2={guideX}
              y1={INSET_TOP}
              y2={VIEW_HEIGHT - INSET_BOTTOM}
            />
          ) : null}

          {focusedCurrent ? <circle className="pace-chart__point pace-chart__point--current" cx={focusedCurrent.x} cy={focusedCurrent.y} r="4.25" /> : null}
          {focusedPrevious ? <circle className="pace-chart__point pace-chart__point--previous" cx={focusedPrevious.x} cy={focusedPrevious.y} r="3.5" /> : null}
        </svg>

        {showCallout ? (
          <div
            className={`pace-chart__callout pace-chart__callout--${isAhead ? 'ahead' : isBehind ? 'behind' : 'even'}${placeCalloutBelow ? ' pace-chart__callout--below' : ''}`}
            style={calloutStyle}
            role="status"
          >
            <span className="pace-chart__callout-day">Day {focusedDay}</span>
            <strong className="pace-chart__callout-current">{currentMonthLabel} {formatCurrency(focusedCurrent?.amount ?? 0)}</strong>
            {focusedPrevious ? (
              <span className="pace-chart__callout-previous">{previousMonthLabel} {formatCurrency(focusedPrevious.amount)}</span>
            ) : null}
            <span className="pace-chart__callout-delta">{focusedDeltaLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="pace-chart__x-axis" aria-hidden="true">
        <span>Day 1</span>
        <span>{`Day ${monthLength}`}</span>
      </div>
    </div>
  )
}

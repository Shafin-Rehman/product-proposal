'use client'

function clampPercent(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.max(0, Math.min(amount, 100))
}

function getMonthMarkerPercent(activeDay, monthLength) {
  if (!monthLength || monthLength <= 0) return null
  if (!activeDay || activeDay <= 0) return null
  const raw = (activeDay / monthLength) * 100
  return clampPercent(raw)
}

export default function AllocationBar({
  progressPercentage = 0,
  tone = 'neutral',
  ariaLabel = 'Budget progress',
  ariaValueText,
  monthLength = null,
  activeDay = null,
  monthMarkerLabel = null,
  isOverBudget = false,
  showMarker = true,
}) {
  const safeProgress = clampPercent(progressPercentage)
  const markerPercent = showMarker ? getMonthMarkerPercent(activeDay, monthLength) : null

  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(safeProgress)}
      aria-valuetext={ariaValueText || undefined}
      className={`allocation-bar allocation-bar--${tone}${isOverBudget ? ' allocation-bar--over' : ''}`}
      role="progressbar"
    >
      <span
        className={`allocation-bar__fill allocation-bar__fill--${tone}`}
        style={{ width: `${safeProgress}%` }}
      />
      {markerPercent != null ? (
        <>
          <span
            aria-hidden="true"
            className="allocation-bar__marker"
            style={{ left: `${markerPercent}%` }}
            data-testid="allocation-bar-marker"
            title={monthMarkerLabel || undefined}
          />
          {monthMarkerLabel ? (
            <span
              aria-hidden="true"
              className="allocation-bar__marker-label"
              style={{ left: `${markerPercent}%` }}
            >
              {monthMarkerLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

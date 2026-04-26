'use client'

export default function TrendChartAxes({ axes }) {
  if (!axes) return null
  const { paceLine, budgetLineY, budgetLineLabel, plotLeft, plotRight } = axes
  const labelX = (plotRight ?? 0) - 4
  const labelY = budgetLineY != null ? budgetLineY - 5 : 0

  return (
    <g aria-hidden="true" className="trend-chart__axes">
      {budgetLineY != null ? (
        <line
          className="trend-chart__budget-line"
          x1={plotLeft}
          x2={plotRight}
          y1={budgetLineY}
          y2={budgetLineY}
        />
      ) : null}

      {/* budgetLineLabel removed to avoid visual clutter */}

      {paceLine ? (
        <line
          className="trend-chart__pace-line"
          x1={paceLine.startX}
          x2={paceLine.endX}
          y1={paceLine.startY}
          y2={paceLine.endY}
        />
      ) : null}
    </g>
  )
}

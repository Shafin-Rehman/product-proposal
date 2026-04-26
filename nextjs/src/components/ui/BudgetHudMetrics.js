'use client'

export default function BudgetHudMetrics({ metrics = [] }) {
  if (!Array.isArray(metrics) || metrics.length === 0) return null

  return (
    <dl className="budget-hud-metrics">
      {metrics.map((metric) => (
        <div className="budget-hud-metrics__item" key={metric.label}>
          <dt className="budget-hud-metrics__label">{metric.label}</dt>
          <dd className="budget-hud-metrics__value">
            <strong>{metric.value}</strong>
            {metric.hint ? <small className="budget-hud-metrics__hint">{metric.hint}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

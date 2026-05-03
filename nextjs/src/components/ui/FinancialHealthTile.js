'use client'

import { formatCurrency } from '@/lib/financeUtils'

function toSafeNumber(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function buildSegments(income, expenses) {
  const total = Math.max(income + expenses, 0)
  if (total <= 0) {
    return { incomeWidth: 0, expenseWidth: 0, total: 0 }
  }
  return {
    incomeWidth: Math.max((income / total) * 100, income > 0 ? 4 : 0),
    expenseWidth: Math.max((expenses / total) * 100, expenses > 0 ? 4 : 0),
    total,
  }
}

export default function FinancialHealthTile({ health, income, expenses }) {
  if (!health) return null

  const safeIncome = toSafeNumber(income)
  const safeExpenses = toSafeNumber(expenses)
  const { incomeWidth, expenseWidth, total } = buildSegments(safeIncome, safeExpenses)
  const tone = health.tone || 'neutral'
  const isUnavailable = health.key === 'unavailable' || health.key === 'loading'
  const showSegments = !isUnavailable && total > 0

  return (
    <article
      aria-label={`Financial health: ${health.label}`}
      className={`health-tile health-tile--${tone}`}
    >
      <header className="health-tile__header">
        <span className="health-tile__eyebrow">Financial health</span>
        <strong className="health-tile__label">{health.label}</strong>
      </header>

      {showSegments ? (
        <>
          <div
            aria-hidden="true"
            className="health-tile__bar"
          >
            <span
              className="health-tile__segment health-tile__segment--income"
              style={{ width: `${incomeWidth}%` }}
            />
            <span
              className="health-tile__segment health-tile__segment--expense"
              style={{ width: `${expenseWidth}%` }}
            />
          </div>

          <dl className="health-tile__legend">
            <div>
              <dt>Income</dt>
              <dd>{formatCurrency(safeIncome)}</dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd>{formatCurrency(safeExpenses)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="health-tile__placeholder">{health.detailText}</p>
      )}

      <div className={`health-tile__net health-tile__net--${tone}`}>
        <span>Net</span>
        <strong>{health.valueText}</strong>
      </div>
    </article>
  )
}

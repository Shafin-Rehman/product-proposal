'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency, formatPercentage } from '@/lib/financeUtils'

function toSafeNumber(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function formatDelta(value) {
  if (value == null || !Number.isFinite(value)) return '--'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(value))}`
}

export default function CashFlowSnapshot({
  income,
  expenses,
  trend = [],
  monthLabel = 'This month',
  viewMoreHref = null,
}) {
  const [hoveredMonth, setHoveredMonth] = useState(null)

  const safeIncome = toSafeNumber(income)
  const safeExpenses = toSafeNumber(expenses)
  const netAmount = Number((safeIncome - safeExpenses).toFixed(2))
  const tone = netAmount > 0 ? 'positive' : netAmount < 0 ? 'danger' : 'neutral'
  const hasMonthData = safeIncome > 0 || safeExpenses > 0
  const trendPeak = trend.reduce(
    (acc, item) => Math.max(acc, Math.abs(toSafeNumber(item?.netAmount))),
    0,
  )
  const hoveredTrendItem = hoveredMonth
    ? trend.find((item) => item.month === hoveredMonth) ?? null
    : null
  const trendReadoutItem = hoveredTrendItem ?? (trend.length ? trend[trend.length - 1] : null)
  const trendFocus = Boolean(hoveredTrendItem)
  const displayIncome = trendFocus
    ? toSafeNumber(hoveredTrendItem.incomeAmount)
    : safeIncome
  const displayExpenses = trendFocus
    ? toSafeNumber(hoveredTrendItem.expenseAmount)
    : safeExpenses
  const displayNet = trendFocus
    ? toSafeNumber(hoveredTrendItem.netAmount)
    : netAmount
  const displaySavings = displayIncome > 0
    ? (displayNet / displayIncome) * 100
    : null
  const displayLabel = trendFocus && hoveredTrendItem
    ? hoveredTrendItem.label
    : monthLabel
  const maxBarValue = Math.max(displayIncome, displayExpenses, 1)
  const incomeBarWidth = Math.max((displayIncome / maxBarValue) * 100, displayIncome > 0 ? 4 : 0)
  const expenseBarWidth = Math.max((displayExpenses / maxBarValue) * 100, displayExpenses > 0 ? 4 : 0)
  const displayTone = displayNet > 0 ? 'positive' : displayNet < 0 ? 'danger' : 'neutral'
  const readoutNet = trendReadoutItem ? toSafeNumber(trendReadoutItem.netAmount) : null
  const readoutTone = readoutNet == null ? 'neutral' : readoutNet >= 0 ? 'positive' : 'danger'

  return (
    <article
      aria-label={`Cash flow for ${displayLabel}`}
      className={`cashflow-snapshot cashflow-snapshot--${displayTone}`}
    >
      <div className="cashflow-snapshot__header">
        <div className="cashflow-snapshot__headings">
          <h2 className="cashflow-snapshot__heading">Cash flow</h2>
          <p className="cashflow-snapshot__period">
            {displayLabel}
            {trendFocus ? <span className="cashflow-snapshot__period-hint"> · trend month</span> : null}
          </p>
        </div>
        {viewMoreHref ? (
          <Link className="section-link" href={viewMoreHref}>
            View more
          </Link>
        ) : null}
      </div>

      {hasMonthData || trendFocus ? (
        <div className="cashflow-snapshot__bars" aria-hidden="true">
          <div className="cashflow-snapshot__row cashflow-snapshot__row--income">
            <span className="cashflow-snapshot__row-label">Income</span>
            <span className="cashflow-snapshot__row-bar">
              <span
                className="cashflow-snapshot__row-fill cashflow-snapshot__row-fill--income"
                style={{ width: `${incomeBarWidth}%` }}
              />
            </span>
            <strong className="cashflow-snapshot__row-value">{formatCurrency(displayIncome)}</strong>
          </div>
          <div className="cashflow-snapshot__row cashflow-snapshot__row--expense">
            <span className="cashflow-snapshot__row-label">Expenses</span>
            <span className="cashflow-snapshot__row-bar">
              <span
                className="cashflow-snapshot__row-fill cashflow-snapshot__row-fill--expense"
                style={{ width: `${expenseBarWidth}%` }}
              />
            </span>
            <strong className="cashflow-snapshot__row-value">{formatCurrency(displayExpenses)}</strong>
          </div>
        </div>
      ) : (
        <p className="cashflow-snapshot__empty">Your income vs expense shape will appear once the month has activity.</p>
      )}

      <div className="cashflow-snapshot__summary">
        <div className={`cashflow-snapshot__net cashflow-snapshot__net--${displayTone}`}>
          <span>Net</span>
          <strong>
            {displayNet > 0 ? '+' : ''}
            {formatCurrency(displayNet)}
          </strong>
        </div>
        <div className="cashflow-snapshot__savings">
          <span>Savings rate</span>
          <strong>{displaySavings == null ? '--' : formatPercentage(displaySavings)}</strong>
        </div>
      </div>

      {trend.length ? (
        <div
          className="cashflow-snapshot__trend"
          aria-label="Recent net cash flow trend"
          role="group"
          onMouseLeave={() => setHoveredMonth(null)}
        >
          <p className="cashflow-snapshot__trend-caption">Last 3 months — net after expenses</p>
          <div className="cashflow-snapshot__trend-bars">
            {trend.map((item) => {
              const value = toSafeNumber(item.netAmount)
              const heightRatio = trendPeak > 0 ? Math.abs(value) / trendPeak : 0
              const barHeight = Math.max(heightRatio * 100, value !== 0 ? 8 : 0)
              const barTone = value >= 0 ? 'positive' : 'danger'
              const isFocused = trendReadoutItem?.month === item.month
              const barOpacity = isFocused ? 1 : 0.45 + (heightRatio * 0.55)
              return (
                <button
                  aria-label={`${item.label} net ${formatDelta(value)}`}
                  aria-pressed={isFocused}
                  className={`cashflow-snapshot__trend-col cashflow-snapshot__trend-col--${barTone}${isFocused ? ' cashflow-snapshot__trend-col--focused' : ''}`}
                  key={item.month}
                  onMouseEnter={() => setHoveredMonth(item.month)}
                  onFocus={() => setHoveredMonth(item.month)}
                  onBlur={() => setHoveredMonth(null)}
                  type="button"
                >
                  <span className="cashflow-snapshot__trend-bar-wrap">
                    <span
                      aria-hidden="true"
                      className={`cashflow-snapshot__trend-bar cashflow-snapshot__trend-bar--${barTone}`}
                      style={{ height: `${barHeight}%`, opacity: barOpacity }}
                    />
                  </span>
                  <small>{item.label}</small>
                </button>
              )
            })}
          </div>
          <div className={`cashflow-snapshot__trend-readout cashflow-snapshot__trend-readout--${readoutTone}`} role="status">
            <div className="cashflow-snapshot__trend-readout-main">
              <span>
                {trendReadoutItem
                  ? (hoveredTrendItem ? `${hoveredTrendItem.label} selected` : `${trendReadoutItem.label} latest`)
                  : '3-month net trend'}
              </span>
              <strong>{formatDelta(readoutNet)}</strong>
            </div>
            {trendReadoutItem ? (
              <div className="cashflow-snapshot__trend-readout-detail">
                <span>Inc {formatCurrency(toSafeNumber(trendReadoutItem.incomeAmount))}</span>
                <span>Exp {formatCurrency(toSafeNumber(trendReadoutItem.expenseAmount))}</span>
                <span>
                  Save{' '}
                  {toSafeNumber(trendReadoutItem.incomeAmount) > 0
                    ? formatPercentage((toSafeNumber(trendReadoutItem.netAmount) / toSafeNumber(trendReadoutItem.incomeAmount)) * 100)
                    : '—'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  )
}

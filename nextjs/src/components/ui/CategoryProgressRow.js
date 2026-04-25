'use client'

import { formatCurrency } from '@/lib/financeUtils'

function clampPercent(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.max(0, Math.min(amount, 100))
}

function shouldRenderChip(statusLabel, tone, mode) {
  if (!statusLabel) return false
  if (mode === 'always') return true
  if (mode === 'never') return false
  return tone === 'warning' || tone === 'danger'
}

export default function CategoryProgressRow({
  name,
  symbol,
  color = 'var(--accent)',
  soft = 'var(--accent-soft)',
  amount = 0,
  monthlyLimit = null,
  progressPercentage = 0,
  remainingAmount = null,
  tone = 'neutral',
  statusLabel = null,
  fallbackShareText = null,
  showStatusChip = 'auto',
  onSelect = null,
  selectLabel = null,
}) {
  const hasBudget = monthlyLimit != null && Number(monthlyLimit) > 0
  const isOverBudget = hasBudget && remainingAmount != null && Number(remainingAmount) < 0
  const safeProgress = clampPercent(progressPercentage)
  const barFillWidth = Math.max(safeProgress, amount > 0 ? 4 : 0)
  const amountDisplay = hasBudget
    ? `${formatCurrency(amount)} / ${formatCurrency(monthlyLimit)}`
    : formatCurrency(amount)
  const chipVisible = shouldRenderChip(statusLabel, tone, showStatusChip)
  const isInteractive = typeof onSelect === 'function'
  const Tag = isInteractive ? 'button' : 'div'
  const interactiveProps = isInteractive
    ? {
      type: 'button',
      onClick: onSelect,
      'aria-label': selectLabel || `View ${name} transactions`,
    }
    : {}

  return (
    <Tag
      className={`category-progress-row category-progress-row--${tone}${isOverBudget ? ' category-progress-row--over' : ''}${isInteractive ? ' category-progress-row--interactive' : ''}`}
      style={{ '--entry-color': color, '--entry-soft': soft }}
      {...interactiveProps}
    >
      <div className="category-progress-row__main">
        <span className="category-progress-row__icon" aria-hidden="true">{symbol}</span>
        <div className="category-progress-row__copy">
          <div className="category-progress-row__title-wrap">
            <strong>{name}</strong>
            {chipVisible ? (
              <span className={`category-progress-row__chip category-progress-row__chip--${tone}`}>
                {statusLabel}
              </span>
            ) : null}
          </div>
          {fallbackShareText && !hasBudget ? <small>{fallbackShareText}</small> : null}
        </div>
      </div>
      <div
        aria-label={`${name} ${hasBudget ? 'budget progress' : 'share of spend'}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(safeProgress)}
        className="category-progress-row__bar"
        role="progressbar"
      >
        <span
          className={`category-progress-row__bar-fill category-progress-row__bar-fill--${tone}`}
          style={{ width: `${barFillWidth}%` }}
        />
      </div>
      <div className="category-progress-row__meta">
        <strong>{amountDisplay}</strong>
      </div>
    </Tag>
  )
}

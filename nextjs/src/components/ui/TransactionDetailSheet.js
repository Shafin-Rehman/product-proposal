'use client'

import { getEntryVisual } from '@/lib/financeVisuals'
import { formatCurrency, formatLongDate } from '@/lib/financeUtils'

export default function TransactionDetailSheet({ entry, onClose, children }) {
  if (!entry) return null

  const visual = getEntryVisual(entry)
  const displayTitle = entry.title || visual.label || (entry.kind === 'income' ? 'Income' : 'Expense')
  const detailTextLabel = entry.kind === 'income' ? 'Note' : 'Merchant'
  const detailTextValue = entry.kind === 'income'
    ? entry.note?.trim() || 'No note added'
    : entry.merchant?.trim() || 'No merchant added'

  const selectedSubtitle = entry.kind === 'income' && entry.note?.trim()
    ? entry.note.trim()
    : entry.merchant && entry.merchant !== displayTitle
      ? entry.merchant
      : formatLongDate(entry.occurredOn)
  const categoryOrSourceLabel = entry.kind === 'income' ? 'Source' : 'Category'

  return (
    <div className="detail-overlay" role="presentation">
      <button
        aria-label="Close transaction details"
        className="detail-overlay__backdrop"
        onClick={onClose}
        type="button"
      />
      <div aria-labelledby="transaction-detail-title" aria-modal="true" className={`detail-sheet detail-sheet--${entry.kind}`} role="dialog">
        <div className="detail-sheet__handle" />
        <div
          className={`detail-sheet__hero detail-sheet__hero--${entry.kind}`}
          style={{
            '--entry-color': visual.color,
            '--entry-soft': visual.soft,
          }}
        >
          <div className="entry-avatar entry-avatar--large">
            <span>{visual.symbol}</span>
          </div>
          <div className="detail-sheet__copy">
            <span className="entry-chip">{visual.label || entry.chip}</span>
            <h2 className="detail-sheet__title" id="transaction-detail-title">{displayTitle}</h2>
            <p className="detail-sheet__subtitle">{selectedSubtitle}</p>
          </div>
          <button className="button-secondary page-retry" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="detail-sheet__amount">
          <span className={`entry-amount entry-amount--${entry.kind}`}>
            {entry.kind === 'income' ? '+' : '-'}
            {formatCurrency(entry.amount)}
          </span>
        </div>

        <div className="detail-grid">
          <div>
            <span>{categoryOrSourceLabel}</span>
            <strong>{entry.chip}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatLongDate(entry.occurredOn)}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{entry.kind === 'income' ? 'Income' : 'Expense'}</strong>
          </div>
          <div className="detail-grid__item--wide">
            <span>{detailTextLabel}</span>
            <strong>{detailTextValue}</strong>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

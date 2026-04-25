'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatShortDate } from '@/lib/financeUtils'

function compareCategoryName(name) {
  return String(name || '').trim().toLowerCase()
}

function filterByCategory(details = [], categoryName) {
  const target = compareCategoryName(categoryName)
  if (!target) return []
  return details
    .filter((entry) => compareCategoryName(entry?.categoryName) === target)
    .map((entry) => ({ ...entry, amount: Number(entry?.amount ?? 0) }))
    .sort((left, right) => right.amount - left.amount)
}

function totalAmount(entries) {
  return entries.reduce((sum, entry) => sum + Number(entry?.amount ?? 0), 0)
}

function TransactionList({ entries, monthLabel, emptyCopy }) {
  if (!entries.length) {
    return (
      <div className="blank-state blank-state--compact category-modal__empty">
        <strong>No transactions{monthLabel ? ` in ${monthLabel}` : ''}</strong>
        <span>{emptyCopy ?? 'Spending in this category will appear here once it lands.'}</span>
      </div>
    )
  }

  return (
    <ul className="category-modal__list" role="list">
      {entries.map((entry) => (
        <li className="category-modal__row" key={entry.id}>
          <div className="category-modal__row-icon" style={{ backgroundColor: entry.soft, color: entry.color }} aria-hidden="true">
            {entry.symbol}
          </div>
          <div className="category-modal__row-copy">
            <strong>{entry.title}</strong>
            <span>{formatShortDate(entry.occurredOn || entry.key)}</span>
          </div>
          <strong className="category-modal__row-amount">-{formatCurrency(entry.amount)}</strong>
        </li>
      ))}
    </ul>
  )
}

export default function CategoryTransactionsModal({
  isOpen,
  onClose,
  category,
  currentMonthDetails = [],
  previousMonthDetails = null,
  currentMonthLabel,
  previousMonthLabel,
}) {
  const [portalRoot, setPortalRoot] = useState(null)

  useEffect(() => {
    if (typeof document !== 'undefined') setPortalRoot(document.body)
  }, [])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const currentEntries = useMemo(
    () => filterByCategory(currentMonthDetails, category?.name),
    [currentMonthDetails, category?.name],
  )
  const previousEntries = useMemo(
    () => (previousMonthDetails ? filterByCategory(previousMonthDetails, category?.name) : []),
    [previousMonthDetails, category?.name],
  )
  const showCompare = previousMonthDetails != null

  if (!isOpen || !portalRoot || !category) return null

  const currentTotal = totalAmount(currentEntries)
  const previousTotal = totalAmount(previousEntries)
  const delta = showCompare ? Number((currentTotal - previousTotal).toFixed(2)) : null
  const deltaTone = delta == null ? 'neutral' : delta > 0 ? 'danger' : delta < 0 ? 'positive' : 'neutral'

  return createPortal(
    <div className="category-modal-overlay" role="presentation">
      <button
        aria-label={`Close ${category.name} transactions`}
        className="category-modal-overlay__backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="category-modal-title"
        aria-modal="true"
        className={`category-modal${showCompare ? ' category-modal--compare' : ''}`}
        role="dialog"
      >
        <header
          className="category-modal__header"
          style={{ '--entry-color': category.color, '--entry-soft': category.soft }}
        >
          <div className="category-modal__header-icon" aria-hidden="true">
            <span>{category.symbol}</span>
          </div>
          <div className="category-modal__header-copy">
            <span className="category-modal__eyebrow">Category transactions</span>
            <h2 className="category-modal__title" id="category-modal-title">{category.name}</h2>
            {showCompare ? (
              <p className="category-modal__subtitle">
                {currentMonthLabel} vs {previousMonthLabel}
              </p>
            ) : currentMonthLabel ? (
              <p className="category-modal__subtitle">{currentMonthLabel}</p>
            ) : null}
          </div>
          <button
            aria-label="Close"
            className="category-modal__close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <dl className="category-modal__totals">
          <div>
            <dt>{currentMonthLabel || 'This month'}</dt>
            <dd>{formatCurrency(currentTotal)}</dd>
          </div>
          {showCompare ? (
            <>
              <div>
                <dt>{previousMonthLabel || 'Last month'}</dt>
                <dd>{formatCurrency(previousTotal)}</dd>
              </div>
              <div className={`category-modal__totals-delta category-modal__totals-delta--${deltaTone}`}>
                <dt>Change</dt>
                <dd>
                  {delta == null ? '--' : delta === 0 ? 'No change' : (
                    <>
                      {delta > 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(delta))}
                    </>
                  )}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        {showCompare ? (
          <div className="category-modal__compare">
            <section className="category-modal__column">
              <h3 className="category-modal__column-heading">{currentMonthLabel || 'This month'}</h3>
              <TransactionList entries={currentEntries} monthLabel={currentMonthLabel} />
            </section>
            <section className="category-modal__column">
              <h3 className="category-modal__column-heading">{previousMonthLabel || 'Last month'}</h3>
              <TransactionList
                entries={previousEntries}
                monthLabel={previousMonthLabel}
                emptyCopy="No spending in this category last month."
              />
            </section>
          </div>
        ) : (
          <TransactionList entries={currentEntries} monthLabel={currentMonthLabel} />
        )}
      </div>
    </div>,
    portalRoot,
  )
}

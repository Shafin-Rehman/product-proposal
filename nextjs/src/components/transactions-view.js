'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode, useDataChanged } from '@/components/providers'
import { ApiError, apiGet, apiPost } from '@/lib/apiClient'
import { demoActivity } from '@/lib/demoData'
import { getCategoryVisual, getEntryVisual } from '@/lib/financeVisuals'
import {
  buildActivityFeed,
  formatCurrency,
  formatLongDate,
  formatShortDate,
  groupActivityByDate,
} from '@/lib/financeUtils'

const ENTRY_CATEGORY_OPTIONS = {
  expense: ['Groceries', 'Dining', 'Shopping', 'Housing', 'Travel', 'Fun', 'Bills', 'Health'],
  income: ['Income', 'Transfer', 'Freelance', 'Refund', 'Gift'],
}

const REPEATING_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const EXTRA_SAMPLE_ACTIVITY = [
  {
    id: 'demo-exp-9',
    kind: 'expense',
    title: 'Bookstore run',
    chip: 'Shopping',
    amount: 42.18,
    occurredOn: '2026-03-17',
    note: 'Notebooks and pens',
    merchant: 'Campus store',
  },
  {
    id: 'demo-exp-10',
    kind: 'expense',
    title: 'Weekend groceries',
    chip: 'Groceries',
    amount: 61.47,
    occurredOn: '2026-03-16',
    note: 'Produce and snacks',
    merchant: 'Trader Joe\'s',
  },
  {
    id: 'demo-exp-11',
    kind: 'expense',
    title: 'Coffee and bagel',
    chip: 'Dining',
    amount: 12.4,
    occurredOn: '2026-03-15',
    note: 'Breakfast before class',
    merchant: 'Blue Bottle',
  },
  {
    id: 'demo-inc-3',
    kind: 'income',
    title: 'Tutoring payout',
    chip: 'Freelance',
    amount: 110,
    occurredOn: '2026-03-14',
    note: 'Weekend session',
    merchant: 'Venmo transfer',
  },
  {
    id: 'demo-exp-12',
    kind: 'expense',
    title: 'Pharmacy stop',
    chip: 'Health',
    amount: 23.89,
    occurredOn: '2026-03-13',
    note: 'Refill and essentials',
    merchant: 'CVS',
  },
  {
    id: 'demo-exp-13',
    kind: 'expense',
    title: 'Subway reload',
    chip: 'Travel',
    amount: 34,
    occurredOn: '2026-03-12',
    note: 'Weekly transit pass',
    merchant: 'OMNY',
  },
  {
    id: 'demo-exp-14',
    kind: 'expense',
    title: 'Streaming bundle',
    chip: 'Fun',
    amount: 18.99,
    occurredOn: '2026-03-11',
    note: 'Movie add-on',
    merchant: 'Hulu',
  },
  {
    id: 'demo-exp-15',
    kind: 'expense',
    title: 'Phone bill',
    chip: 'Bills',
    amount: 36,
    occurredOn: '2026-03-10',
    note: 'Monthly autopay',
    merchant: 'T-Mobile',
  },
  {
    id: 'demo-exp-16',
    kind: 'expense',
    title: 'Late study dinner',
    chip: 'Dining',
    amount: 21.65,
    occurredOn: '2026-03-09',
    note: 'After library session',
    merchant: 'Sweetgreen',
  },
  {
    id: 'demo-exp-17',
    kind: 'expense',
    title: 'Laundry supplies',
    chip: 'Shopping',
    amount: 17.26,
    occurredOn: '2026-03-08',
    note: 'Detergent and dryer sheets',
    merchant: 'Target',
  },
  {
    id: 'demo-exp-18',
    kind: 'expense',
    title: 'Corner market',
    chip: 'Groceries',
    amount: 19.54,
    occurredOn: '2026-03-07',
    note: 'Quick restock',
    merchant: 'Westside Market',
  },
  {
    id: 'demo-inc-4',
    kind: 'income',
    title: 'Refund posted',
    chip: 'Refund',
    amount: 28.75,
    occurredOn: '2026-03-06',
    note: 'Returned class supplies',
    merchant: 'Amazon',
  },
]

const SAMPLE_ACTIVITY = [...demoActivity, ...EXTRA_SAMPLE_ACTIVITY]
  .sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.id.localeCompare(left.id))

function getTodayInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function createEntryDraft() {
  return {
    kind: 'expense',
    amount: '',
    counterparty: '',
    category: categories?.[0]?.name || "Other",
    occurredOn: getTodayInputValue(),
    repeating: 'off',
    note: '',
  }
}

function createEditDraft(entry) {
  const base = {
    kind: entry.kind,
    amount: String(entry.amount),
    category: 
      entry.raw?.category_name || 
      entry.raw?.category ||
      (entry.kind === 'income' ? ENTRY_CATEGORY_OPTIONS.income[0] : ENTRY_CATEGORY_OPTIONS.expense[0]),
    occurredOn: entry.occurredOn || getTodayInputValue(),
    repeating: 'off',
    note: '',
  }
  if (entry.kind === 'expense') {
    return { ...base, counterparty: entry.raw?.description || '' }
  }
  return {
    ...base,
    counterparty: entry.raw?.notes || '',
    note: entry.raw?.notes || '',
  }
}

function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'The live transaction feed is not available right now.'
}

function LiveNotice({ message, onRetry }) {
  if (!message) return null

  return (
    <div className="inline-status" role="status">
      <div>
        <strong>Live activity is limited right now</strong>
        <span>{message}</span>
      </div>
      <button className="button-secondary page-retry" onClick={onRetry} type="button">
        Retry
      </button>
    </div>
  )
}

export default function TransactionsView() {
  const router = useRouter()
  const { isReady, logout, session } = useAuth()
  const { isSampleMode } = useDataMode()
  const { notifyDataChanged } = useDataChanged()
  const [reloadToken, setReloadToken] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [entryFilter, setEntryFilter] = useState('all')
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isEntrySheetOpen, setIsEntrySheetOpen] = useState(false)
  const [entryDraft, setEntryDraft] = useState(createEntryDraft)
  const [editingEntry, setEditingEntry] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [expenseCategories, setExpenseCategories] = useState([])
  const [incomeCategories, setIncomeCategories] = useState([])
  const [liveState, setLiveState] = useState({
    status: 'loading',
    message: '',
    expenses: [],
    income: [],
  })

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return

    const controller = new AbortController()

    async function loadLiveTransactions() {
      setLiveState((current) => ({
        ...current,
        status: 'loading',
        message: '',
      }))

      const results = await Promise.allSettled([
        apiGet('/api/expenses', {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
        apiGet('/api/income', {
          accessToken: session.accessToken,
          signal: controller.signal,
        }),
      ])

      if (controller.signal.aborted) return

      const authFailure = results.find(
        (result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401
      )

      if (authFailure) {
        logout()
        router.replace('/login')
        return
      }

      const failedCount = results.filter((result) => result.status === 'rejected').length
      setLiveState({
        status: failedCount ? (failedCount === results.length ? 'error' : 'partial') : 'ready',
        message: failedCount
          ? failedCount === results.length
            ? 'We could not load the live transactions feed.'
            : 'Part of the feed is missing right now, but the rest is still visible.'
          : '',
        expenses: results[0].status === 'fulfilled' ? results[0].value : [],
        income: results[1].status === 'fulfilled' ? results[1].value : [],
      })
    }

    loadLiveTransactions().catch((error) => {
      if (controller.signal.aborted) return

      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }

      setLiveState({
        status: 'error',
        message: getErrorMessage(error),
        expenses: [],
        income: [],
      })
    })

    return () => controller.abort()
  }, [isReady, isSampleMode, logout, reloadToken, router, session?.accessToken])

  useEffect(() => {
    if (!selectedEntry && !isEntrySheetOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (deleteConfirm) {
          setDeleteConfirm(false)
          return
        }
        if (selectedEntry) {
          setSelectedEntry(null)
          return
        }
        setIsEntrySheetOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteConfirm, isEntrySheetOpen, selectedEntry])

  useEffect(() => {
    let hideTimeoutId
    let intervalId

    const getScrollTop = () => {
      const scrollContainer = document.querySelector('.app-shell__content')
      return scrollContainer ? scrollContainer.scrollTop : window.scrollY
    }

    let lastScrollTop = getScrollTop()

    const checkScroll = () => {
      const nextScrollTop = getScrollTop()
      const fabSlot = document.querySelector('.transactions-fab-slot')

      if (fabSlot && nextScrollTop !== lastScrollTop) {
        lastScrollTop = nextScrollTop
        fabSlot.classList.add('transactions-fab-slot--scrolling')
        window.clearTimeout(hideTimeoutId)
        hideTimeoutId = window.setTimeout(() => {
          fabSlot.classList.remove('transactions-fab-slot--scrolling')
        }, 180)
      }
    }

    intervalId = window.setInterval(checkScroll, 80)
    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
      window.clearTimeout(hideTimeoutId)
      const fabSlot = document.querySelector('.transactions-fab-slot')
      fabSlot?.classList.remove('transactions-fab-slot--scrolling')
    }
  }, [])

  useEffect(() => {
    if (isSampleMode || !isReady || !session?.accessToken) return
    const token = session.accessToken
    apiGet('/api/expenses/categories', { accessToken: token }).then(setExpenseCategories).catch(() => {})
    apiGet('/api/income/categories', { accessToken: token }).then(setIncomeCategories).catch(() => {})
  }, [isReady, isSampleMode, session?.accessToken])

  if (!isReady || !session?.accessToken) {
    return null
  }

  const feed = isSampleMode ? SAMPLE_ACTIVITY : buildActivityFeed(liveState.expenses, liveState.income)
  const filteredFeed = feed.filter((entry) => {
    if (entryFilter !== 'all' && entry.kind !== entryFilter) return false
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.chip.toLowerCase().includes(query) ||
      entry.note.toLowerCase().includes(query) ||
      entry.merchant.toLowerCase().includes(query)
    )
  })
  const groupedFeed = groupActivityByDate(filteredFeed)
  const isLoading = !isSampleMode && liveState.status === 'loading' && !feed.length
  const selectedVisual = selectedEntry ? getEntryVisual(selectedEntry) : null
  const entryPreview = getCategoryVisual(
    [entryDraft.category, entryDraft.counterparty].filter(Boolean).join(' '),
    entryDraft.kind
  )
  const entryAmountValue = Number(entryDraft.amount)
  const entryAmountLabel = entryDraft.amount ? formatCurrency(Math.abs(entryAmountValue || 0)) : '$0.00'
  const entryTitle = entryDraft.counterparty.trim() || (entryDraft.kind === 'income' ? 'New income' : 'New expense')
  const counterpartyLabel = entryDraft.kind === 'income' ? 'Source' : 'Merchant'
  const entryCategories = entryDraft.kind === 'expense'
    ? expenseCategories
    : incomeCategories
  const selectedNote = selectedEntry && selectedEntry.note && selectedEntry.note !== selectedEntry.chip
    ? selectedEntry.note
    : selectedEntry?.kind === 'income'
      ? 'No note added'
      : 'Live expense'
  const selectedSubtitle = selectedEntry
    ? selectedEntry.merchant && selectedEntry.merchant !== selectedEntry.title
      ? selectedEntry.merchant
      : selectedEntry.note || selectedEntry.chip
    : ''
  const hideFab = Boolean(selectedEntry) || isEntrySheetOpen

  const updateDraft = (field, value) => {
    setEntryDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const openEntrySheet = (entryToEdit = null) => {
    setEditingEntry(entryToEdit)
    setSelectedEntry(null)
    setEntryDraft(entryToEdit ? createEditDraft(entryToEdit) : createEntryDraft())
    setSaveError('')
    setIsEntrySheetOpen(true)
  }

  const closeEntrySheet = () => {
    setIsEntrySheetOpen(false)
    setEditingEntry(null)
    setSaveError('')
  }

  const handleSaveEntry = async () => {
    if (isSaving) return
    setIsSaving(true)
    setSaveError('')
    try {
      if (entryDraft.kind === 'expense') {
        const categoryId = expenseCategories.find((c) => c.name === entryDraft.category)?.id
         if (!categoryId) {
          setSaveError('Please select a valid category before saving.')
          return
        }
        const body = {
          amount: Number(entryDraft.amount),
          description: entryDraft.counterparty.trim() || undefined,
          date: entryDraft.occurredOn,
          category_id: categoryId,
        }
        if (editingEntry) {
          await apiPost('/api/expenses/update', { expense_id: editingEntry.raw.id, ...body }, { accessToken: session.accessToken })
        } else {
          await apiPost('/api/expenses', body, { accessToken: session.accessToken })
        }
      } else {
        const sourceId = incomeCategories.find((c) => c.name === entryDraft.category)?.id
        const body = {
          amount: Number(entryDraft.amount),
          date: entryDraft.occurredOn,
          notes: (entryDraft.note.trim() || entryDraft.counterparty.trim()) || undefined,
          ...(sourceId ? { source_id: sourceId } : {}),
        }
        if (editingEntry) {
          await apiPost('/api/income/update', { income_id: editingEntry.raw.id, ...body }, { accessToken: session.accessToken })
        } else {
          await apiPost('/api/income', body, { accessToken: session.accessToken })
        }
      }
      closeEntrySheet()
      notifyDataChanged()
      setReloadToken((value) => value + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }
      setSaveError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEntry = async () => {
    if (isDeleting || !selectedEntry) return
    setIsDeleting(true)
    try {
      if (selectedEntry.kind === 'expense') {
        await apiPost('/api/expenses/delete', { expense_id: selectedEntry.raw.id }, { accessToken: session.accessToken })
      } else {
        await apiPost('/api/income/delete', { income_id: selectedEntry.raw.id }, { accessToken: session.accessToken })
      }
      setSelectedEntry(null)
      setDeleteConfirm(false)
      notifyDataChanged()
      setReloadToken((value) => value + 1)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout()
        router.replace('/login')
        return
      }
      setDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <section className="app-screen transactions-screen">
        <div className="screen-heading--split">
          <div className="screen-heading">
            <h1 className="screen-heading__title">Transactions</h1>
          </div>
          <span className={`screen-chip screen-chip--${isSampleMode ? 'sample' : 'live'}`}>
            {isSampleMode ? 'Sample' : 'Live'}
          </span>
        </div>

        <div className="search-panel">
          <label className="search-field">
            <svg aria-hidden="true" className="search-field__icon" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6.75" stroke="currentColor" strokeWidth="1.8" />
              <path d="M16 16l3.75 3.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
            </svg>
            <input
              className="search-field__input"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search merchant, category, or note"
              type="search"
              value={searchQuery}
            />
          </label>

          <div className="segment-control segment-control--strong transactions-filter" role="group" aria-label="Transaction filter">
            <button
              className={`segment-control__button${entryFilter === 'all' ? ' segment-control__button--active' : ''}`}
              onClick={() => setEntryFilter('all')}
              type="button"
            >
              All
            </button>
            <button
              className={`segment-control__button${entryFilter === 'expense' ? ' segment-control__button--active' : ''}`}
              onClick={() => setEntryFilter('expense')}
              type="button"
            >
              Expenses
            </button>
            <button
              className={`segment-control__button${entryFilter === 'income' ? ' segment-control__button--active' : ''}`}
              onClick={() => setEntryFilter('income')}
              type="button"
            >
              Income
            </button>
          </div>
        </div>

        <LiveNotice
          message={liveState.message}
          onRetry={() => setReloadToken((value) => value + 1)}
        />

        {isLoading ? (
          <div className="blank-state">
            <strong>Loading activity</strong>
            <span>Pulling in the latest spend and income rows now.</span>
          </div>
        ) : groupedFeed.length ? (
          <div className="transaction-groups">
            {groupedFeed.map((group) => (
              <section className="transaction-group" key={group.key}>
                <div className="transaction-group__heading">{group.label}</div>
                <div className="transaction-group__rows">
                  {group.entries.map((entry) => {
                    const visual = getEntryVisual(entry)
                    return (
                      <button
                        className="transaction-item"
                        key={entry.id}
                        onClick={() => setSelectedEntry(entry)}
                        style={{
                          '--entry-color': visual.color,
                          '--entry-soft': visual.soft,
                        }}
                        type="button"
                      >
                        <div className="entry-avatar">
                          <span>{visual.symbol}</span>
                        </div>

                        <div className="transaction-item__body">
                          <strong>{entry.merchant || entry.title}</strong>
                          <div className="transaction-item__meta">
                            <span className="entry-chip">{entry.chip}</span>
                            {entry.note && entry.note !== entry.chip ? <span>{entry.note}</span> : null}
                          </div>
                        </div>

                        <div className="transaction-item__side">
                          <span className={`entry-amount entry-amount--${entry.kind}`}>
                            {entry.kind === 'income' ? '+' : '-'}
                            {formatCurrency(entry.amount)}
                          </span>
                          <small>{formatShortDate(entry.occurredOn)}</small>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="blank-state">
            <strong>{searchQuery || entryFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}</strong>
            <span>
              {searchQuery || entryFilter !== 'all'
                ? 'Try a broader search or switch back to the full feed.'
                : 'Turn on Sample mode in Account if you want to preview a fuller feed.'}
            </span>
          </div>
        )}
      </section>

      <div className={`transactions-fab-slot${hideFab ? ' transactions-fab-slot--hidden' : ''}`}>
        <button
          aria-label="Add transaction"
          className="transactions-fab"
          onClick={() => openEntrySheet()}
          type="button"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {selectedEntry ? (
        <div className="detail-overlay" role="presentation">
          <button
            aria-label="Close transaction details"
            className="detail-overlay__backdrop"
            onClick={() => setSelectedEntry(null)}
            type="button"
          />
          <div aria-labelledby="transaction-detail-title" aria-modal="true" className="detail-sheet" role="dialog">
            <div className="detail-sheet__handle" />
            <div
              className="detail-sheet__hero"
              style={{
                '--entry-color': selectedVisual.color,
                '--entry-soft': selectedVisual.soft,
              }}
            >
              <div className="entry-avatar entry-avatar--large">
                <span>{selectedVisual.symbol}</span>
              </div>
              <div className="detail-sheet__copy">
                <span className="entry-chip">{selectedEntry.kind === 'income' ? 'Income' : 'Expense'}</span>
                <h2 className="detail-sheet__title" id="transaction-detail-title">{selectedEntry.title}</h2>
                <p className="detail-sheet__subtitle">{selectedSubtitle}</p>
              </div>
              <button className="button-secondary page-retry" onClick={() => setSelectedEntry(null)} type="button">
                Close
              </button>
            </div>

            <div className="detail-sheet__amount">
              <span className={`entry-amount entry-amount--${selectedEntry.kind}`}>
                {selectedEntry.kind === 'income' ? '+' : '-'}
                {formatCurrency(selectedEntry.amount)}
              </span>
            </div>

            <div className="detail-grid">
              <div>
                <span>Category</span>
                <strong>{selectedEntry.chip}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>{formatLongDate(selectedEntry.occurredOn)}</strong>
              </div>
              <div>
                <span>Type</span>
                <strong>{selectedEntry.kind === 'income' ? 'Income' : 'Expense'}</strong>
              </div>
              <div>
                <span>Note</span>
                <strong>{selectedNote}</strong>
              </div>
            </div>

            {!isSampleMode && selectedEntry.raw && (
              <div className="entry-sheet__footer" style={{ marginTop: '1rem' }}>
                {deleteConfirm ? (
                  <>
                    <div className="inline-error" role="alert">
                      <span>Delete this transaction? This cannot be undone.</span>
                    </div>
                    <div className="entry-sheet__actions">
                      <button
                        className="button-secondary"
                        disabled={isDeleting}
                        onClick={() => setDeleteConfirm(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="button-danger"
                        disabled={isDeleting}
                        onClick={handleDeleteEntry}
                        type="button"
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm delete'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="entry-sheet__actions">
                    <button
                      className="button-secondary"
                      onClick={() => openEntrySheet(selectedEntry)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button-danger"
                      onClick={() => setDeleteConfirm(true)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isEntrySheetOpen ? (
        <div className="detail-overlay" role="presentation">
          <button
            aria-label="Close transaction entry"
            className="detail-overlay__backdrop"
            onClick={closeEntrySheet}
            type="button"
          />
          <div aria-labelledby="transaction-entry-title" aria-modal="true" className="detail-sheet entry-sheet" role="dialog">
            <div className="detail-sheet__handle" />

            <div
              className="detail-sheet__hero entry-sheet__hero"
              style={{
                '--entry-color': entryPreview.color,
                '--entry-soft': entryPreview.soft,
              }}
            >
              <div className="entry-avatar entry-avatar--large">
                <span>{entryPreview.symbol}</span>
              </div>
              <div className="detail-sheet__copy">
                <span className="entry-chip">{entryDraft.kind === 'income' ? 'Income' : 'Expense'}</span>
                <h2 className="detail-sheet__title" id="transaction-entry-title">
                  {editingEntry ? 'Edit transaction' : 'Add transaction'}
                </h2>
                <p className="detail-sheet__subtitle">
                  {editingEntry ? 'Update the details below.' : 'Fill in the details to save to your live account.'}
                </p>
              </div>
              <button className="button-secondary page-retry" onClick={closeEntrySheet} type="button">
                Close
              </button>
            </div>

            <div className="entry-sheet__amount">
              <span className={`entry-amount entry-amount--${entryDraft.kind}`}>
                {entryDraft.kind === 'income' ? '+' : '-'}
                {entryAmountLabel}
              </span>
              <small>{entryTitle}</small>
            </div>

            <div className="segment-control segment-control--binary segment-control--strong entry-sheet__segment" role="group" aria-label="Transaction kind">
              <button
                className={`segment-control__button${entryDraft.kind === 'expense' ? ' segment-control__button--active' : ''}`}
                disabled={!!editingEntry}
                onClick={() => setEntryDraft((current) => ({
                  ...current,
                  kind: 'expense',
                  category: expenseCategories[0]?.name ?? ENTRY_CATEGORY_OPTIONS.expense[0],
                }))}
                type="button"
              >
                Expense
              </button>
              <button
                className={`segment-control__button${entryDraft.kind === 'income' ? ' segment-control__button--active' : ''}`}
                disabled={!!editingEntry}
                onClick={() => setEntryDraft((current) => ({
                  ...current,
                  kind: 'income',
                  category: incomeCategories[0]?.name ?? ENTRY_CATEGORY_OPTIONS.income[0],
                }))}
                type="button"
              >
                Income
              </button>
            </div>

            <form className="entry-sheet__form" onSubmit={(event) => { event.preventDefault(); handleSaveEntry() }}>
              <div className="entry-sheet__grid">
                <label className="entry-sheet__field">
                  <span>Amount</span>
                  <input
                    className="input-field"
                    inputMode="decimal"
                    onChange={(event) => updateDraft('amount', event.target.value)}
                    placeholder="0.00"
                    type="number"
                    value={entryDraft.amount}
                  />
                </label>

                <label className="entry-sheet__field">
                  <span>{counterpartyLabel}</span>
                  <input
                    className="input-field"
                    onChange={(event) => updateDraft('counterparty', event.target.value)}
                    placeholder={entryDraft.kind === 'income' ? 'Payroll, transfer, refund...' : 'Target, Uber, rent...'}
                    type="text"
                    value={entryDraft.counterparty}
                  />
                </label>
              </div>

              <div className="entry-sheet__grid entry-sheet__grid--secondary">
                <label className="entry-sheet__field">
                  <span>Category</span>
                  <select
                    className="input-field"
                    onChange={(event) => updateDraft('category', event.target.value)}
                    value={entryDraft.category}
                  >
                    {entryCategories.length === 0 ? (
                    <option disabled>Loading categories...</option>
                 ) : (
                   entryCategories.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.icon ? `${option.icon} ${option.name}` : option.name}
                    </option>
                  ))
                )}
                </select>
                </label>

                <label className="entry-sheet__field">
                  <span>Date</span>
                  <input
                    className="input-field"
                    onChange={(event) => updateDraft('occurredOn', event.target.value)}
                    type="date"
                    value={entryDraft.occurredOn}
                  />
                </label>
              </div>

              <div className="entry-sheet__field">
                <span>Repeating</span>
                <div className="segment-control segment-control--strong entry-sheet__repeat" role="group" aria-label="Repeating cadence">
                  {REPEATING_OPTIONS.map((option) => (
                    <button
                      className={`segment-control__button${entryDraft.repeating === option.value ? ' segment-control__button--active' : ''}`}
                      key={option.value}
                      onClick={() => updateDraft('repeating', option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="entry-sheet__field">
                <span>Note</span>
                <textarea
                  className="input-field entry-sheet__textarea"
                  onChange={(event) => updateDraft('note', event.target.value)}
                  placeholder="Add context for the transaction"
                  rows="3"
                  value={entryDraft.note}
                />
              </label>

              <div className="entry-sheet__footer">
                {saveError ? (
                  <div className="inline-error" role="alert">{saveError}</div>
                ) : (
                  <span className="entry-sheet__hint">
                    {isSampleMode
                      ? 'Switch to Live mode in Account to save transactions.'
                      : editingEntry
                        ? 'Changes will update the live record immediately.'
                        : 'This will be saved to your live account.'}
                  </span>
                )}
                <div className="entry-sheet__actions">
                  <button className="button-secondary" disabled={isSaving} onClick={closeEntrySheet} type="button">
                    Cancel
                  </button>
                  <button
                    className="button-primary"
                    disabled={isSaving || isSampleMode || !entryDraft.amount || !entryDraft.occurredOn || !entryCategories.length}
                    type="submit"
                  >
                    {isSaving ? 'Saving...' : editingEntry ? 'Save changes' : 'Add transaction'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

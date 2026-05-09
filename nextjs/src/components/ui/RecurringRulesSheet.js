'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost } from '@/lib/apiClient'
import { formatCurrency } from '@/lib/financeUtils'

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }
const VALID_FREQUENCIES = ['weekly', 'monthly', 'yearly']

export default function RecurringRulesSheet({ session, onClose, onChanged, demoRules }) {
  const [rules, setRules] = useState(demoRules ?? [])
  const [isLoading, setIsLoading] = useState(!demoRules)
  const [busyRuleId, setBusyRuleId] = useState(null)
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [editDraft, setEditDraft] = useState({})

  useEffect(() => {
    if (demoRules) return
    let cancelled = false
    async function load() {
      try {
        const data = await apiGet('/api/recurring', { accessToken: session.accessToken })
        if (!cancelled) setRules(data ?? [])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [session?.accessToken, demoRules])

  function startEdit(rule) {
    setEditingRuleId(rule.id)
    setEditDraft({ amount: rule.amount, frequency: rule.frequency, description: rule.description ?? '' })
  }

  function cancelEdit() {
    setEditingRuleId(null)
    setEditDraft({})
  }

  async function saveEdit(rule) {
    if (busyRuleId) return
    setBusyRuleId(rule.id)
    try {
      await apiPost(
        '/api/recurring/update',
        {
          rule_id: rule.id,
          amount: Number(editDraft.amount),
          frequency: editDraft.frequency,
          description: editDraft.description || null,
        },
        { accessToken: session.accessToken },
      )
      setRules((prev) => prev.map((r) => r.id === rule.id
        ? { ...r, amount: String(editDraft.amount), frequency: editDraft.frequency, description: editDraft.description || null }
        : r
      ))
      setEditingRuleId(null)
      setEditDraft({})
    } finally {
      setBusyRuleId(null)
    }
  }

  async function handleTogglePause(rule) {
    if (busyRuleId) return
    setBusyRuleId(rule.id)
    try {
      const updatedRule = await apiPost(
        '/api/recurring/update',
        { rule_id: rule.id, paused: !rule.paused },
        { accessToken: session.accessToken },
      )
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, ...updatedRule } : r))
    } finally {
      setBusyRuleId(null)
    }
  }

  async function handleCancel(rule) {
    if (busyRuleId) return
    setBusyRuleId(rule.id)
    try {
      await apiPost(
        '/api/recurring/delete',
        { rule_id: rule.id },
        { accessToken: session.accessToken },
      )
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
      onChanged?.()
    } finally {
      setBusyRuleId(null)
    }
  }

  return (
    <div className="detail-overlay" role="presentation">
      <button
        aria-label="Close recurring transactions"
        className="detail-overlay__backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        aria-label="Recurring transactions"
        aria-modal="true"
        className="detail-sheet detail-sheet--recurring"
        role="dialog"
      >
        <div className="detail-sheet__handle" />

        <div className="recurring-sheet__header">
          <h2 className="recurring-sheet__title">Recurring</h2>
          <button className="button-secondary" onClick={onClose} type="button">
            Close
          </button>
        </div>

        {isLoading ? (
          <div className="blank-state blank-state--sheet">
            <strong>Loading&hellip;</strong>
          </div>
        ) : rules.length === 0 ? (
          <div className="blank-state blank-state--sheet">
            <strong>No recurring transactions</strong>
            <span>Add one by selecting &ldquo;Repeat&rdquo; when creating a transaction.</span>
          </div>
        ) : (
          <ul className="recurring-rules-list" role="list">
            {rules.map((rule) => {
              const isBusy = busyRuleId === rule.id
              const isEditing = editingRuleId === rule.id
              const title = rule.description ?? rule.category_name ?? rule.source_name ?? (rule.type === 'income' ? 'Recurring income' : 'Recurring expense')
              return (
                <li className="recurring-rule-row" data-rule-id={rule.id} key={rule.id}>
                  {isEditing ? (
                    <div className="recurring-rule-row__edit-form">
                      <label className="entry-sheet__field" htmlFor={`edit-amount-${rule.id}`}>
                        <span>Amount</span>
                        <input
                          aria-label="Amount"
                          className="input-field"
                          id={`edit-amount-${rule.id}`}
                          min="0.01"
                          onChange={(e) => setEditDraft((d) => ({ ...d, amount: e.target.value }))}
                          step="0.01"
                          type="number"
                          value={editDraft.amount}
                        />
                      </label>
                      <label className="entry-sheet__field" htmlFor={`edit-freq-${rule.id}`}>
                        <span>Frequency</span>
                        <select
                          aria-label="Frequency"
                          className="input-field"
                          id={`edit-freq-${rule.id}`}
                          onChange={(e) => setEditDraft((d) => ({ ...d, frequency: e.target.value }))}
                          value={editDraft.frequency}
                        >
                          {VALID_FREQUENCIES.map((f) => (
                            <option key={f} value={f}>{FREQ_LABELS[f]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="entry-sheet__field" htmlFor={`edit-desc-${rule.id}`}>
                        <span>Description</span>
                        <input
                          aria-label="Description"
                          className="input-field"
                          id={`edit-desc-${rule.id}`}
                          onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                          type="text"
                          value={editDraft.description}
                        />
                      </label>
                      <div className="recurring-rule-row__actions">
                        <button
                          className="button-secondary button-secondary--small"
                          disabled={isBusy}
                          onClick={cancelEdit}
                          type="button"
                        >
                          Discard
                        </button>
                        <button
                          className="button-primary button-primary--small"
                          disabled={isBusy}
                          onClick={() => saveEdit(rule)}
                          type="button"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="recurring-rule-row__info">
                        <strong className="recurring-rule-row__title">{title}</strong>
                        <div className="recurring-rule-row__meta">
                          <span className="entry-chip entry-chip--freq">
                            {FREQ_LABELS[rule.frequency] ?? rule.frequency}
                          </span>
                          {rule.paused && (
                            <span className="entry-chip entry-chip--paused">Paused</span>
                          )}
                        </div>
                      </div>
                      <div className="recurring-rule-row__side">
                        <span className="recurring-rule-row__amount">
                          {formatCurrency(Number(rule.amount))}
                        </span>
                        {!rule.paused && rule.next_date && (
                          <small className="recurring-rule-row__next">
                            Next {rule.next_date}
                          </small>
                        )}
                      </div>
                      {!demoRules && (
                        <div className="recurring-rule-row__actions">
                          <button
                            className="button-secondary button-secondary--small"
                            disabled={isBusy}
                            onClick={() => startEdit(rule)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="button-secondary button-secondary--small"
                            disabled={isBusy}
                            onClick={() => handleTogglePause(rule)}
                            type="button"
                          >
                            {rule.paused ? 'Resume' : 'Pause'}
                          </button>
                          <button
                            className="button-danger button-danger--small"
                            disabled={isBusy}
                            onClick={() => handleCancel(rule)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

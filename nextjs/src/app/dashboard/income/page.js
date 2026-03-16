'use client'
import { useState, useEffect } from 'react'

const blank = { amount: '', month: '', source_id: '', notes: '' }

export default function IncomePage() {
  const [rows, setRows] = useState([])
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function authHeader() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
  }

  async function load() {
    try {
      const [inc, src] = await Promise.all([
        fetch('/api/income', { headers: authHeader() }).then(r => r.json()),
        fetch('/api/income/categories', { headers: authHeader() }).then(r => r.json()),
      ])
      setRows(Array.isArray(inc) ? inc : [])
      setSources(Array.isArray(src) ? src : [])
    } catch {
      setRows([])
      setSources([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openAdd() { setForm(blank); setError(''); setModal('add') }

  function openEdit(r) {
    setForm({ amount: r.amount, month: r.month?.slice(0, 10) || '', source_id: r.source_id || '', notes: r.notes || '' })
    setError('')
    setModal(r.id)
  }

  async function save() {
    if (!form.amount || !form.month) { setError('Amount and month are required'); return }
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        amount: amt,
        month: form.month,
        ...(form.source_id ? { source_id: form.source_id } : {}),
        ...(form.notes ? { notes: form.notes } : {}),
      }
      const isEdit = modal !== 'add'
      const url = isEdit ? '/api/income/update' : '/api/income'
      const body = isEdit ? { income_id: modal, ...payload } : payload
      const res = await fetch(url, { method: 'POST', headers: authHeader(), body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save'); return }
      setModal(null)
      await load()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!confirm('Delete this income entry?')) return
    try {
      await fetch('/api/income/delete', { method: 'POST', headers: authHeader(), body: JSON.stringify({ income_id: id }) })
      await load()
    } catch {
      alert('Failed to delete')
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-head">
        <h1>Income</h1>
        <p>Manage your income sources</p>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Income</button>
        </div>
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty">No income entries yet. Add your first one!</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{r.source_name || '—'}</td>
                    <td><span className="badge badge-green">${parseFloat(r.amount).toFixed(2)}</span></td>
                    <td>{r.month?.slice(0, 10)}</td>
                    <td style={{ color: '#666', maxWidth: 200 }}>{r.notes || '—'}</td>
                    <td>
                      <div className="td-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <h2>{modal === 'add' ? 'Add Income' : 'Edit Income'}</h2>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-field">
                <label>Amount</label>
                <input type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Source</label>
                <select value={form.source_id} onChange={e => setForm(f => ({ ...f, source_id: e.target.value }))}>
                  <option value="">— Select source —</option>
                  {sources.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <textarea placeholder="Optional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

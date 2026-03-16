'use client'
import { useState, useEffect } from 'react'

const blank = { amount: '', date: '', category_id: '', description: '' }

export default function ExpensesPage() {
  const [rows, setRows] = useState([])
  const [categories, setCategories] = useState([])
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
      const [exp, cats] = await Promise.all([
        fetch('/api/expenses', { headers: authHeader() }).then(r => r.json()),
        fetch('/api/expenses/categories', { headers: authHeader() }).then(r => r.json()),
      ])
      setRows(Array.isArray(exp) ? exp : [])
      setCategories(Array.isArray(cats) ? cats : [])
    } catch {
      setRows([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openAdd() { setForm({ ...blank, date: new Date().toISOString().slice(0, 10) }); setError(''); setModal('add') }

  function openEdit(r) {
    setForm({ amount: r.amount, date: r.date || '', category_id: r.category_id || '', description: r.description || '' })
    setError('')
    setModal(r.id)
  }

  async function save() {
    if (!form.amount || !form.date) { setError('Amount and date are required'); return }
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        amount: amt,
        date: form.date,
        ...(form.category_id ? { category_id: form.category_id } : {}),
        ...(form.description ? { description: form.description } : {}),
      }
      const isEdit = modal !== 'add'
      const url = isEdit ? '/api/expenses/update' : '/api/expenses'
      const body = isEdit ? { expense_id: modal, ...payload } : payload
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
    if (!confirm('Delete this expense?')) return
    try {
      await fetch('/api/expenses/delete', { method: 'POST', headers: authHeader(), body: JSON.stringify({ expense_id: id }) })
      await load()
    } catch {
      alert('Failed to delete')
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-head">
        <h1>Expenses</h1>
        <p>Track what you spend</p>
      </div>
      <div className="card">
        <div className="card-header">
          <span className="card-title">{rows.length} {rows.length === 1 ? 'expense' : 'expenses'}</span>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Expense</button>
        </div>
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty">No expenses yet. Add your first one!</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{r.category_name ? <span className="badge badge-gray">{r.category_name}</span> : '—'}</td>
                    <td style={{ color: '#666' }}>{r.description || '—'}</td>
                    <td style={{ color: '#c62828', fontWeight: 600 }}>${parseFloat(r.amount).toFixed(2)}</td>
                    <td>{r.date}</td>
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
              <h2>{modal === 'add' ? 'Add Expense' : 'Edit Expense'}</h2>
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
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">— Select category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Description</label>
                <input type="text" placeholder="What was this for?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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

'use client'
import { useState, useEffect } from 'react'

export default function DashboardPage() {
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch('/api/income', { headers }).then(r => r.json()),
      fetch('/api/expenses', { headers }).then(r => r.json()),
    ]).then(([inc, exp]) => {
      setIncome(Array.isArray(inc) ? inc : [])
      setExpenses(Array.isArray(exp) ? exp : [])
    }).finally(() => setLoading(false))
  }, [])

  const totalIncome = income.reduce((s, r) => s + parseFloat(r.amount || 0), 0)
  const totalExpenses = expenses.reduce((s, r) => s + parseFloat(r.amount || 0), 0)
  const remaining = totalIncome - totalExpenses

  if (loading) return <div className="loading">Loading...</div>

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p>Your financial summary</p>
      </div>
      <div className="stats">
        <div className="stat green">
          <div className="stat-label">Total Income</div>
          <div className="stat-value">${totalIncome.toFixed(2)}</div>
        </div>
        <div className="stat red">
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value">${totalExpenses.toFixed(2)}</div>
        </div>
        <div className={`stat ${remaining >= 0 ? 'blue' : 'red'}`}>
          <div className="stat-label">Remaining Budget</div>
          <div className="stat-value">${remaining.toFixed(2)}</div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Recent Income</span></div>
        <div className="table-wrap">
          {income.length === 0 ? (
            <div className="empty">No income entries yet.</div>
          ) : (
            <table>
              <thead><tr><th>Source</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {income.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td>{r.source_name || '—'}</td>
                    <td><span className="badge badge-green">${parseFloat(r.amount).toFixed(2)}</span></td>
                    <td>{r.month?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Recent Expenses</span></div>
        <div className="table-wrap">
          {expenses.length === 0 ? (
            <div className="empty">No expenses yet.</div>
          ) : (
            <table>
              <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
              <tbody>
                {expenses.slice(0, 5).map(r => (
                  <tr key={r.id}>
                    <td>{r.category_name ? <span className="badge badge-gray">{r.category_name}</span> : '—'}</td>
                    <td>{r.description || '—'}</td>
                    <td style={{ color: '#c62828', fontWeight: 600 }}>${parseFloat(r.amount).toFixed(2)}</td>
                    <td>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

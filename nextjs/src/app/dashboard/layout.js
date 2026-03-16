'use client'
import '../globals.css'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.replace('/login'); return }
    try { setEmail(JSON.parse(localStorage.getItem('user') || '{}').email || '') } catch {}
    setReady(true)
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!ready) return <div className="loading">Loading...</div>

  return (
    <>
      <nav className="navbar">
        <span className="nav-logo">BudgetBuddy</span>
        <div className="nav-links">
          <Link href="/dashboard" className={`nav-link${pathname === '/dashboard' ? ' active' : ''}`}>Overview</Link>
          <Link href="/dashboard/income" className={`nav-link${pathname === '/dashboard/income' ? ' active' : ''}`}>Income</Link>
          <Link href="/dashboard/expenses" className={`nav-link${pathname === '/dashboard/expenses' ? ' active' : ''}`}>Expenses</Link>
        </div>
        <div className="nav-right">
          <span className="nav-email">{email}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>
      <main className="page">{children}</main>
    </>
  )
}

'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/planner', label: 'Planner', icon: 'planner' },
  { href: '/transactions', label: 'Transactions', icon: 'transactions' },
  { href: '/insights', label: 'Insights', icon: 'insights' },
  { href: '/account', label: 'Account', icon: 'account' },
]

function AppLoadingShell({ isRedirecting = false }) {
  return (
    <div className="route-shell-loading">
      <div className="route-shell-loading__glow route-shell-loading__glow--top" />
      <div className="route-shell-loading__glow route-shell-loading__glow--bottom" />
      <section className="route-shell-loading__card">
        <span className="brand-pill">BudgetBuddy</span>
        <h1>{isRedirecting ? 'One second' : 'Loading your budget space'}</h1>
        <p>
          {isRedirecting
            ? 'We are taking you to the welcome page.'
            : 'Checking your session and restoring the app shell.'}
        </p>
      </section>
    </div>
  )
}

function TabIcon({ icon }) {
  switch (icon) {
    case 'dashboard':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <rect height="6.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" width="6.5" x="4" y="4" />
          <rect height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" width="6.5" x="13.5" y="4" />
          <rect height="6.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" width="6.5" x="13.5" y="13.5" />
          <rect height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.7" width="6.5" x="4" y="10.5" />
        </svg>
      )
    case 'transactions':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M5 8h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M5 12h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M5 16h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <circle cx="17.5" cy="12" fill="currentColor" r="1.2" />
        </svg>
      )
    case 'planner':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <rect height="14" rx="2.2" stroke="currentColor" strokeWidth="1.8" width="16" x="4" y="6" />
          <path d="M8 4v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M16 4v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M8 11.25h8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="m9 15 1.6 1.6L15 12.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
    case 'insights':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M5 18.5h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M8 16V9.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M12 16V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M16 16v-4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      )
    default:
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M6 19.25c1.35-2.8 3.35-4.25 6-4.25s4.65 1.45 6 4.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      )
  }
}

export default function AppLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isReady, isAuthenticated, authReason } = useAuth()

  useEffect(() => {
    if (!isReady || isAuthenticated) return
    const search = authReason ? `?reason=${authReason}` : ''
    router.replace(`/login${search}`)
  }, [isAuthenticated, isReady, router, authReason])

  if (!isReady || !isAuthenticated) {
    return <AppLoadingShell isRedirecting={isReady && !isAuthenticated} />
  }

  return (
    <div className="app-shell">
      <div className="app-shell__backdrop" />
      <div className="app-shell__frame">
        <main className="app-shell__content">{children}</main>
        <div className="app-shell__nav">
          <nav aria-label="Primary" className="bottom-nav">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  aria-current={isActive ? 'page' : undefined}
                  className={`tab-link${isActive ? ' tab-link--active' : ''}`}
                  href={item.href}
                  key={item.href}
                >
                  <span className="tab-link__icon">
                    <TabIcon icon={item.icon} />
                  </span>
                  <span className="tab-link__label">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers'

const HEADER_COPY = {
  '/dashboard': {
    eyebrow: 'Your foundation',
    title: 'A softer way to keep an eye on money',
    description: 'The shell is live, your session is in place, and the first real budget surfaces are ready for data to plug into next.',
  },
  '/transactions': {
    eyebrow: 'Activity flow',
    title: 'Transactions are about to feel much lighter',
    description: 'This is where your recent spending and incoming cash will land once the capture flows are wired into the interface.',
  },
  '/insights': {
    eyebrow: 'Pattern finder',
    title: 'Insights will turn habits into something readable',
    description: 'The structure is ready for trend stories, category breakdowns, and gentle guidance once live numbers start flowing in.',
  },
  '/account': {
    eyebrow: 'Your setup',
    title: 'Account details stay simple and calm',
    description: 'Use this space for session details, appearance preferences, and the essentials that keep the app feeling like yours.',
  },
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/transactions', label: 'Transactions', icon: 'transactions' },
  { href: '/insights', label: 'Insights', icon: 'insights' },
  { href: '/account', label: 'Account', icon: 'account' },
]

function AppLoadingShell() {
  return (
    <div className="route-shell-loading">
      <section className="route-shell-loading__card surface-card">
        <span className="brand-pill">BudgetBuddy</span>
        <p>Loading your private shell and making sure we still have your session in place.</p>
      </section>
    </div>
  )
}

function TabIcon({ icon }) {
  switch (icon) {
    case 'dashboard':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <rect height="7" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="7" x="3.5" y="4.5" />
          <rect height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="7" x="13.5" y="4.5" />
          <rect height="7" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="7" x="13.5" y="16.5" />
          <rect height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="7" x="3.5" y="13.5" />
        </svg>
      )
    case 'transactions':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M6 7.25h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M6 12h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M6 16.75h7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M16.25 14.25l2.25 2.5 3.25-4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
    case 'insights':
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M4.75 18.25h14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M7 16V9.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M12 16V5.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M17 16v-3.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      )
    default:
      return (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.75 19.25c1.15-2.95 3.45-4.5 6.25-4.5s5.1 1.55 6.25 4.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      )
  }
}

export default function AppLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isReady, isAuthenticated, user } = useAuth()
  const header = HEADER_COPY[pathname] ?? HEADER_COPY['/dashboard']
  const firstName = user?.email?.split('@')[0]

  useEffect(() => {
    if (!isReady || isAuthenticated) return
    router.replace('/login')
  }, [isAuthenticated, isReady, router])

  if (!isReady || !isAuthenticated) {
    return <AppLoadingShell />
  }

  return (
    <div className="app-shell">
      <div className="app-shell__frame">
        <header className="app-header">
          <div className="app-header__top">
            <span className="brand-pill">BudgetBuddy</span>
            <span className="info-chip">
              <strong>{firstName ? `${firstName}, you're in.` : "You're signed in."}</strong>
            </span>
          </div>
          <div className="section-kicker">{header.eyebrow}</div>
          <h1 className="app-header__title">{header.title}</h1>
          <p className="app-header__copy">{header.description}</p>
        </header>

        <main className="page-stack">{children}</main>
      </div>

      <nav aria-label="Primary" className="bottom-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              className={`tab-link${isActive ? ' tab-link--active' : ''}`}
              href={item.href}
              key={item.href}
            >
              <TabIcon icon={item.icon} />
              <span className="tab-link__label">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

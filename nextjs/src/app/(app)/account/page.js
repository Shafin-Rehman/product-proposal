'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useTheme } from '@/components/providers'

export default function AccountPage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = () => {
    setIsLoggingOut(true)
    logout()
    router.replace('/login')
  }

  return (
    <section className="page-grid">
      <article className="surface-card surface-card--half surface-card--accent">
        <h2 className="surface-card__title">Signed in</h2>
        <ul className="account-list">
          <li>
            <div>
              <strong>Email</strong>
              <span>{user?.email || 'Unavailable'}</span>
            </div>
          </li>
          <li>
            <div>
              <strong>Session foundation</strong>
              <span>Your current session is stored locally so private routes stay unlocked after refresh.</span>
            </div>
          </li>
        </ul>
      </article>

      <article className="surface-card surface-card--half">
        <h2 className="surface-card__title">Appearance</h2>
        <p className="surface-card__copy">
          Light mode stays the default. Dark mode is here as a simple toggle so the shell feels complete without adding a full settings system yet.
        </p>

        <div className="theme-toggle" role="group" aria-label="Theme">
          <button
            className={`theme-toggle__button${theme === 'light' ? ' theme-toggle__button--active' : ''}`}
            onClick={() => setTheme('light')}
            type="button"
          >
            Light
          </button>
          <button
            className={`theme-toggle__button${theme === 'dark' ? ' theme-toggle__button--active' : ''}`}
            onClick={() => setTheme('dark')}
            type="button"
          >
            Dark
          </button>
        </div>
      </article>

      <article className="surface-card surface-card--wide surface-card--soft">
        <h2 className="surface-card__title">Account controls</h2>
        <p className="surface-card__copy">
          This tab stays intentionally lean in PR 1. The most important control right now is being able to leave the shell cleanly.
        </p>
        <div className="account-actions">
          <button className="button-secondary" disabled={isLoggingOut} onClick={handleLogout} type="button">
            {isLoggingOut ? 'Signing out...' : 'Log out'}
          </button>
        </div>
      </article>
    </section>
  )
}

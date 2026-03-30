'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useTheme } from '@/components/providers'

function getDisplayName(email) {
  if (!email) return 'BudgetBuddy member'

  const [name] = email.split('@')
  return name
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

function getInitials(email) {
  if (!email) return 'BB'

  return email
    .split('@')[0]
    .split(/[.\-_]/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

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
    <section className="app-screen account-screen">
      <article className="account-hero">
        <div className="account-hero__avatar">{getInitials(user?.email)}</div>
        <div className="account-hero__copy">
          <span className="account-hero__eyebrow">Account settings</span>
          <h1>{getDisplayName(user?.email)}</h1>
          <p>{user?.email || 'No email available'}</p>
        </div>
      </article>

      <div className="account-layout">
        <section className="account-group">
          <span className="account-group__label">Preferences</span>
          <div className="settings-panel">
            <div className="settings-item">
              <div aria-hidden="true" className="settings-item__icon">{'\u25D0'}</div>
              <div className="settings-item__copy">
                <strong>Appearance</strong>
                <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
              </div>
              <div className="segment-control segment-control--mini" role="group" aria-label="Theme">
                <button
                  className={`segment-control__button${theme === 'light' ? ' segment-control__button--active' : ''}`}
                  onClick={() => setTheme('light')}
                  type="button"
                >
                  Light
                </button>
                <button
                  className={`segment-control__button${theme === 'dark' ? ' segment-control__button--active' : ''}`}
                  onClick={() => setTheme('dark')}
                  type="button"
                >
                  Dark
                </button>
              </div>
            </div>

          </div>
        </section>

        <section className="account-group">
          <span className="account-group__label">Account management</span>
          <div className="settings-panel">
            <div className="settings-item settings-item--static">
              <div aria-hidden="true" className="settings-item__icon">{'\u{1F4B3}'}</div>
              <div className="settings-item__copy">
                <strong>Linked accounts</strong>
                <span>Linked accounts are available to view here.</span>
              </div>
            </div>

            <div className="settings-item settings-item--static">
              <div aria-hidden="true" className="settings-item__icon">{'\u{1F514}'}</div>
              <div className="settings-item__copy">
                <strong>Notifications</strong>
                <span>Budget reminders and monthly recaps stay optional.</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="account-group">
        <span className="account-group__label">Privacy & support</span>
        <div className="settings-panel">
          <div className="settings-item settings-item--static">
            <div aria-hidden="true" className="settings-item__icon">{'\u{1F512}'}</div>
            <div className="settings-item__copy">
              <strong>Privacy</strong>
              <span>Session details stay private on this device.</span>
            </div>
          </div>

          <div className="settings-item settings-item--static">
            <div aria-hidden="true" className="settings-item__icon">{'\u{1F6E1}'}</div>
            <div className="settings-item__copy">
              <strong>Security</strong>
                <span>Sign-in protection stays active while you use the app.</span>
            </div>
          </div>

          <div className="settings-item settings-item--static">
            <div aria-hidden="true" className="settings-item__icon">{'\u2753'}</div>
            <div className="settings-item__copy">
              <strong>Support</strong>
              <span>Get help with account questions and sign-in issues.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="account-group">
        <span className="account-group__label">Actions</span>
        <button className="logout-action" disabled={isLoggingOut} onClick={handleLogout} type="button">
          <span aria-hidden="true" className="logout-action__icon">{'\u21A9'}</span>
          <span>{isLoggingOut ? 'Signing out...' : 'Log out'}</span>
        </button>
      </section>

      <div className="account-footer">BudgetBuddy v1.0</div>
    </section>
  )
}

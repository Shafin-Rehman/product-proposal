'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useDataMode, useTheme } from '@/components/providers'
import ChangePasswordForm from '@/components/change-password-form'
import ChangeEmailForm from '@/components/change-email-form'

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

function getInitials(nameOrEmail) {
  if (!nameOrEmail) return 'BB'

  if (nameOrEmail.includes('@')) {
    return nameOrEmail
      .split('@')[0]
      .split(/[.\-_]/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
  }

  return nameOrEmail
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
}

export default function AccountPage() {
  const router = useRouter()
  const { user, session, logout, profileName, refreshProfile, updateProfileName, updateEmail } = useAuth()
  const { mode, isSampleMode, setMode } = useDataMode()
  const { theme, setTheme } = useTheme()

  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const displayName = profileName || getDisplayName(user?.email)
  const displayEmail = user?.email || ''

  const startEditingName = () => {
    setNameInput(displayName)
    setNameError('')
    setIsEditingName(true)
  }

  const cancelEditingName = useCallback(() => {
    setIsEditingName(false)
    setNameInput('')
    setNameError('')
  }, [])

  useEffect(() => {
    if (!isEditingName) return
    const onKey = (e) => { if (e.key === 'Escape') cancelEditingName() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isEditingName, cancelEditingName])

  const saveNameHandler = async (e) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    if (!trimmed) { setNameError('Name cannot be empty.'); return }
    if (trimmed.length > 60) { setNameError('Name must be 60 characters or fewer.'); return }

    setNameSaving(true)
    setNameError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ name: trimmed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNameError(body?.error || 'Could not save name. Please try again.')
      } else {
        updateProfileName(trimmed)
        setIsEditingName(false)
        setNameInput('')
      }
    } catch {
      setNameError('Could not save name. Please check your connection.')
    } finally {
      setNameSaving(false)
    }
  }

  const handleLogout = () => {
    setIsLoggingOut(true)
    logout()
    router.replace('/login')
  }

  if (isSampleMode && !user?.email) {
    return (
      <section className="app-screen account-screen">
        <article className="account-hero">
          <div className="account-hero__avatar">BB</div>
          <div className="account-hero__copy">
            <span className="account-hero__eyebrow">Exploring sample data</span>
            <h1>Demo mode</h1>
            <p>You&apos;re browsing BudgetBuddy with sample data — none of this is real.</p>
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
        </div>

        <section className="account-group">
          <span className="account-group__label">Ready to use BudgetBuddy for real?</span>
          <div className="settings-panel">
            <div className="settings-item settings-item--static">
              <div aria-hidden="true" className="settings-item__icon">{'\u2726'}</div>
              <div className="settings-item__copy">
                <strong>Create a free account</strong>
                <span>Track your real finances with your own data. Takes under a minute.</span>
              </div>
            </div>
          </div>
          <div className="demo-account-actions">
            <Link className="button-primary demo-account-actions__cta" href="/signup">
              Sign up free
            </Link>
            <Link className="button-secondary demo-account-actions__cta" href="/login" onClick={() => setMode('live')}>
              Log in instead
            </Link>
          </div>
        </section>

        <section className="account-group">
          <span className="account-group__label">Actions</span>
          <button
            className="logout-action"
            onClick={() => { setMode('live'); router.replace('/login') }}
            type="button"
          >
            <span aria-hidden="true" className="logout-action__icon">{'\u21A9'}</span>
            <span>Exit demo</span>
          </button>
        </section>

        <div className="account-footer">BudgetBuddy v1.0</div>
      </section>
    )
  }

  return (
    <section className="app-screen account-screen">
      <article className="account-hero">
        <div className="account-hero__avatar">{getInitials(profileName || user?.email)}</div>
        <div className="account-hero__copy">
          <span className="account-hero__eyebrow">Account settings</span>

          {isEditingName ? (
            <form className="account-name-edit" onSubmit={saveNameHandler}>
              <input
                aria-label="Display name"
                autoFocus
                className="account-name-input"
                maxLength={60}
                onChange={(e) => setNameInput(e.target.value)}
                type="text"
                value={nameInput}
              />
              {nameError && (
                <span className="account-name-error" role="alert">{nameError}</span>
              )}
              <div className="account-name-edit__actions">
                <button
                  className="button-primary"
                  disabled={nameSaving}
                  type="submit"
                >
                  {nameSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="button-secondary"
                  onClick={cancelEditingName}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              aria-label="Edit display name"
              className="account-hero__name-btn"
              onClick={startEditingName}
              type="button"
            >
              <h1>{displayName}</h1>
              <span aria-hidden="true" className="account-hero__edit-icon">✎</span>
            </button>
          )}

          <p>{displayEmail || 'No email available'}</p>
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
            <ChangePasswordForm />
            <ChangeEmailForm onSuccess={(newEmail) => { if (newEmail) updateEmail(newEmail) }} />
          </div>
        </section>
      </div>

      <section className="account-group">
        <span className="account-group__label">Privacy</span>
        <div className="settings-panel">
          <div className="settings-item settings-item--static">
            <div aria-hidden="true" className="settings-item__icon">{'\u{1F512}'}</div>
            <div className="settings-item__copy">
              <strong>Privacy</strong>
              <span>Session details stay private on this device.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="account-group">
        <span className="account-group__label">Actions</span>
        <button
          className="logout-action"
          disabled={isLoggingOut}
          onClick={handleLogout}
          type="button"
        >
          <span aria-hidden="true" className="logout-action__icon">{'\u21A9'}</span>
          <span>{isLoggingOut ? 'Signing you out...' : 'Log out'}</span>
        </button>
      </section>

      <div className="account-footer">BudgetBuddy v1.0</div>
    </section>
  )
}
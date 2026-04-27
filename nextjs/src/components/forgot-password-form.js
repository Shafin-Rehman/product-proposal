'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTheme } from '@/components/providers'

export default function ForgotPasswordForm() {
  const { theme, setTheme } = useTheme()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState('idle')

  const isSubmitting = status === 'submitting'
  const isSuccess = status === 'success'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setStatus('submitting')

    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      let body = {}
      try { body = await response.json() } catch {}

      if (!response.ok) {
        setErrorMessage(body?.error || 'Something went wrong. Please try again.')
        setStatus('idle')
        return
      }

      setStatus('success')
    } catch {
      setErrorMessage('Something went wrong. Please check your connection and try again.')
      setStatus('idle')
    }
  }

  return (
    <section aria-labelledby="forgot-title" className="auth-card">
      <div className="auth-card__topbar">
        <span className="brand-pill">BudgetBuddy</span>
        <div aria-label="Theme" className="auth-theme-toggle" role="group">
          <button
            aria-pressed={theme === 'light'}
            className={`auth-theme-toggle__button${theme === 'light' ? ' auth-theme-toggle__button--active' : ''}`}
            onClick={() => setTheme('light')}
            type="button"
          >
            Light
          </button>
          <button
            aria-pressed={theme === 'dark'}
            className={`auth-theme-toggle__button${theme === 'dark' ? ' auth-theme-toggle__button--active' : ''}`}
            onClick={() => setTheme('dark')}
            type="button"
          >
            Dark
          </button>
        </div>
      </div>

      <div className="auth-card__intro">
        <div className="auth-card__eyebrow">
          {isSuccess ? 'All done' : 'Account recovery'}
        </div>
        <h1 className="auth-card__title" id="forgot-title">
          {isSuccess ? 'Check your inbox' : "Can't remember your password?"}
        </h1>
        <p className="auth-card__copy">
          {isSuccess
            ? "We've sent a reset link to your email. Follow the instructions and you'll be back in shortly."
            : "No problem. Enter the email address on your account and we'll send you a reset link."}
        </p>
      </div>

      {isSuccess ? (
        <div className="inline-banner" role="status">
          <div>
            <strong>Reset link sent</strong>
            <div>Check your inbox — the link expires after a short time.</div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="inline-error" role="alert">
          <div>
            <strong>Something needs attention</strong>
            <div>{errorMessage}</div>
          </div>
        </div>
      ) : null}

      {!isSuccess ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-group">
            <span className="field-label">Email</span>
            <input
              autoComplete="email"
              autoFocus
              className="input-field"
              name="email"
              onChange={(e) => { setErrorMessage(''); setEmail(e.target.value) }}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          <button
            className="button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      ) : null}

      <p className="auth-card__switch">
        <Link className="text-link" href="/login">
          Back to log in
        </Link>
      </p>
    </section>
  )
}

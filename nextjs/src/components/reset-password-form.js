'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from '@/components/providers'

function parseRecoveryToken() {
  if (typeof window === 'undefined') return { tokens: null, isCodeFlow: false }

  const hash = new URLSearchParams(window.location.hash.slice(1))
  if (hash.get('type') === 'recovery') {
    const access_token = hash.get('access_token')
    if (access_token) {
      return {
        tokens: { access_token, refresh_token: hash.get('refresh_token') || '' },
        isCodeFlow: false,
      }
    }
  }

  if (new URLSearchParams(window.location.search).get('code')) {
    return { tokens: null, isCodeFlow: true }
  }

  return { tokens: null, isCodeFlow: false }
}

export default function ResetPasswordForm() {
  const { theme, setTheme } = useTheme()
  const [tokens, setTokens] = useState(null)
  const [isCodeFlow, setIsCodeFlow] = useState(false)
  const [parsed, setParsed] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    const { tokens: found, isCodeFlow: codeFlow } = parseRecoveryToken()
    setTokens(found)
    setIsCodeFlow(codeFlow)
    setParsed(true)
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const isInit = !parsed
  const isInvalid = parsed && !tokens
  const isSuccess = status === 'success'
  const isSubmitting = status === 'submitting'

  const clearError = () => setErrorMessage('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    clearError()

    if (password !== confirm) {
      setErrorMessage('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return
    }

    setStatus('submitting')
    try {
      const response = await fetch('/api/password-reset/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          password,
        }),
      })

      let body = {}
      try { body = await response.json() } catch {}

      if (!response.ok) {
        setErrorMessage(body?.error || 'Something went wrong. Try requesting a new reset link.')
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
    <section aria-labelledby="reset-title" className="auth-card">
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
          {isInit ? 'One moment' : isInvalid ? 'Link problem' : isSuccess ? 'All done' : 'New password'}
        </div>
        <h1 className="auth-card__title" id="reset-title">
          {isInit ? 'Checking your link' : isInvalid ? 'Link expired' : isSuccess ? 'All set' : 'Choose a password'}
        </h1>
        <p className="auth-card__copy">
          {isInit
            ? 'Please wait while we verify your reset link.'
            : isInvalid && isCodeFlow
              ? 'This reset link uses a format that requires a browser code exchange — something went wrong on our end. Please request a fresh reset link and it will work correctly.'
              : isInvalid
                ? 'This reset link is invalid or has already been used. Request a fresh one from the login page.'
                : isSuccess
                  ? 'Your password has been updated. You can now sign in with your new credentials.'
                  : 'Pick something memorable. Passwords need to be at least 6 characters.'}
        </p>
      </div>

      {isSuccess ? (
        <div className="inline-banner" role="status">
          <div>
            <strong>Password updated</strong>
            <div>You&apos;re good to go — head to login.</div>
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

      {!isInit && !isInvalid && !isSuccess ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-group">
            <span className="field-label">New password</span>
            <input
              autoComplete="new-password"
              autoFocus
              className="input-field"
              minLength={6}
              name="password"
              onChange={(e) => { clearError(); setPassword(e.target.value) }}
              placeholder="At least 6 characters"
              required
              type="password"
              value={password}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Confirm password</span>
            <input
              autoComplete="new-password"
              className="input-field"
              minLength={6}
              name="confirm"
              onChange={(e) => { clearError(); setConfirm(e.target.value) }}
              placeholder="Re-enter your new password"
              required
              type="password"
              value={confirm}
            />
          </label>

          <button
            className="button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Updating...' : 'Set new password'}
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

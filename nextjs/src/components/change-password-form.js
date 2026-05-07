'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/providers'

export default function ChangePasswordForm() {
  const { session } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState('idle')

  const isSubmitting = status === 'submitting'
  const isSuccess = status === 'success'

  const clearError = () => setErrorMessage('')

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrorMessage('')
    setStatus('idle')
  }, [])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  const handleSubmit = async (event) => {
    event.preventDefault()
    clearError()

    if (!session?.accessToken) {
      setErrorMessage('Your session has expired. Please log in again.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.')
      return
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.')
      return
    }

    setStatus('submitting')
    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: session?.accessToken,
          current_password: currentPassword,
          new_password: newPassword,
        }),
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
    <>
      <div className="settings-item">
        <div aria-hidden="true" className="settings-item__icon">{'\u{1F6E1}'}</div>
        <div className="settings-item__copy">
          <strong>Password</strong>
          <span>Update your account password.</span>
        </div>
        <button
          className="button-secondary"
          disabled={!session?.accessToken}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Change password
        </button>
      </div>

      {isOpen && mounted && createPortal(
        <div
          aria-label="Change password"
          aria-modal="true"
          className="acct-modal-overlay"
          role="dialog"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="acct-modal">
          <div className="cpw-popup__header">
            <span className="cpw-popup__title">Change password</span>
            <button
              aria-label="Close"
              className="cpw-popup__close"
              onClick={handleClose}
              type="button"
            >
              ✕
            </button>
          </div>

          {isSuccess ? (
            <div className="cpw-popup__success">
              <div aria-hidden="true" className="cpw-popup__success-icon">{'\u2713'}</div>
              <h3 className="cpw-popup__success-title">Password updated</h3>
              <p className="cpw-popup__success-copy">
                Your password has been changed successfully. You&apos;re all set.
              </p>
              <button className="button-primary" onClick={handleClose} type="button">
                Done
              </button>
            </div>
          ) : (
            <>
              {errorMessage ? (
                <div className="inline-error" role="alert">
                  <div>
                    <strong>Something needs attention</strong>
                    <div>{errorMessage}</div>
                  </div>
                </div>
              ) : null}

              <form className="auth-form" onSubmit={handleSubmit}>
                <label className="field-group">
                  <span className="field-label">Current password</span>
                  <input
                    autoComplete="current-password"
                    autoFocus
                    className="input-field"
                    onChange={(e) => { clearError(); setCurrentPassword(e.target.value) }}
                    placeholder="Enter current password"
                    required
                    type="password"
                    value={currentPassword}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">New password</span>
                  <input
                    autoComplete="new-password"
                    className="input-field"
                    onChange={(e) => { clearError(); setNewPassword(e.target.value) }}
                    placeholder="At least 6 characters"
                    required
                    type="password"
                    value={newPassword}
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Confirm new password</span>
                  <input
                    autoComplete="new-password"
                    className="input-field"
                    onChange={(e) => { clearError(); setConfirmPassword(e.target.value) }}
                    placeholder="Re-enter new password"
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </label>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="button-primary"
                    disabled={isSubmitting || !session?.accessToken}
                    type="submit"
                  >
                    {isSubmitting ? 'Saving...' : 'Update password'}
                  </button>
                  <button
                    className="button-secondary"
                    onClick={handleClose}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

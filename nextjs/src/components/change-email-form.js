'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/providers'

export default function ChangeEmailForm({ onSuccess }) {
  const { session } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [updatedEmail, setUpdatedEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [status, setStatus] = useState('idle')

  const isSubmitting = status === 'submitting'
  const isSuccess = status === 'success'

  const clearError = () => setErrorMessage('')

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setNewEmail('')
    setErrorMessage('')
    setStatus('idle')
    setUpdatedEmail('')
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

    const emailToSend = newEmail.trim()
    setStatus('submitting')
    try {
      const response = await fetch('/api/change-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access_token: session?.accessToken,
          new_email: emailToSend,
        }),
      })

      let body = {}
      try { body = await response.json() } catch {}

      if (!response.ok) {
        setErrorMessage(body?.error || 'Something went wrong. Please try again.')
        setStatus('idle')
        return
      }

      const confirmedEmail = body?.email ?? emailToSend
      setUpdatedEmail(confirmedEmail)
      onSuccess?.(confirmedEmail)
      setStatus('success')
    } catch {
      setErrorMessage('Something went wrong. Please check your connection and try again.')
      setStatus('idle')
    }
  }

  return (
    <>
      <div className="settings-item">
        <div aria-hidden="true" className="settings-item__icon">{'\u2709\uFE0F'}</div>
        <div className="settings-item__copy">
          <strong>Email</strong>
          <span>Change your account email address.</span>
        </div>
        <button
          className="button-secondary"
          disabled={!session?.accessToken}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Change email
        </button>
      </div>

      {isOpen && mounted && createPortal(
        <div
          aria-label="Change email"
          aria-modal="true"
          className="acct-modal-overlay"
          role="dialog"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="acct-modal">
            <div className="cpw-popup__header">
              <span className="cpw-popup__title">Change email</span>
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
                <div aria-hidden="true" className="cpw-popup__success-icon">{'\u2709'}</div>
                <h3 className="cpw-popup__success-title">Email updated</h3>
                <p className="cpw-popup__success-copy">
                  Your account email has been changed to <strong>{updatedEmail}</strong>.
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
                    <span className="field-label">New email address</span>
                    <input
                      autoComplete="email"
                      autoFocus
                      className="input-field"
                      onChange={(e) => { clearError(); setNewEmail(e.target.value) }}
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={newEmail}
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="button-primary"
                      disabled={isSubmitting || !session?.accessToken}
                      type="submit"
                    >
                      {isSubmitting ? 'Saving…' : 'Update email'}
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

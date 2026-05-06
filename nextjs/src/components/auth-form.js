'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth, useTheme } from '@/components/providers'

const AUTH_COPY = {
  login: {
    eyebrow: 'Settle back in',
    title: "Glad you're back",
    description: 'Pick up where you left off and step back into a calmer view of your money routine.',
    submitLabel: 'Log in',
    secondaryPrompt: 'New here?',
    secondaryCta: 'Create an account',
    secondaryHref: '/signup',
    successMessage: 'Your account is ready. If email confirmation is enabled, verify your inbox first, then sign in.',
  },
  signup: {
    eyebrow: 'Start soft',
    title: "Glad you're here",
    description: 'Create your BudgetBuddy space and get the foundation in place before the real tracking tools land.',
    submitLabel: 'Create account',
    secondaryPrompt: 'Already have an account?',
    secondaryCta: 'Log in instead',
    secondaryHref: '/login',
  },
}

async function submitAuthForm(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  let body = {}
  try {
    body = await response.json()
  } catch {}

  return { response, body }
}

export default function AuthForm({ mode, initialEmail = '', showSignupSuccess = false }) {
  const copy = AUTH_COPY[mode]
  const router = useRouter()
  const { setSessionFromAuthResponse } = useAuth()
  const { theme, setTheme } = useTheme()
  const [formState, setFormState] = useState({
    email: initialEmail,
    password: '',
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setErrorMessage('')
    setFormState((currentState) => ({
      ...currentState,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const { response, body } = await submitAuthForm(`/api/${mode}`, formState)

      if (!response.ok) {
        setErrorMessage(body?.error || `We couldn't ${mode === 'login' ? 'log you in' : 'create your account'} right now.`)
        return
      }

      if (body?.access_token) {
        const storedSession = setSessionFromAuthResponse(body)
        if (!storedSession) {
          setErrorMessage("We received your session, but couldn't store it in the browser. Please try again.")
          return
        }

        router.replace('/dashboard')
        return
      }

      if (mode === 'signup' && body?.user) {
        const nextParams = new URLSearchParams({
          signup: 'success',
        })

        if (formState.email) {
          nextParams.set('email', formState.email)
        }

        router.replace(`/login?${nextParams.toString()}`)
        return
      }

      setErrorMessage(mode === 'login'
        ? 'This login response did not include a valid session token.'
        : "Your account was created, but you'll need to sign in once your session is available.")
    } catch {
      setErrorMessage(`Something went wrong while trying to ${mode === 'login' ? 'log in' : 'sign up'}.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby={`${mode}-title`}>
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
        <div className="auth-card__eyebrow">{copy.eyebrow}</div>
        <h1 className="auth-card__title" id={`${mode}-title`}>{copy.title}</h1>
        <p className="auth-card__copy">{copy.description}</p>
      </div>

      {showSignupSuccess ? (
        <div className="inline-banner" role="status">
          <div>
            <strong>Account created</strong>
            <div>{copy.successMessage}</div>
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

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span className="field-label">Email</span>
          <input
            autoComplete="email"
            className="input-field"
            name="email"
            onChange={handleChange}
            placeholder="you@example.com"
            required
            type="email"
            value={formState.email}
          />
        </label>

        <label className="field-group">
          <span className="field-label">Password</span>
          <input
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="input-field"
            minLength={6}
            name="password"
            onChange={handleChange}
            placeholder={mode === 'login' ? 'Enter your password' : 'Choose a password'}
            required
            type="password"
            value={formState.password}
          />
        </label>

        <button className="button-primary" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Just a second...' : copy.submitLabel}
        </button>
      </form>

      <p className="auth-card__switch">
        {copy.secondaryPrompt}{' '}
        <Link className="text-link" href={copy.secondaryHref}>
          {copy.secondaryCta}
        </Link>
      </p>

      <p className="auth-card__switch">
        <Link className="text-link" href="/forgot-password">
          Can&apos;t remember your password?
        </Link>
      </p>

      <p className="auth-card__switch">
        <Link className="text-link" href="/demo">
          Explore a demo first &rarr;
        </Link>
      </p>
    </section>
  )
}

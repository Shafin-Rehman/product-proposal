/** @jest-environment jsdom */

const React = require('react')
const { act, render, screen, waitFor } = require('@testing-library/react')
const { AppProviders, useAuth } = require('@/components/providers')
const { SESSION_STORAGE_KEY } = require('@/lib/session')

function AuthStatus() {
  const { isAuthenticated, isReady, logout, session } = useAuth()

  return (
    React.createElement('div', null,
      React.createElement('span', { 'data-testid': 'ready' }, isReady ? 'ready' : 'loading'),
      React.createElement('span', { 'data-testid': 'auth-state' }, isAuthenticated ? 'signed-in' : 'signed-out'),
      React.createElement('span', { 'data-testid': 'token' }, session?.accessToken ?? 'none'),
      React.createElement('button', { onClick: logout, type: 'button' }, 'Log out')
    )
  )
}

function renderWithProviders() {
  return render(React.createElement(AppProviders, null, React.createElement(AuthStatus)))
}

function createStoredSession(accessToken = 'tok-123') {
  return JSON.stringify({
    accessToken,
    user: {
      id: 'u1',
      email: 'a@b.com',
    },
  })
}

describe('AppProviders auth session storage sync', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('updates auth state when another tab removes the stored session', async () => {
    const storedSession = createStoredSession()
    window.localStorage.setItem(SESSION_STORAGE_KEY, storedSession)

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready')
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
    })

    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: SESSION_STORAGE_KEY,
        oldValue: storedSession,
        newValue: null,
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
      expect(screen.getByTestId('token').textContent).toBe('none')
    })
  })

  it('ignores unrelated storage events', async () => {
    const storedSession = createStoredSession()
    window.localStorage.setItem(SESSION_STORAGE_KEY, storedSession)

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
    })

    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'budgetbuddy.theme',
        oldValue: 'light',
        newValue: 'dark',
      }))
    })

    expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
    expect(screen.getByTestId('token').textContent).toBe('tok-123')
  })

  it('keeps same-tab logout immediate', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, createStoredSession())

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
    })

    act(() => {
      screen.getByRole('button', { name: /log out/i }).click()
    })

    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
    })
  })
})

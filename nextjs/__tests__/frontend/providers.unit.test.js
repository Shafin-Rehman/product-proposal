/** @jest-environment jsdom */

const React = require('react')
const { act, render, screen, waitFor } = require('@testing-library/react')
const { AppProviders, useAuth, useDataChanged, useDataMode, useTheme } = require('@/components/providers')
const { SESSION_STORAGE_KEY } = require('@/lib/session')

function AuthStatus() {
  const { isAuthenticated, isReady, logout, session, setSessionFromAuthResponse } = useAuth()

  return (
    React.createElement('div', null,
      React.createElement('span', { 'data-testid': 'ready' }, isReady ? 'ready' : 'loading'),
      React.createElement('span', { 'data-testid': 'auth-state' }, isAuthenticated ? 'signed-in' : 'signed-out'),
      React.createElement('span', { 'data-testid': 'token' }, session?.accessToken ?? 'none'),
      React.createElement('span', { 'data-testid': 'user-email' }, session?.user?.email ?? 'none'),
      React.createElement('button', {
        onClick: () => setSessionFromAuthResponse({
          access_token: 'tok-login',
          user: { id: 'u-login', email: 'login@example.com' },
        }),
        type: 'button',
      }, 'Log in'),
      React.createElement('button', {
        onClick: () => setSessionFromAuthResponse({ access_token: '', user: { id: 'u1', email: 'a@b.com' } }),
        type: 'button',
      }, 'Invalid login'),
      React.createElement('button', { onClick: logout, type: 'button' }, 'Log out')
    )
  )
}

function ProviderControls() {
  const { theme, setTheme } = useTheme()
  const { mode, isDataModeReady, isSampleMode, setMode } = useDataMode()
  const { dataChangedToken, notifyDataChanged } = useDataChanged()

  return (
    React.createElement('div', null,
      React.createElement('span', { 'data-testid': 'theme' }, theme),
      React.createElement('span', { 'data-testid': 'mode' }, mode),
      React.createElement('span', { 'data-testid': 'mode-ready' }, isDataModeReady ? 'ready' : 'loading'),
      React.createElement('span', { 'data-testid': 'sample-mode' }, isSampleMode ? 'sample' : 'live'),
      React.createElement('span', { 'data-testid': 'data-token' }, String(dataChangedToken)),
      React.createElement('button', { onClick: () => setTheme('light'), type: 'button' }, 'Light theme'),
      React.createElement('button', { onClick: () => setTheme('dark'), type: 'button' }, 'Dark theme'),
      React.createElement('button', { onClick: () => setMode('live'), type: 'button' }, 'Live mode'),
      React.createElement('button', { onClick: () => setMode('sample'), type: 'button' }, 'Sample mode'),
      React.createElement('button', { onClick: notifyDataChanged, type: 'button' }, 'Notify data changed')
    )
  )
}

function renderWithProviders() {
  return render(React.createElement(AppProviders, null, React.createElement(AuthStatus)))
}

function renderProviderControls() {
  return render(React.createElement(AppProviders, null, React.createElement(ProviderControls)))
}

function createStoredSession(accessToken = 'tok-123', user = { id: 'u1', email: 'a@b.com' }) {
  return JSON.stringify({
    accessToken,
    user,
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

  it('updates auth state when another tab clears all local storage', async () => {
    const storedSession = createStoredSession()
    window.localStorage.setItem(SESSION_STORAGE_KEY, storedSession)

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready')
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
    })

    window.localStorage.clear()
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: null,
        oldValue: null,
        newValue: null,
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
      expect(screen.getByTestId('token').textContent).toBe('none')
    })
  })

  it('stores a valid auth response and ignores an invalid auth response', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
    })

    act(() => {
      screen.getByRole('button', { name: /invalid login/i }).click()
    })

    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')

    act(() => {
      screen.getByRole('button', { name: /log in/i }).click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
      expect(screen.getByTestId('token').textContent).toBe('tok-login')
    })
    expect(JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY))).toEqual({
      accessToken: 'tok-login',
      user: { id: 'u-login', email: 'login@example.com' },
    })
  })

  it('stays signed out when another tab removes an already missing stored session', async () => {
    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready')
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
    })

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: SESSION_STORAGE_KEY,
        oldValue: null,
        newValue: null,
      }))
    })

    expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
    expect(screen.getByTestId('token').textContent).toBe('none')
  })

  it('clears auth state when another tab writes malformed session JSON', async () => {
    const storedSession = createStoredSession()
    window.localStorage.setItem(SESSION_STORAGE_KEY, storedSession)

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
    })

    window.localStorage.setItem(SESSION_STORAGE_KEY, '{not-json')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: SESSION_STORAGE_KEY,
        oldValue: storedSession,
        newValue: '{not-json',
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
      expect(screen.getByTestId('token').textContent).toBe('none')
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    })
  })

  it('updates auth state when another tab replaces malformed session JSON with valid JSON', async () => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, '{not-json')

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready')
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-out')
      expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull()
    })

    const nextStoredSession = createStoredSession('tok-next')
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextStoredSession)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: SESSION_STORAGE_KEY,
        oldValue: '{not-json',
        newValue: nextStoredSession,
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
      expect(screen.getByTestId('token').textContent).toBe('tok-next')
    })
  })

  it('updates auth state when another tab replaces the stored session', async () => {
    const storedSession = createStoredSession('tok-current', { id: 'u-current', email: 'current@example.com' })
    window.localStorage.setItem(SESSION_STORAGE_KEY, storedSession)

    renderWithProviders()

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
      expect(screen.getByTestId('token').textContent).toBe('tok-current')
      expect(screen.getByTestId('user-email').textContent).toBe('current@example.com')
    })

    const nextStoredSession = createStoredSession('tok-replacement', { id: 'u-replacement', email: 'replacement@example.com' })
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextStoredSession)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: SESSION_STORAGE_KEY,
        oldValue: storedSession,
        newValue: nextStoredSession,
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId('auth-state').textContent).toBe('signed-in')
      expect(screen.getByTestId('token').textContent).toBe('tok-replacement')
      expect(screen.getByTestId('user-email').textContent).toBe('replacement@example.com')
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

describe('AppProviders shared app contexts', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.dataset.theme = ''
    document.documentElement.style.colorScheme = ''
  })

  it('hydrates and updates theme, data mode, and data changed context state', async () => {
    window.localStorage.setItem('budgetbuddy.theme', 'dark')
    window.localStorage.setItem('budgetbuddy.data-mode', 'sample')

    renderProviderControls()

    await waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('dark')
      expect(screen.getByTestId('mode').textContent).toBe('sample')
      expect(screen.getByTestId('mode-ready').textContent).toBe('ready')
      expect(screen.getByTestId('sample-mode').textContent).toBe('sample')
      expect(document.documentElement.dataset.theme).toBe('dark')
    })

    act(() => {
      screen.getByRole('button', { name: /light theme/i }).click()
      screen.getByRole('button', { name: /live mode/i }).click()
      screen.getByRole('button', { name: /notify data changed/i }).click()
    })

    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(screen.getByTestId('mode').textContent).toBe('live')
    expect(screen.getByTestId('sample-mode').textContent).toBe('live')
    expect(screen.getByTestId('data-token').textContent).toBe('1')
    expect(window.localStorage.getItem('budgetbuddy.theme')).toBe('light')
    expect(window.localStorage.getItem('budgetbuddy.data-mode')).toBe('live')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('defaults invalid stored app preferences and can switch them back to enabled states', async () => {
    window.localStorage.setItem('budgetbuddy.theme', 'solarized')
    window.localStorage.setItem('budgetbuddy.data-mode', 'invalid')

    renderProviderControls()

    await waitFor(() => {
      expect(screen.getByTestId('theme').textContent).toBe('light')
      expect(screen.getByTestId('mode').textContent).toBe('live')
      expect(screen.getByTestId('sample-mode').textContent).toBe('live')
    })

    act(() => {
      screen.getByRole('button', { name: /dark theme/i }).click()
      screen.getByRole('button', { name: /sample mode/i }).click()
    })

    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByTestId('mode').textContent).toBe('sample')
    expect(screen.getByTestId('sample-mode').textContent).toBe('sample')
    expect(window.localStorage.getItem('budgetbuddy.theme')).toBe('dark')
    expect(window.localStorage.getItem('budgetbuddy.data-mode')).toBe('sample')
  })

  it('throws clear errors when app hooks are used outside AppProviders', () => {
    const originalConsoleError = console.error
    console.error = jest.fn()

    function AuthOnly() {
      useAuth()
      return null
    }

    function ThemeOnly() {
      useTheme()
      return null
    }

    function DataModeOnly() {
      useDataMode()
      return null
    }

    function DataChangedOnly() {
      useDataChanged()
      return null
    }

    try {
      expect(() => render(React.createElement(AuthOnly))).toThrow('useAuth must be used within AppProviders')
      expect(() => render(React.createElement(ThemeOnly))).toThrow('useTheme must be used within AppProviders')
      expect(() => render(React.createElement(DataModeOnly))).toThrow('useDataMode must be used within AppProviders')
      expect(() => render(React.createElement(DataChangedOnly))).toThrow('useDataChanged must be used within AppProviders')
    } finally {
      console.error = originalConsoleError
    }
  })
})

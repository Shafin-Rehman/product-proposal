/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
}))

const React = require('react')
const { render, screen, act } = require('@testing-library/react')
const { useRouter, usePathname } = require('next/navigation')
const { useAuth, useDataMode } = require('@/components/providers')
const AuthLayout = require('@/app/(auth)/layout').default

const mockReplace = jest.fn()

function setLocation(pathname, hash = '') {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { pathname, hash, href: `http://localhost${pathname}${hash}` },
  })
}

beforeEach(() => {
  mockReplace.mockClear()
  useRouter.mockReturnValue({ replace: mockReplace })
  usePathname.mockReturnValue('/login')
  setLocation('/login', '')
  useDataMode.mockReturnValue({ setMode: jest.fn() })
})

afterEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------
describe('AuthLayout — loading', () => {
  it('shows the loading skeleton while auth is not ready', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false })
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'content')))
    })
    expect(screen.getByText(/checking whether/i)).toBeTruthy()
    expect(screen.queryByText('content')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Unauthenticated — render children, do not redirect
// ---------------------------------------------------------------------------
describe('AuthLayout — unauthenticated', () => {
  it('renders children when user is not authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false })
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'login form')))
    })
    expect(screen.getByText('login form')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Authenticated — redirect to dashboard (no recovery token)
// ---------------------------------------------------------------------------
describe('AuthLayout — authenticated, non-recovery path', () => {
  it('redirects an authenticated user away from /login', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    usePathname.mockReturnValue('/login')
    setLocation('/login', '')
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'login form')))
    })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    expect(screen.queryByText('login form')).toBeNull()
  })

  it('redirects an authenticated user away from /signup', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    usePathname.mockReturnValue('/signup')
    setLocation('/signup', '')
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'signup form')))
    })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })
})

// ---------------------------------------------------------------------------
// Recovery path — authenticated but on reset-password with valid token
// ---------------------------------------------------------------------------
describe('AuthLayout — recovery path', () => {
  it('does NOT redirect when on /reset-password with a valid recovery hash', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    usePathname.mockReturnValue('/reset-password')
    setLocation('/reset-password', '#access_token=tok123&type=recovery')
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'reset form')))
    })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.getByText('reset form')).toBeTruthy()
  })

  it('redirects when on /reset-password but hash has wrong type', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    usePathname.mockReturnValue('/reset-password')
    setLocation('/reset-password', '#access_token=tok123&type=signup')
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'reset form')))
    })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects when on /reset-password but access_token is missing', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    usePathname.mockReturnValue('/reset-password')
    setLocation('/reset-password', '#type=recovery')
    await act(async () => {
      render(React.createElement(AuthLayout, null, React.createElement('div', null, 'reset form')))
    })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })
})

// ---------------------------------------------------------------------------
// Stale-value regression: navigating from /reset-password to /login
// ---------------------------------------------------------------------------
describe('AuthLayout — navigation regression', () => {
  it('redirects after navigating from recovery path to /login', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })

    // First render: user is on /reset-password with a valid token
    usePathname.mockReturnValue('/reset-password')
    setLocation('/reset-password', '#access_token=tok123&type=recovery')
    const { rerender } = render(
      React.createElement(AuthLayout, null, React.createElement('div', null, 'reset form'))
    )
    await act(async () => {})
    expect(mockReplace).not.toHaveBeenCalled()

    // Simulate navigation to /login (hash is gone, pathname changed)
    usePathname.mockReturnValue('/login')
    setLocation('/login', '')
    await act(async () => {
      rerender(React.createElement(AuthLayout, null, React.createElement('div', null, 'login form')))
    })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })
})

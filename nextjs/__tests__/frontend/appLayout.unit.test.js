/** @jest-environment jsdom */
// Source: src/app/(app)/layout.js
//
// Tests focus on the three guard behaviours:
//   1. Show loading shell when not ready and not authenticated (live mode)
//   2. Redirect to /login when ready but unauthenticated (live mode)
//   3. Skip the guard entirely in demo/sample mode — render children immediately

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
}))

// Stub next/link so it renders a plain <a> — keeps the DOM simple
jest.mock('next/link', () => {
  const React = require('react')
  return function MockLink({ href, children, ...rest }) {
    return React.createElement('a', { href, ...rest }, children)
  }
})

const React = require('react')
const { render, screen, act } = require('@testing-library/react')
const { useRouter, usePathname } = require('next/navigation')
const { useAuth, useDataMode } = require('@/components/providers')
const AppLayout = require('@/app/(app)/layout').default

let mockReplace

beforeEach(() => {
  mockReplace = jest.fn()
  useRouter.mockReturnValue({ replace: mockReplace })
  usePathname.mockReturnValue('/dashboard')
})

afterEach(() => {
  jest.clearAllMocks()
})

function child() {
  return React.createElement('div', null, 'page content')
}

// ---------------------------------------------------------------------------
// Loading shell — live mode, auth not ready
// ---------------------------------------------------------------------------
describe('AppLayout — loading shell (live mode)', () => {
  it('shows the loading shell when not ready and not authenticated', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false })
    useDataMode.mockReturnValue({ isSampleMode: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText(/loading your budget space/i)).toBeTruthy()
    expect(screen.queryByText('page content')).toBeNull()
  })

  it('shows the loading shell when ready but not yet authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false })
    useDataMode.mockReturnValue({ isSampleMode: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText(/loading your budget space/i)).toBeTruthy()
    expect(screen.queryByText('page content')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Redirect — live mode, unauthenticated after ready
// ---------------------------------------------------------------------------
describe('AppLayout — redirect to /login (live mode)', () => {
  it('redirects to /login when ready and not authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false })
    useDataMode.mockReturnValue({ isSampleMode: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('does NOT redirect when authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    useDataMode.mockReturnValue({ isSampleMode: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Authenticated — renders children and nav
// ---------------------------------------------------------------------------
describe('AppLayout — authenticated (live mode)', () => {
  it('renders children when authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    useDataMode.mockReturnValue({ isSampleMode: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText('page content')).toBeTruthy()
  })

  it('renders all 5 nav tab links', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true })
    useDataMode.mockReturnValue({ isSampleMode: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    const navLinks = screen.getAllByRole('link')
    const labels = navLinks.map((l) => l.textContent)
    expect(labels.some((t) => /dashboard/i.test(t))).toBe(true)
    expect(labels.some((t) => /planner/i.test(t))).toBe(true)
    expect(labels.some((t) => /transactions/i.test(t))).toBe(true)
    expect(labels.some((t) => /insights/i.test(t))).toBe(true)
    expect(labels.some((t) => /account/i.test(t))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Demo / sample mode — guard skipped entirely
// ---------------------------------------------------------------------------
describe('AppLayout — demo / sample mode', () => {
  it('renders children immediately without a session in sample mode', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false })
    useDataMode.mockReturnValue({ isSampleMode: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText('page content')).toBeTruthy()
    expect(screen.queryByText(/loading your budget space/i)).toBeNull()
  })

  it('does NOT redirect to /login in sample mode', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false })
    useDataMode.mockReturnValue({ isSampleMode: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('marks the active tab correctly in sample mode', async () => {
    usePathname.mockReturnValue('/dashboard')
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false })
    useDataMode.mockReturnValue({ isSampleMode: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    const activeLink = screen.getByRole('link', { name: /dashboard/i })
    expect(activeLink.getAttribute('aria-current')).toBe('page')
  })
})

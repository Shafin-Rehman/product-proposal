/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}))

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
}))

jest.mock('@/lib/apiClient', () => ({
  apiPost: jest.fn(),
}))

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
const { apiPost } = require('@/lib/apiClient')
const AppLayout = require('@/app/(app)/layout').default

let mockReplace

beforeEach(() => {
  mockReplace = jest.fn()
  apiPost.mockResolvedValue({})
  useRouter.mockReturnValue({ replace: mockReplace })
  usePathname.mockReturnValue('/dashboard')
})

afterEach(() => {
  jest.clearAllMocks()
})

function child() {
  return React.createElement('div', null, 'page content')
}

describe('AppLayout — loading shell (live mode)', () => {
  it('shows the loading shell when not ready and not authenticated', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText(/loading your budget space/i)).toBeTruthy()
    expect(screen.queryByText('page content')).toBeNull()
  })

  it('shows the loading shell when ready but not yet authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText(/loading your budget space/i)).toBeTruthy()
    expect(screen.queryByText('page content')).toBeNull()
  })
})

describe('AppLayout — redirect to /login (live mode)', () => {
  it('redirects to /login when ready and not authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('does NOT redirect when authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-1' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does NOT redirect when data mode is not yet ready', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: false })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('AppLayout — authenticated (live mode)', () => {
  it('renders children when authenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-1' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText('page content')).toBeTruthy()
  })

  it('renders all 5 nav tab links', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-1' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
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

describe('AppLayout — demo / sample mode', () => {
  it('renders children immediately without a session in sample mode', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: true, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(screen.getByText('page content')).toBeTruthy()
    expect(screen.queryByText(/loading your budget space/i)).toBeNull()
  })

  it('does NOT redirect to /login in sample mode', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: true, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('marks the active tab correctly in sample mode', async () => {
    usePathname.mockReturnValue('/dashboard')
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: true, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    const activeLink = screen.getByRole('link', { name: /dashboard/i })
    expect(activeLink.getAttribute('aria-current')).toBe('page')
  })
})

describe('AppLayout — recurring process trigger', () => {
  it('calls POST /api/recurring/process when authenticated in live mode', async () => {
    usePathname.mockReturnValue('/dashboard')
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-1' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(apiPost).toHaveBeenCalledWith('/api/recurring/process', {}, { accessToken: 'tok-1' })
  })

  it('calls POST /api/recurring/process when landing on the planner page', async () => {
    usePathname.mockReturnValue('/planner')
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-2' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(apiPost).toHaveBeenCalledWith('/api/recurring/process', {}, { accessToken: 'tok-2' })
  })

  it('calls POST /api/recurring/process when landing on the insights page', async () => {
    usePathname.mockReturnValue('/insights')
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-3' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(apiPost).toHaveBeenCalledWith('/api/recurring/process', {}, { accessToken: 'tok-3' })
  })

  it('calls POST /api/recurring/process again when pathname changes (in-app navigation)', async () => {
    usePathname.mockReturnValue('/dashboard')
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: true, session: { accessToken: 'tok-nav' } })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    let rerender
    await act(async () => {
      const result = render(React.createElement(AppLayout, null, child()))
      rerender = result.rerender
    })
    expect(apiPost).toHaveBeenCalledTimes(1)
    usePathname.mockReturnValue('/planner')
    await act(async () => {
      rerender(React.createElement(AppLayout, null, child()))
    })
    expect(apiPost).toHaveBeenCalledTimes(2)
    expect(apiPost).toHaveBeenLastCalledWith('/api/recurring/process', {}, { accessToken: 'tok-nav' })
  })

  it('does NOT call POST /api/recurring/process in sample mode', async () => {
    useAuth.mockReturnValue({ isReady: false, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: true, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(apiPost).not.toHaveBeenCalledWith('/api/recurring/process', expect.anything(), expect.anything())
  })

  it('does NOT call POST /api/recurring/process when unauthenticated', async () => {
    useAuth.mockReturnValue({ isReady: true, isAuthenticated: false, session: null })
    useDataMode.mockReturnValue({ isSampleMode: false, isDataModeReady: true })
    await act(async () => { render(React.createElement(AppLayout, null, child())) })
    expect(apiPost).not.toHaveBeenCalledWith('/api/recurring/process', expect.anything(), expect.anything())
  })
})

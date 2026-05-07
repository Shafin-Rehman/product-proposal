/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn(), push: jest.fn() })),
}))

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
  useTheme: jest.fn(),
}))

jest.mock('@/components/change-password-form', () => {
  const React = require('react')
  return function MockChangePasswordForm() {
    return React.createElement('div', { 'data-testid': 'change-password-form' })
  }
})

let capturedOnSuccess = null
jest.mock('@/components/change-email-form', () => {
  const React = require('react')
  return function MockChangeEmailForm({ onSuccess }) {
    capturedOnSuccess = onSuccess
    return React.createElement('div', { 'data-testid': 'change-email-form' })
  }
})

const React = require('react')
const { render, screen, fireEvent, act, waitFor } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useTheme } = require('@/components/providers')
const AccountPage = require('@/app/(app)/account/page').default

function setup({ email = 'john.doe@example.com', theme = 'light', mode = 'live', profileName = '' } = {}) {
  const mockReplace = jest.fn()
  useRouter.mockReturnValue({ replace: mockReplace })
  useAuth.mockReturnValue({
    user: email ? { email } : {},
    logout: jest.fn(),
    profileName: profileName || '',
    session: { accessToken: 'test-token' },
    updateProfileName: jest.fn(),
    updateEmail: jest.fn(),
  })
  useDataMode.mockReturnValue({ mode, isSampleMode: mode === 'sample', setMode: jest.fn() })
  useTheme.mockReturnValue({ theme, setTheme: jest.fn() })
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
}

afterEach(() => {
  jest.clearAllMocks()
  delete global.fetch
})


describe('AccountPage — profile section', () => {
  it('shows email-derived name when no profile name is in context', async () => {
    setup({ email: 'jane.smith@example.com', profileName: '' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText('Jane Smith')).toBeTruthy()
  })

  it('shows profile name from auth context when one is set', async () => {
    setup({ email: 'jane.smith@example.com', profileName: 'Jane S.' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText('Jane S.')).toBeTruthy()
  })

  it('renders the email address', async () => {
    setup({ email: 'test@example.com' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText('test@example.com')).toBeTruthy()
  })
})

describe('AccountPage — theme controls', () => {
  it('shows "Dark mode" when theme is dark', async () => {
    setup({ theme: 'dark' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText('Dark mode')).toBeTruthy()
  })

  it('calls setTheme("dark") when Dark button is clicked', async () => {
    const setTheme = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout: jest.fn() })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'light', setTheme })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('calls setTheme("light") when Light button is clicked', async () => {
    const setTheme = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout: jest.fn() })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'dark', setTheme })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})

describe('AccountPage — logout', () => {
  it('logout button calls logout and router.replace("/login")', async () => {
    const logout = jest.fn()
    const mockReplace = jest.fn()
    useRouter.mockReturnValue({ replace: mockReplace })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(logout).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })

  it('logout button shows "Signing you out..." and becomes disabled when clicked', async () => {
    const logout = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(screen.getByRole('button', { name: /signing you out/i }).disabled).toBe(true)
  })
})


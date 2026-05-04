/** @jest-environment jsdom */
// Source: src/app/(app)/account/page.js

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

const React = require('react')
const { render, screen, fireEvent, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useTheme } = require('@/components/providers')
const AccountPage = require('@/app/(app)/account/page').default

function setup({ email = 'john.doe@example.com', theme = 'light', mode = 'live' } = {}) {
  const mockReplace = jest.fn()
  useRouter.mockReturnValue({ replace: mockReplace, push: jest.fn() })
  useAuth.mockReturnValue({ user: email ? { email } : {}, logout: jest.fn() })
  useDataMode.mockReturnValue({ mode, isSampleMode: mode === 'sample', setMode: jest.fn() })
  useTheme.mockReturnValue({ theme, setTheme: jest.fn() })
  return { mockReplace }
}

describe('AccountPage — display name and initials', () => {
  it('renders display name derived from email', async () => {
    setup({ email: 'jane.smith@example.com' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText('Jane Smith')).toBeTruthy()
  })

  it('falls back to "BudgetBuddy member" when email is absent', async () => {
    setup({ email: '' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText('BudgetBuddy member')).toBeTruthy()
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
    useRouter.mockReturnValue({ replace: jest.fn(), push: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout: jest.fn() })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'light', setTheme })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /^dark$/i }))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('calls setTheme("light") when Light button is clicked', async () => {
    const setTheme = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn(), push: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout: jest.fn() })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'dark', setTheme })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /^light$/i }))
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})

describe('AccountPage — data mode controls', () => {
  it('shows "Sample data" copy when mode is sample', async () => {
    setup({ mode: 'sample' })
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText(/sample data — exploring/i)).toBeTruthy()
  })

  it('calls setMode("sample") when Sample button is clicked', async () => {
    const setMode = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn(), push: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout: jest.fn() })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode })
    useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /^sample$/i }))
    expect(setMode).toHaveBeenCalledWith('sample')
  })

  it('calls setMode("live") when Live button is clicked', async () => {
    const setMode = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn(), push: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout: jest.fn() })
    useDataMode.mockReturnValue({ mode: 'sample', isSampleMode: true, setMode })
    useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /^live$/i }))
    expect(setMode).toHaveBeenCalledWith('live')
  })
})

describe('AccountPage — logout', () => {
  it('logout button calls logout and router.replace("/login")', async () => {
    const logout = jest.fn()
    const mockReplace = jest.fn()
    useRouter.mockReturnValue({ replace: mockReplace, push: jest.fn() })
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
    useRouter.mockReturnValue({ replace: jest.fn(), push: jest.fn() })
    useAuth.mockReturnValue({ user: { email: 'a@b.com' }, logout })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /log out/i }))
    expect(screen.getByRole('button', { name: /signing you out/i }).disabled).toBe(true)
  })
})


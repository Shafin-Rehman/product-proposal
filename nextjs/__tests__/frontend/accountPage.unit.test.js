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

describe('AccountPage — forgot password hint', () => {
  it('renders the "Can\'t remember your password?" heading', async () => {
    setup()
    await act(async () => { render(React.createElement(AccountPage)) })
    const [heading] = screen.getAllByText(/can't remember your password\?/i)
    expect(heading).toBeTruthy()
  })

  it('hint text instructs to log out then use the login-page link', async () => {
    setup()
    await act(async () => { render(React.createElement(AccountPage)) })
    expect(screen.getByText(/log out.*on the login page/i)).toBeTruthy()
  })
})

describe('AccountPage — display name editing', () => {
  it('opens the name input pre-filled with current display name on edit click', async () => {
    setup({ profileName: 'Jane S.' })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /edit display name/i }))
    expect(screen.getByRole('textbox', { name: /display name/i }).value).toBe('Jane S.')
  })

  it('cancel editing restores the display name without saving', async () => {
    setup({ profileName: 'Jane S.' })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /edit display name/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: 'Something Else' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not save when name is empty', async () => {
    setup({ profileName: 'Jane S.' })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /edit display name/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: '   ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    })
    expect(screen.getByText(/name cannot be empty/i)).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls PATCH /api/profile and updateProfileName on successful save', async () => {
    const updateProfileName = jest.fn()
    useRouter.mockReturnValue({ replace: jest.fn() })
    useAuth.mockReturnValue({
      user: { email: 'jane@example.com' },
      logout: jest.fn(),
      profileName: 'Jane S.',
      session: { accessToken: 'tok' },
      updateProfileName,
      updateEmail: jest.fn(),
    })
    useDataMode.mockReturnValue({ mode: 'live', isSampleMode: false, setMode: jest.fn() })
    useTheme.mockReturnValue({ theme: 'light', setTheme: jest.fn() })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'Jane Updated' }) })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /edit display name/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: 'Jane Updated' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/profile',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Jane Updated' }),
      })
    )
    expect(updateProfileName).toHaveBeenCalledWith('Jane Updated')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows a server error message when the API returns a non-ok response', async () => {
    setup({ profileName: 'Jane S.' })
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Name update failed on server' }),
    })
    await act(async () => { render(React.createElement(AccountPage)) })
    fireEvent.click(screen.getByRole('button', { name: /edit display name/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /display name/i }), { target: { value: 'New Name' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    })
    expect(screen.getByText('Name update failed on server')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /display name/i })).toBeTruthy()
  })
})


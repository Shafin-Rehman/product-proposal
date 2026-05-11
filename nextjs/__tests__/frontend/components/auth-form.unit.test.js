/** @jest-environment jsdom */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) =>
    require('react').createElement('a', { href, ...props }, children),
}))

const mockReplace = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace })),
}))

const setSessionFromAuthResponse = jest.fn()
const setTheme = jest.fn()
jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(() => ({ setSessionFromAuthResponse })),
  useTheme: jest.fn(() => ({ theme: 'light', setTheme })),
}))

const React = require('react')
const { render, screen, fireEvent, waitFor, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useTheme } = require('@/components/providers')
const AuthForm = require('@/components/auth-form').default

function setupRouter() {
  mockReplace.mockClear()
  useRouter.mockReturnValue({ replace: mockReplace })
}

function setupAuth(overrides = {}) {
  setSessionFromAuthResponse.mockReset()
  setSessionFromAuthResponse.mockReturnValue({ accessToken: 'stored' })
  useAuth.mockReturnValue({ setSessionFromAuthResponse, ...overrides })
}

function setupTheme(theme = 'light') {
  setTheme.mockClear()
  useTheme.mockReturnValue({ theme, setTheme })
}

beforeEach(() => {
  setupRouter()
  setupAuth()
  setupTheme('light')
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.clearAllMocks()
  delete global.fetch
})

async function submitLoginForm(email = 'pat@example.com', password = 'secret12') {
  await act(async () => { render(React.createElement(AuthForm, { mode: 'login' })) })
  fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { name: 'email', value: email } })
  fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { name: 'password', value: password } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form'))
  })
}

async function submitSignupForm(email = 'x@y.com', password = 'abcdef') {
  await act(async () => { render(React.createElement(AuthForm, { mode: 'signup' })) })
  fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { name: 'email', value: email } })
  fireEvent.change(screen.getByPlaceholderText(/choose a password/i), { target: { name: 'password', value: password } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
  })
}

describe('AuthForm — login mode', () => {
  it('stores session and navigates to dashboard after a successful token response', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'jwt-1', user: { id: 'u1' } }),
    })
    await submitLoginForm('pat@example.com', 'secret12')

    expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'pat@example.com', password: 'secret12' }),
    }))
    expect(setSessionFromAuthResponse).toHaveBeenCalledWith(expect.objectContaining({ access_token: 'jwt-1' }))
    await waitFor(() => { expect(mockReplace).toHaveBeenCalledWith('/dashboard') })
  })

  it.each([
    ['structured error', { ok: false, json: async () => ({ error: 'Invalid credentials' }) }, /invalid credentials/i],
    ['missing error field', { ok: false, json: async () => ({}) }, /couldn't log you in right now/i],
    ['non-JSON body', { ok: false, json: async () => { throw new SyntaxError('invalid json') } }, /couldn't log you in/i],
    ['network reject', null, /something went wrong while trying to log in/i],
  ])('shows the correct error for a %s response', async (_, mockResponse, pattern) => {
    if (mockResponse) {
      global.fetch.mockResolvedValue(mockResponse)
    } else {
      global.fetch.mockRejectedValue(new Error('offline'))
    }
    await submitLoginForm()
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toMatch(pattern) })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows a message when the server omits a session token on success', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ message: 'ok but no token' }) })
    await submitLoginForm()
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/did not include a valid session token/i)
    })
    expect(setSessionFromAuthResponse).not.toHaveBeenCalled()
  })

  it('shows a storage error when the session cannot be persisted', async () => {
    setSessionFromAuthResponse.mockReturnValue(null)
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'jwt-1' }) })
    await submitLoginForm()
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/couldn't store it in the browser/i)
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('AuthForm — signup mode', () => {
  it('redirects to login with success params when the API returns a user without a token', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ user: { id: 'new-user' } }) })
    await submitSignupForm('new@example.com', 'newpass1')

    expect(global.fetch).toHaveBeenCalledWith('/api/signup', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', password: 'newpass1' }),
    }))
    await waitFor(() => { expect(mockReplace).toHaveBeenCalled() })
    const [url] = mockReplace.mock.calls[0]
    expect(url).toMatch(/\/login\?/)
    expect(url).toMatch(/signup=success/)
    expect(url).toMatch(/email=new%40example\.com/)
  })

  it.each([
    ['server failure', { ok: false, json: async () => ({}) }, /couldn't create your account right now/i],
    ['network reject', null, /something went wrong while trying to sign up/i],
    ['success without user or token', { ok: true, json: async () => ({}) }, /you'll need to sign in once your session is available/i],
  ])('shows the correct message for a %s response', async (_, mockResponse, pattern) => {
    if (mockResponse) {
      global.fetch.mockResolvedValue(mockResponse)
    } else {
      global.fetch.mockRejectedValue(new Error('offline'))
    }
    await submitSignupForm()
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toMatch(pattern) })
  })
})

describe('AuthForm — post-signup banner and prefilled email', () => {
  it('shows the post-signup success banner when showSignupSuccess is true', async () => {
    await act(async () => {
      render(React.createElement(AuthForm, { mode: 'login', showSignupSuccess: true }))
    })
    expect(screen.getByRole('status').textContent).toMatch(/account created/i)
    expect(screen.getByRole('status').textContent).toMatch(/verify your inbox/i)
  })

  it('prefills the email field from initialEmail', async () => {
    await act(async () => {
      render(React.createElement(AuthForm, { mode: 'login', initialEmail: 'returned@example.com' }))
    })
    expect(screen.getByPlaceholderText(/you@example\.com/i).value).toBe('returned@example.com')
  })

  it('clears a prior error when the user edits a field after a failed submit', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Bad login' }) })
    await submitLoginForm('a@b.com', 'short')
    await waitFor(() => { expect(screen.getByRole('alert')).toBeTruthy() })
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { name: 'email', value: 'patched@example.com' },
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('AuthForm — theme toggle', () => {
  it.each([
    ['dark', /^light$/i, 'light'],
    ['light', /^dark$/i, 'dark'],
  ])('calls setTheme when the UI is in %s mode', async (theme, buttonName, expected) => {
    useTheme.mockReturnValue({ theme, setTheme })
    await act(async () => { render(React.createElement(AuthForm, { mode: 'login' })) })
    fireEvent.click(screen.getByRole('button', { name: buttonName }))
    expect(setTheme).toHaveBeenCalledWith(expected)
  })
})

describe('AuthForm — navigation links', () => {
  it('on login, links to signup, forgot password, and demo use the expected routes', async () => {
    await act(async () => { render(React.createElement(AuthForm, { mode: 'login' })) })
    expect(screen.getByRole('link', { name: /create an account/i }).getAttribute('href')).toBe('/signup')
    expect(screen.getByRole('link', { name: /can't remember your password/i }).getAttribute('href')).toBe('/forgot-password')
    expect(screen.getByRole('link', { name: /explore a demo first/i }).getAttribute('href')).toBe('/demo')
  })

  it('on signup, the secondary link returns the user to login', async () => {
    await act(async () => { render(React.createElement(AuthForm, { mode: 'signup' })) })
    expect(screen.getByRole('link', { name: /log in instead/i }).getAttribute('href')).toBe('/login')
  })
})

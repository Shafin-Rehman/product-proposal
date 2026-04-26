/** @jest-environment jsdom */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) =>
    require('react').createElement('a', { href, ...props }, children),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}))

jest.mock('@/components/providers', () => ({
  useTheme: jest.fn(() => ({ theme: 'light', setTheme: jest.fn() })),
}))

const React = require('react')
const { render, screen, fireEvent, waitFor, act } = require('@testing-library/react')
const ResetPasswordForm = require('@/components/reset-password-form').default

function setLocationHash(hash, search = '') {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: {
      hash,
      search,
      pathname: '/reset-password',
      href: `http://localhost/reset-password${search}${hash}`,
    },
  })
  Object.defineProperty(window, 'history', {
    writable: true,
    value: { replaceState: jest.fn() },
  })
}

beforeEach(() => {
  global.fetch = jest.fn()
  setLocationHash('')
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('ResetPasswordForm — invalid / missing token', () => {
  it('shows the expired state when hash is empty', async () => {
    setLocationHash('')
    await act(async () => { render(React.createElement(ResetPasswordForm)) })
    expect(screen.getByRole('heading', { name: /link expired/i })).toBeTruthy()
    expect(screen.queryByPlaceholderText(/at least 6 characters/i)).toBeNull()
  })

  it('shows the expired state when type is not recovery', async () => {
    setLocationHash('#access_token=abc&type=signup')
    await act(async () => { render(React.createElement(ResetPasswordForm)) })
    expect(screen.getByRole('heading', { name: /link expired/i })).toBeTruthy()
  })

  it('shows the expired state when access_token is missing', async () => {
    setLocationHash('#type=recovery')
    await act(async () => { render(React.createElement(ResetPasswordForm)) })
    expect(screen.getByRole('heading', { name: /link expired/i })).toBeTruthy()
  })

  it('shows the expired state when ?code= is present (PKCE link)', async () => {
    setLocationHash('', '?code=some-pkce-code')
    await act(async () => { render(React.createElement(ResetPasswordForm)) })
    expect(screen.getByRole('heading', { name: /link expired/i })).toBeTruthy()
  })

})

describe('ResetPasswordForm — valid token, form interactions', () => {
  beforeEach(() => {
    setLocationHash('#access_token=tok-abc&refresh_token=ref-xyz&type=recovery')
  })

  it('renders the password form when token is valid', async () => {
    await act(async () => { render(React.createElement(ResetPasswordForm)) })
    expect(screen.getByRole('heading', { name: /choose a password/i })).toBeTruthy()
    expect(screen.getByPlaceholderText(/at least 6 characters/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/re-enter/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /set new password/i })).toBeTruthy()
  })

  it('shows an error when passwords do not match', async () => {
    await act(async () => { render(React.createElement(ResetPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), {
      target: { value: 'password1' },
    })
    fireEvent.change(screen.getByPlaceholderText(/re-enter/i), {
      target: { value: 'password2' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /set new password/i }).closest('form'))
    })

    expect(screen.getByRole('alert').textContent).toMatch(/do not match/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows an error when password is too short', async () => {
    await act(async () => { render(React.createElement(ResetPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), {
      target: { value: 'abc' },
    })
    fireEvent.change(screen.getByPlaceholderText(/re-enter/i), {
      target: { value: 'abc' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /set new password/i }).closest('form'))
    })

    expect(screen.getByRole('alert').textContent).toMatch(/at least 6 characters/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows success state after a successful submission', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Password updated successfully' }),
    })

    await act(async () => { render(React.createElement(ResetPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText(/re-enter/i), {
      target: { value: 'newpass123' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /set new password/i }).closest('form'))
    })

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/password updated/i)
    })

    expect(screen.getByRole('heading', { name: /all set/i })).toBeTruthy()
  })

  it('sends the correct payload to the API', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Password updated successfully' }),
    })

    await act(async () => { render(React.createElement(ResetPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), {
      target: { value: 'securepass' },
    })
    fireEvent.change(screen.getByPlaceholderText(/re-enter/i), {
      target: { value: 'securepass' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /set new password/i }).closest('form'))
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/password-reset/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          access_token: 'tok-abc',
          refresh_token: 'ref-xyz',
          password: 'securepass',
        }),
      }),
    )
  })

  it('shows an error when the API returns a non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Reset link is invalid or has already been used.' }),
    })

    await act(async () => { render(React.createElement(ResetPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText(/re-enter/i), {
      target: { value: 'newpass123' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /set new password/i }).closest('form'))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/invalid or has already been used/i)
    })
  })

  it('shows a generic error when fetch throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'))

    await act(async () => { render(React.createElement(ResetPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByPlaceholderText(/re-enter/i), {
      target: { value: 'newpass123' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /set new password/i }).closest('form'))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/something went wrong/i)
    })
  })

})

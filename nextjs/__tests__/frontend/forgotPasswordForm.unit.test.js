/** @jest-environment jsdom */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) =>
    require('react').createElement('a', { href, ...props }, children),
}))

jest.mock('@/components/providers', () => ({
  useTheme: jest.fn(() => ({ theme: 'light', setTheme: jest.fn() })),
}))

const React = require('react')
const { render, screen, fireEvent, waitFor, act } = require('@testing-library/react')
const ForgotPasswordForm = require('@/components/forgot-password-form').default

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('ForgotPasswordForm — idle state', () => {
  it('renders the email form with the correct heading', async () => {
    await act(async () => { render(React.createElement(ForgotPasswordForm)) })
    expect(screen.getByRole('heading', { name: /can't remember your password/i })).toBeTruthy()
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeTruthy()
  })

  it('renders a back-to-login link', async () => {
    await act(async () => { render(React.createElement(ForgotPasswordForm)) })
    const link = screen.getByRole('link', { name: /log in/i })
    expect(link.getAttribute('href')).toBe('/login')
  })

  it('renders an explore-demo link pointing to /demo', async () => {
    await act(async () => { render(React.createElement(ForgotPasswordForm)) })
    const link = screen.getByRole('link', { name: /explore a demo first/i })
    expect(link.getAttribute('href')).toBe('/demo')
  })
})

describe('ForgotPasswordForm — form submission', () => {
  it('sends the email to POST /api/password-reset', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Password reset email sent' }),
    })

    await act(async () => { render(React.createElement(ForgotPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: 'user@example.com' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form'))
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/password-reset',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    )
  })

  it('shows the success state after a successful submission', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Password reset email sent' }),
    })

    await act(async () => { render(React.createElement(ForgotPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: 'user@example.com' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form'))
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /check your inbox/i })).toBeTruthy()
    })

    expect(screen.getByRole('status').textContent).toMatch(/reset link sent/i)
    expect(screen.queryByRole('button', { name: /send reset link/i })).toBeNull()
  })

  it('shows an error when the API returns a non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'email is required' }),
    })

    await act(async () => { render(React.createElement(ForgotPasswordForm)) })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form'))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/email is required/i)
    })
  })

  it('shows a generic error when fetch throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'))

    await act(async () => { render(React.createElement(ForgotPasswordForm)) })

    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), {
      target: { value: 'user@example.com' },
    })

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /send reset link/i }).closest('form'))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/something went wrong/i)
    })
  })
})

describe('ForgotPasswordForm — additional edge cases', () => {
  it('theme toggle buttons call setTheme', async () => {
    const mockSetTheme = jest.fn()
    const { useTheme } = require('@/components/providers')
    useTheme.mockReturnValueOnce({ theme: 'light', setTheme: mockSetTheme })

    await act(async () => { render(React.createElement(ForgotPasswordForm)) })

    fireEvent.click(screen.getByRole('button', { name: /dark/i }))
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

})

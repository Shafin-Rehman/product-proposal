/** @jest-environment jsdom */

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(() => ({ session: { accessToken: 'test-access-token' } })),
}))

const React = require('react')
const { render, screen, fireEvent, waitFor, act } = require('@testing-library/react')
const ChangeEmailForm = require('@/components/change-email-form').default

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.clearAllMocks()
})

async function openForm(props = {}) {
  await act(async () => { render(React.createElement(ChangeEmailForm, props)) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /change email/i })) })
}

it('renders the Change email button and no modal when closed', async () => {
  await act(async () => { render(React.createElement(ChangeEmailForm)) })
  expect(screen.getByRole('button', { name: /change email/i })).toBeTruthy()
  expect(screen.queryByPlaceholderText(/you@example\.com/i)).toBeNull()
})

it('opens modal on click and Cancel closes it', async () => {
  await openForm()
  expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^cancel$/i })) })
  expect(screen.queryByPlaceholderText(/you@example\.com/i)).toBeNull()
})

it('successful submit shows "Email updated" and calls onSuccess with new email', async () => {
  const onSuccess = jest.fn()
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'new@example.com' }) })
  await openForm({ onSuccess })

  fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'new@example.com' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update email/i }).closest('form'))
  })

  await waitFor(() => expect(screen.getByText(/email updated/i)).toBeTruthy())
  expect(onSuccess).toHaveBeenCalledWith('new@example.com')
  expect(screen.queryByRole('button', { name: /update email/i })).toBeNull()
  expect(screen.getByRole('button', { name: /done/i })).toBeTruthy()
})

it('shows API error message when response is not ok', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Email rate limit exceeded' }) })
  await openForm()

  fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'new@example.com' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update email/i }).closest('form'))
  })

  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/email rate limit exceeded/i))
  expect(screen.getByRole('button', { name: /update email/i })).toBeTruthy()
})

it('sends correct payload to POST /api/change-email', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'new@example.com' }) })
  await openForm()

  fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'new@example.com' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update email/i }).closest('form'))
  })

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/change-email',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ access_token: 'test-access-token', new_email: 'new@example.com' }),
    }),
  )
})

it('disables the Change email button when there is no access token', async () => {
  const { useAuth } = require('@/components/providers')
  useAuth.mockReturnValue({ session: null })
  await act(async () => { render(React.createElement(ChangeEmailForm)) })
  expect(screen.getByRole('button', { name: /change email/i }).disabled).toBe(true)
})



/** @jest-environment jsdom */

jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(() => ({ session: { accessToken: 'test-access-token' } })),
}))

const React = require('react')
const { render, screen, fireEvent, waitFor, act } = require('@testing-library/react')
const ChangePasswordForm = require('@/components/change-password-form').default

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.clearAllMocks()
})

async function openForm() {
  await act(async () => { render(React.createElement(ChangePasswordForm)) })
  fireEvent.click(screen.getByRole('button', { name: /change password/i }))
}

it('renders trigger button; clicking it shows all form fields', async () => {
  await openForm()
  expect(screen.getByPlaceholderText(/enter current password/i)).toBeTruthy()
  expect(screen.getByPlaceholderText(/at least 6 characters/i)).toBeTruthy()
  expect(screen.getByPlaceholderText(/re-enter new password/i)).toBeTruthy()
})

it('Cancel closes the popup', async () => {
  await openForm()
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
  expect(screen.queryByPlaceholderText(/enter current password/i)).toBeNull()
  expect(screen.getByRole('button', { name: /change password/i })).toBeTruthy()
})

it('shows error when passwords do not match', async () => {
  await openForm()
  fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass1' } })
  fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass2' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
  })
  expect(screen.getByRole('alert').textContent).toMatch(/do not match/i)
  expect(global.fetch).not.toHaveBeenCalled()
})

it('shows error when new password is too short', async () => {
  await openForm()
  fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'abc' } })
  fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'abc' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
  })
  expect(screen.getByRole('alert').textContent).toMatch(/at least 6 characters/i)
  expect(global.fetch).not.toHaveBeenCalled()
})

it('sends correct payload and shows success state with Done button', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Password changed successfully' }) })
  await openForm()
  fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'current123' } })
  fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass456' } })
  fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass456' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
  })

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/change-password',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ access_token: 'test-access-token', current_password: 'current123', new_password: 'newpass456' }),
    }),
  )
  await waitFor(() => { expect(screen.getByText(/password updated/i)).toBeTruthy() })
  expect(screen.getByRole('button', { name: /done/i })).toBeTruthy()
})

it('Done button closes the popup', async () => {
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Password changed successfully' }) })
  await openForm()
  fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'current123' } })
  fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass456' } })
  fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass456' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
  })
  await waitFor(() => screen.getByRole('button', { name: /done/i }))
  fireEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(screen.queryByPlaceholderText(/enter current password/i)).toBeNull()
  expect(screen.getByRole('button', { name: /change password/i })).toBeTruthy()
})

it('shows API error when response is not ok', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Current password is incorrect.' }) })
  await openForm()
  fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'wrong' } })
  fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass456' } })
  fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass456' } })
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
  })
  await waitFor(() => {
    expect(screen.getByRole('alert').textContent).toMatch(/current password is incorrect/i)
  })
})

it('disables the Change password button when there is no access token', async () => {
  const { useAuth } = require('@/components/providers')
  useAuth.mockReturnValue({ session: null })
  await act(async () => { render(React.createElement(ChangePasswordForm)) })
  expect(screen.getByRole('button', { name: /change password/i }).disabled).toBe(true)
})



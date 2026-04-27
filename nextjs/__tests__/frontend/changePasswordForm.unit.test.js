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

describe('ChangePasswordForm — closed state', () => {
  it('renders the Change password button by default', async () => {
    await act(async () => { render(React.createElement(ChangePasswordForm)) })
    expect(screen.getByRole('button', { name: /change password/i })).toBeTruthy()
  })

})

describe('ChangePasswordForm — open state', () => {
  async function openForm() {
    await act(async () => { render(React.createElement(ChangePasswordForm)) })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
  }

  it('shows the form fields when Change password is clicked', async () => {
    await openForm()
    expect(screen.getByPlaceholderText(/enter current password/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/at least 6 characters/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/re-enter new password/i)).toBeTruthy()
  })

  it('Cancel closes the popup and returns to the row', async () => {
    await openForm()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/enter current password/i)).toBeNull()
    expect(screen.getByRole('button', { name: /change password/i })).toBeTruthy()
  })

  it('Escape key closes the popup', async () => {
    await openForm()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByPlaceholderText(/enter current password/i)).toBeNull()
  })

})

describe('ChangePasswordForm — validation', () => {
  async function openForm() {
    await act(async () => { render(React.createElement(ChangePasswordForm)) })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
  }

  it('shows an error when new passwords do not match', async () => {
    await openForm()
    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass1' } })
    fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass2' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
    })
    expect(screen.getByRole('alert').textContent).toMatch(/do not match/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows an error when new password is too short', async () => {
    await openForm()
    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'abc' } })
    fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'abc' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
    })
    expect(screen.getByRole('alert').textContent).toMatch(/at least 6 characters/i)
    expect(global.fetch).not.toHaveBeenCalled()
  })

})

describe('ChangePasswordForm — submission', () => {
  async function openForm() {
    await act(async () => { render(React.createElement(ChangePasswordForm)) })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
  }

  it('sends the correct payload to POST /api/change-password', async () => {
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
  })

  it('shows success state and Done button after successful submission', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Password changed successfully' }) })
    await openForm()
    fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'current123' } })
    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass456' } })
    fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass456' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
    })
    await waitFor(() => { expect(screen.getByText(/password updated/i)).toBeTruthy() })
    expect(screen.queryByRole('button', { name: /update password/i })).toBeNull()
    expect(screen.getByRole('button', { name: /done/i })).toBeTruthy()
  })

  it('Done button closes the popup and resets to idle', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Password changed successfully' }) })
    await openForm()
    fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'current123' } })
    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass456' } })
    fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass456' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
    })
    await waitFor(() => { expect(screen.getByRole('button', { name: /done/i })).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(screen.queryByPlaceholderText(/enter current password/i)).toBeNull()
    expect(screen.getByRole('button', { name: /change password/i })).toBeTruthy()
  })

  it('shows error from API when response is not ok', async () => {
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
    expect(screen.getByRole('button', { name: /update password/i })).toBeTruthy()
  })

  it('shows generic error when fetch throws', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'))
    await openForm()
    fireEvent.change(screen.getByPlaceholderText(/enter current password/i), { target: { value: 'current123' } })
    fireEvent.change(screen.getByPlaceholderText(/at least 6 characters/i), { target: { value: 'newpass456' } })
    fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'newpass456' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /update password/i }).closest('form'))
    })
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/something went wrong/i)
    })
  })

})

describe('ChangePasswordForm — no session', () => {
  it('disables the Change password opener button when there is no access token', async () => {
    const { useAuth } = require('@/components/providers')
    useAuth.mockReturnValueOnce({ session: null })
    await act(async () => { render(React.createElement(ChangePasswordForm)) })
    expect(screen.getByRole('button', { name: /change password/i }).disabled).toBe(true)
  })

  it('disables the submit button inside the popup when there is no access token', async () => {
    const { useAuth } = require('@/components/providers')
    // First call: opener render — session present so button enabled and popup opens
    // Second call: re-render after open — no session
    useAuth
      .mockReturnValueOnce({ session: { accessToken: 'tok' } })
      .mockReturnValueOnce({ session: null })
    await act(async () => { render(React.createElement(ChangePasswordForm)) })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: /update password/i }).disabled).toBe(true)
  })
})

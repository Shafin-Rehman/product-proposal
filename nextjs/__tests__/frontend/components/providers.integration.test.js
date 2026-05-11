/** @jest-environment jsdom */

const mockWriteSession = jest.fn((args) => args)
const mockReadSession  = jest.fn()
const mockClearSession = jest.fn()

jest.mock('@/lib/session', () => ({
  readSession:  mockReadSession,
  writeSession: mockWriteSession,
  clearSession: mockClearSession,
}))

const React           = require('react')
const { renderHook, act } = require('@testing-library/react')
const { AuthProvider, useAuth } = require('@/components/providers')

const wrapper = ({ children }) => React.createElement(AuthProvider, null, children)

const SEED_SESSION = { accessToken: 'tok', user: { id: 'u1', email: 'original@example.com' } }

beforeEach(() => {
  jest.clearAllMocks()
  mockReadSession.mockReturnValue(SEED_SESSION)
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ name: null, email: 'original@example.com' }),
  })
})

afterEach(() => {
  delete global.fetch
})

async function mountAndSettle() {
  const result = renderHook(() => useAuth(), { wrapper })
  await act(async () => {})
  return result
}

describe('updateEmail', () => {
  it('immediately reflects the new email in user without a server round-trip', async () => {
    const { result } = await mountAndSettle()

    expect(result.current.user.email).toBe('original@example.com')

    await act(async () => {
      result.current.updateEmail('changed@example.com')
    })

    expect(result.current.user.email).toBe('changed@example.com')
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/profile'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('persists the updated email to storage', async () => {
    const { result } = await mountAndSettle()
    mockWriteSession.mockClear()

    await act(async () => {
      result.current.updateEmail('stored@example.com')
    })

    expect(mockWriteSession).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ email: 'stored@example.com' }),
      }),
    )
  })

  it('is idempotent — does not trigger a re-write when email is the same', async () => {
    const { result } = await mountAndSettle()
    mockWriteSession.mockClear()

    await act(async () => {
      result.current.updateEmail('original@example.com') // same as current
    })

    expect(mockWriteSession).not.toHaveBeenCalled()
  })

  it('does nothing when called with a falsy value', async () => {
    const { result } = await mountAndSettle()
    const before = result.current.user.email

    await act(async () => { result.current.updateEmail('') })
    await act(async () => { result.current.updateEmail(null) })
    await act(async () => { result.current.updateEmail(undefined) })

    expect(result.current.user.email).toBe(before)
  })
})

describe('refreshProfile', () => {
  it('updates user.email when /api/profile returns a different email', async () => {
    const { result } = await mountAndSettle()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'Alice', email: 'server-fresh@example.com' }),
    })

    await act(async () => {
      result.current.refreshProfile()
    })

    expect(result.current.user.email).toBe('server-fresh@example.com')
    expect(result.current.profileName).toBe('Alice')
  })

  it('updates profileName even when email has not changed', async () => {
    const { result } = await mountAndSettle()

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'New Name', email: 'original@example.com' }),
    })

    await act(async () => {
      result.current.refreshProfile()
    })

    expect(result.current.profileName).toBe('New Name')
    expect(result.current.user.email).toBe('original@example.com') // unchanged
  })

  it('silently does nothing when server responds with a non-ok status', async () => {
    const { result } = await mountAndSettle()
    const emailBefore = result.current.user.email

    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) })

    await act(async () => {
      result.current.refreshProfile()
    })

    expect(result.current.user.email).toBe(emailBefore)
  })

  it('silently does nothing when fetch rejects (network error)', async () => {
    const { result } = await mountAndSettle()
    const emailBefore = result.current.user.email

    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))

    await act(async () => {
      result.current.refreshProfile()
    })

    expect(result.current.user.email).toBe(emailBefore)
  })
})

describe('updateProfileName', () => {
  it('updates profileName directly in context without a server call', async () => {
    const { result } = await mountAndSettle()
    global.fetch.mockClear()

    await act(async () => {
      result.current.updateProfileName('Direct Name')
    })

    expect(result.current.profileName).toBe('Direct Name')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('coerces null/undefined to an empty string', async () => {
    const { result } = await mountAndSettle()

    await act(async () => { result.current.updateProfileName(null) })
    expect(result.current.profileName).toBe('')

    await act(async () => { result.current.updateProfileName(undefined) })
    expect(result.current.profileName).toBe('')
  })
})

describe('logout', () => {
  it('clears session, user, and profileName', async () => {
    const { result } = await mountAndSettle()

    await act(async () => { result.current.updateProfileName('Alice') })
    expect(result.current.profileName).toBe('Alice')
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => { result.current.logout() })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.profileName).toBe('')
    expect(mockClearSession).toHaveBeenCalled()
  })
})

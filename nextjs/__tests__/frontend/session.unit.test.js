const { readSession, writeSession, clearSession } = require('@/lib/session')

const SESSION_KEY = 'budgetbuddy.session'

let store = {}

beforeEach(() => {
  store = {}
  global.window = {
    localStorage: {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => { store[key] = String(value) },
      removeItem: (key) => { delete store[key] },
    },
  }
})

afterEach(() => {
  delete global.window
})

describe('readSession', () => {
  it('returns null when nothing is stored', () => {
    expect(readSession()).toBeNull()
  })

  it('returns the session for valid stored data', () => {
    store[SESSION_KEY] = JSON.stringify({ accessToken: 'tok-123', user: { id: 'u1', email: 'a@b.com' } })
    const session = readSession()
    expect(session.accessToken).toBe('tok-123')
    expect(session.user).toEqual({ id: 'u1', email: 'a@b.com' })
  })
})

describe('writeSession', () => {
  it('returns null when required fields are missing', () => {
    expect(writeSession({ accessToken: '', user: { id: 'u1', email: 'a@b.com' } })).toBeNull()
  })

  it('persists the session and returns it', () => {
    const result = writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
    expect(result.accessToken).toBe('tok-abc')
    expect(JSON.parse(store[SESSION_KEY]).user.id).toBe('u1')
  })
})

describe('clearSession', () => {
  it('removes a stored session', () => {
    store[SESSION_KEY] = JSON.stringify({ accessToken: 'tok', user: { id: 'u1', email: 'a@b.com' } })
    clearSession()
    expect(store[SESSION_KEY]).toBeUndefined()
  })

  it('does not throw when nothing is stored', () => {
    expect(() => clearSession()).not.toThrow()
  })
})

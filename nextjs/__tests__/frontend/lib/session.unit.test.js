const { SESSION_STORAGE_KEY, readSession, writeSession, clearSession } = require('@/lib/session')

let store = {}

describe('session specification', () => {
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
    it('returns null outside the browser', () => {
      delete global.window

      expect(readSession()).toBeNull()
    })

    it('returns null when nothing is stored', () => {
      expect(readSession()).toBeNull()
    })

    it('returns null and removes the key when stored JSON is malformed', () => {
      store[SESSION_STORAGE_KEY] = '{not-json'

      expect(readSession()).toBeNull()
      expect(store[SESSION_STORAGE_KEY]).toBeUndefined()
    })

    it('returns null and removes the key when required fields are missing', () => {
      store[SESSION_STORAGE_KEY] = JSON.stringify({ accessToken: 'tok-123', user: { id: 'u1' } })

      expect(readSession()).toBeNull()
      expect(store[SESSION_STORAGE_KEY]).toBeUndefined()
    })

    it('returns the session for valid stored data', () => {
      store[SESSION_STORAGE_KEY] = JSON.stringify({ accessToken: 'tok-123', user: { id: 'u1', email: 'a@b.com' } })
      const session = readSession()
      expect(session.accessToken).toBe('tok-123')
      expect(session.user).toEqual({ id: 'u1', email: 'a@b.com' })
    })

    it('reads a valid session written after a previous malformed entry was cleared', () => {
      store[SESSION_STORAGE_KEY] = '{not-json'
      readSession()
      store[SESSION_STORAGE_KEY] = JSON.stringify({ accessToken: 'tok-next', user: { id: 'u2', email: 'next@example.com' } })

      expect(readSession()).toEqual({ accessToken: 'tok-next', user: { id: 'u2', email: 'next@example.com' } })
    })
  })

  describe('writeSession', () => {
    it('returns null outside the browser', () => {
      delete global.window

      expect(writeSession({ accessToken: 'tok-123', user: { id: 'u1', email: 'a@b.com' } })).toBeNull()
    })

    it('returns null when accessToken is empty', () => {
      expect(writeSession({ accessToken: '', user: { id: 'u1', email: 'a@b.com' } })).toBeNull()
    })

    it('returns null when user email is missing', () => {
      expect(writeSession({ accessToken: 'tok-123', user: { id: 'u1' } })).toBeNull()
    })

    it('persists the session and returns it', () => {
      const result = writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
      expect(result.accessToken).toBe('tok-abc')
      expect(JSON.parse(store[SESSION_STORAGE_KEY]).user.id).toBe('u1')
    })
  })

  describe('clearSession', () => {
    it('does not throw outside the browser', () => {
      delete global.window

      expect(() => clearSession()).not.toThrow()
    })

    it('removes a stored session', () => {
      store[SESSION_STORAGE_KEY] = JSON.stringify({ accessToken: 'tok', user: { id: 'u1', email: 'a@b.com' } })
      clearSession()
      expect(store[SESSION_STORAGE_KEY]).toBeUndefined()
    })

    it('does not throw when nothing is stored', () => {
      expect(() => clearSession()).not.toThrow()
    })
  })
})

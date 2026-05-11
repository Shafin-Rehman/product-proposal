const { readSession, writeSession, clearSession } = require('@/lib/session')
const { apiGet, apiPost, apiDelete } = require('@/lib/apiClient')

const SESSION_KEY = 'budgetbuddy.session'

let store = {}

describe('apiClient specification', () => {
  beforeEach(() => {
    store = {}
    global.window = {
      localStorage: {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => { store[key] = String(value) },
        removeItem: (key) => { delete store[key] },
      },
    }
    global.fetch = jest.fn()
  })

  afterEach(() => {
    delete global.window
    delete global.fetch
  })

  describe('session → apiGet', () => {
    it('throws ApiError on a non-ok response using the server error when present', async () => {
      writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
      const { accessToken } = readSession()
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: jest.fn().mockResolvedValueOnce({ error: 'Upstream unavailable' }),
      })

      await expect(apiGet('/api/health', { accessToken })).rejects.toMatchObject({
        name: 'ApiError',
        status: 503,
        message: 'Upstream unavailable',
      })
    })

    it('token written by writeSession is forwarded as the Authorization header', async () => {
      writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
      const { accessToken } = readSession()
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ expenses: [] }),
      })

      const result = await apiGet('/api/expenses', { accessToken })

      expect(result).toEqual({ expenses: [] })
      expect(global.fetch).toHaveBeenCalledWith('/api/expenses', expect.objectContaining({
        headers: { authorization: 'Bearer tok-abc' },
      }))
    })

    it('rejects with 401 when the session was cleared before the request', async () => {
      writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
      clearSession()
      const session = readSession()

      expect(session).toBeNull()
      await expect(apiGet('/api/expenses', { accessToken: session?.accessToken }))
        .rejects.toMatchObject({ name: 'ApiError', status: 401 })
    })
  })

  describe('session → apiPost', () => {
    it('token written by writeSession is forwarded on POST and the response is returned', async () => {
      writeSession({ accessToken: 'tok-xyz', user: { id: 'u1', email: 'a@b.com' } })
      const { accessToken } = readSession()
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValueOnce({ id: 'e1', amount: '50.00' }),
      })

      const result = await apiPost('/api/expenses', { amount: 50, description: 'Coffee' }, { accessToken })

      expect(result).toEqual({ id: 'e1', amount: '50.00' })
      expect(global.fetch).toHaveBeenCalledWith('/api/expenses', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer tok-xyz' }),
      }))
    })

    it('throws ApiError with the server status and message on a non-2xx response', async () => {
      writeSession({ accessToken: 'tok-xyz', user: { id: 'u1', email: 'a@b.com' } })
      const { accessToken } = readSession()
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: jest.fn().mockResolvedValueOnce({ error: 'Validation failed' }),
      })

      await expect(apiPost('/api/expenses', {}, { accessToken }))
        .rejects.toMatchObject({ name: 'ApiError', status: 422, message: 'Validation failed' })
    })
  })

  describe('session → apiDelete', () => {
    it('rejects with 401 when no access token is provided', async () => {
      await expect(apiDelete('/api/expenses/delete?id=1', { accessToken: '' }))
        .rejects.toMatchObject({ name: 'ApiError', status: 401, message: 'Missing access token' })
    })

    it('returns undefined for a 204 response without parsing JSON', async () => {
      writeSession({ accessToken: 'tok-del', user: { id: 'u1', email: 'a@b.com' } })
      const { accessToken } = readSession()
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: jest.fn(),
      })

      const result = await apiDelete('/api/expenses/delete?id=e1', { accessToken })

      expect(result).toBeNull()
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/expenses/delete?id=e1',
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(global.fetch.mock.calls[0][1].headers.authorization).toBe('Bearer tok-del')
    })

    it('throws ApiError when the server rejects the delete', async () => {
      writeSession({ accessToken: 'tok-del', user: { id: 'u1', email: 'a@b.com' } })
      const { accessToken } = readSession()
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn().mockResolvedValueOnce({ error: 'Expense is locked' }),
      })

      await expect(apiDelete('/api/expenses/delete?id=e1', { accessToken })).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
        message: 'Expense is locked',
      })
    })
  })
})

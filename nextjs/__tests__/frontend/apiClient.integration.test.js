const { readSession, writeSession, clearSession } = require('@/lib/session')
const { apiGet, apiPost } = require('@/lib/apiClient')

const SESSION_KEY = 'budgetbuddy.session'

let store = {}

beforeEach(() => {
  store = {}
  global.window = {
    location: {
      pathname: '/',
      replace: jest.fn()
    },
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
  it('token written by writeSession is usable in apiGet', async () => {
    writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
    const { accessToken } = readSession()
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ expenses: [] }),
    })
    const result = await apiGet('/api/expenses', { accessToken })
    expect(result).toEqual({ expenses: [] })
    expect(global.fetch).toHaveBeenCalledWith('/api/expenses', expect.objectContaining({
      headers: { authorization: `Bearer tok-abc` },
    }))
  })

  it('cleared session produces a null token which apiGet rejects with 401', async () => {
    writeSession({ accessToken: 'tok-abc', user: { id: 'u1', email: 'a@b.com' } })
    clearSession()
    const session = readSession()
    expect(session).toBeNull()
    await expect(apiGet('/api/expenses', { accessToken: session?.accessToken }))
      .rejects.toMatchObject({ name: 'ApiError', status: 401 })
  })
})

describe('session → apiPost', () => {
  it('token written by writeSession is usable in apiPost', async () => {
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
      headers: expect.objectContaining({ authorization: `Bearer tok-xyz` }),
    }))
  })

  it('apiPost throws ApiError when the server responds with an error', async () => {
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

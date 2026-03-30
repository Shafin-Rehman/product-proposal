const { ApiError, apiGet } = require('@/lib/apiClient')

describe('apiGet', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('attaches the bearer token and returns parsed json', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ ok: true }),
    })

    await expect(apiGet('/api/test', { accessToken: 'token-123' })).resolves.toEqual({ ok: true })
    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      headers: {
        authorization: 'Bearer token-123',
      },
    }))
  })

  it('throws an ApiError with the response status and body error message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValueOnce({ error: 'Backend failed' }),
    })

    await expect(apiGet('/api/test', { accessToken: 'token-123' })).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      status: 500,
      message: 'Backend failed',
    }))
  })

  it('throws a 401 ApiError when the access token is missing', async () => {
    await expect(apiGet('/api/test')).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      status: 401,
      message: 'Missing access token',
    }))
  })

  it('falls back to a generic request error when json parsing fails', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: jest.fn().mockRejectedValueOnce(new Error('bad json')),
    })

    await expect(apiGet('/api/test', { accessToken: 'token-123' })).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      status: 502,
      message: 'Request failed',
    }))
  })

  it('exposes the ApiError class for callers that need status-aware handling', () => {
    const error = new ApiError('Boom', { status: 418, body: { error: 'Boom' } })

    expect(error.status).toBe(418)
    expect(error.body).toEqual({ error: 'Boom' })
  })
})

const { ApiError, apiDelete, apiGet, apiPost } = require('@/lib/apiClient')

const originalFetch = global.fetch

describe('apiClient specification', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('ApiError', () => {
    it('carries status and body for typed error handling', () => {
      const error = new ApiError('Boom', { status: 418, body: { error: 'Boom' } })

      expect(error).toMatchObject({
        name: 'ApiError',
        status: 418,
        body: { error: 'Boom' },
      })
    })
  })

  describe('apiGet', () => {
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

    it('passes AbortSignal through to fetch when provided', async () => {
      const controller = new AbortController()
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({}),
      })

      await apiGet('/api/test', { accessToken: 'token-123', signal: controller.signal })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ signal: controller.signal }),
      )
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
  })

  describe('apiDelete', () => {
    it('sends authenticated DELETE requests and returns parsed json', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ cleared: true }),
      })

      await expect(apiDelete('/api/test?item=1', { accessToken: 'token-123' })).resolves.toEqual({ cleared: true })

      expect(global.fetch).toHaveBeenCalledWith('/api/test?item=1', expect.objectContaining({
        method: 'DELETE',
        cache: 'no-store',
        headers: {
          authorization: 'Bearer token-123',
        },
      }))
    })

    it('throws a 401 ApiError when deleting without an access token', async () => {
      await expect(apiDelete('/api/test')).rejects.toEqual(expect.objectContaining({
        name: 'ApiError',
        status: 401,
        message: 'Missing access token',
      }))
    })

    it('treats HTTP 204 as success with null body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: jest.fn(),
      })

      await expect(apiDelete('/api/x', { accessToken: 't' })).resolves.toBeNull()
    })
  })

  describe('apiPost', () => {
    it('serializes JSON and returns parsed body on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ id: '1' }),
      })

      const body = { a: 1 }
      await expect(apiPost('/api/x', body, { accessToken: 'tok' })).resolves.toEqual({ id: '1' })

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/x',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            authorization: 'Bearer tok',
            'content-type': 'application/json',
          }),
          body: JSON.stringify(body),
        }),
      )
    })

    it('treats HTTP 204 as success with null body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: jest.fn(),
      })

      await expect(apiPost('/api/x', {}, { accessToken: 't' })).resolves.toBeNull()
    })

    it('throws 401 when access token is missing', async () => {
      await expect(apiPost('/api/x', {})).rejects.toEqual(expect.objectContaining({
        name: 'ApiError',
        status: 401,
        message: 'Missing access token',
      }))
    })
  })
})

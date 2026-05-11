jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}))

const mockGetUser = jest.fn()

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}))

const db = require('@/lib/db').default
const { getSupabaseClient } = require('@/lib/supabaseClient')
const { authenticate } = require('@/lib/auth')

describe('auth specification', () => {
  describe('authenticate', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('returns 401 when the Authorization header is missing', async () => {
      const request = new Request('http://localhost/api', { method: 'GET' })
      const result = await authenticate(request)

      expect(result.user).toBeUndefined()
      expect(result.error.status).toBe(401)
      expect(getSupabaseClient).not.toHaveBeenCalled()
    })

    it('returns 401 when the header is not a Bearer token', async () => {
      const request = new Request('http://localhost/api', {
        headers: { authorization: 'Basic x' },
      })
      const result = await authenticate(request)

      expect(result.error.status).toBe(401)
      expect(getSupabaseClient).not.toHaveBeenCalled()
    })

    it('returns 401 when Supabase rejects the token', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } })
      const request = new Request('http://localhost/api', {
        headers: { authorization: 'Bearer bad-token' },
      })
      const result = await authenticate(request)

      expect(result.error.status).toBe(401)
      expect(mockGetUser).toHaveBeenCalledWith('bad-token')
      expect(db.query).not.toHaveBeenCalled()
    })

    it('upserts the user and returns the Supabase profile on success', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'a@example.com' } },
        error: null,
      })
      const request = new Request('http://localhost/api', {
        headers: { authorization: 'Bearer good-token' },
      })
      const result = await authenticate(request)

      expect(result.error).toBeUndefined()
      expect(result.user).toEqual({ id: 'user-1', email: 'a@example.com' })
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.users'),
        ['user-1', 'a@example.com'],
      )
    })
  })
})

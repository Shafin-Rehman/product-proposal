jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { createClient } = require('@supabase/supabase-js')
const sendHandler = require('@/app/api/password-reset/route')
const confirmHandler = require('@/app/api/password-reset/confirm/route')

const post = (body) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('POST /api/password-reset', () => {
  let mockAuth

  beforeEach(() => {
    mockAuth = { resetPasswordForEmail: jest.fn() }
    createClient.mockReturnValue({ auth: mockAuth })
  })

  afterEach(() => jest.clearAllMocks())

  it('400 — missing email', async () => {
    await testApiHandler({
      appHandler: sendHandler,
      async test({ fetch }) {
        const res = await fetch(post({}))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('email is required')
      },
    })
  })

  it('400 — supabase returns an error', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'User not found' } })
    await testApiHandler({
      appHandler: sendHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'no@one.com' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('User not found')
      },
    })
  })

  it('200 — sends reset email with redirectTo pointing to /reset-password', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })
    await testApiHandler({
      appHandler: sendHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'user@example.com' }))
        expect(res.status).toBe(200)
        expect((await res.json()).message).toBe('Password reset email sent')
        const [, options] = mockAuth.resetPasswordForEmail.mock.calls[0]
        expect(options.redirectTo).toContain('/reset-password')
        expect(options.redirectTo).not.toContain('?')
      },
    })
  })

  it('500 — unexpected throw returns 500', async () => {
    mockAuth.resetPasswordForEmail.mockRejectedValueOnce(new Error('network failure'))
    await testApiHandler({
      appHandler: sendHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'user@example.com' }))
        expect(res.status).toBe(500)
      },
    })
  })

  it('redirectTo is derived from request host header, not an env variable', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })
    await testApiHandler({
      appHandler: sendHandler,
      requestPatcher: (req) => {
        req.headers.set('host', 'app.example.com')
        req.headers.set('x-forwarded-proto', 'https')
      },
      async test({ fetch }) {
        await fetch(post({ email: 'user@example.com' }))
        const [, options] = mockAuth.resetPasswordForEmail.mock.calls[0]
        expect(options.redirectTo).toBe('https://app.example.com/reset-password')
      },
    })
  })
})

describe('POST /api/password-reset/confirm', () => {
  let mockSupabase

  beforeEach(() => {
    mockSupabase = {
      auth: {
        setSession: jest.fn(),
        updateUser: jest.fn(),
      },
    }
    createClient.mockReturnValue(mockSupabase)
  })

  afterEach(() => jest.clearAllMocks())

  it('400 — missing access_token', async () => {
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ password: 'newpass123' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/access_token/)
      },
    })
  })

  it('400 — missing password', async () => {
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/password/)
      },
    })
  })

  it('400 — password too short', async () => {
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', password: 'abc' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/6 characters/)
      },
    })
  })

  it('401 — setSession fails (invalid or expired token)', async () => {
    mockSupabase.auth.setSession.mockResolvedValueOnce({ error: { message: 'invalid token' } })
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'bad-tok', password: 'newpass123' }))
        expect(res.status).toBe(401)
        expect((await res.json()).error).toMatch(/invalid or has already been used/i)
      },
    })
  })

  it('400 — updateUser fails', async () => {
    mockSupabase.auth.setSession.mockResolvedValueOnce({ error: null })
    mockSupabase.auth.updateUser.mockResolvedValueOnce({ error: { message: 'Password too weak' } })
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', password: 'newpass123' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Password too weak')
      },
    })
  })

  it('200 — updates password successfully', async () => {
    mockSupabase.auth.setSession.mockResolvedValueOnce({ error: null })
    mockSupabase.auth.updateUser.mockResolvedValueOnce({ error: null })
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', refresh_token: 'ref', password: 'newpass123' }))
        expect(res.status).toBe(200)
        expect((await res.json()).message).toBe('Password updated successfully')
      },
    })
  })

  it('500 — unexpected throw returns 500', async () => {
    mockSupabase.auth.setSession.mockRejectedValueOnce(new Error('unexpected'))
    await testApiHandler({
      appHandler: confirmHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', password: 'newpass123' }))
        expect(res.status).toBe(500)
      },
    })
  })

})

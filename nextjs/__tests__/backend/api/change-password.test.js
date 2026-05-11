jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { createClient } = require('@supabase/supabase-js')
const changePasswordHandler = require('@/app/api/change-password/route')

const post = (body) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('POST /api/change-password', () => {
  let mockSupabase
  let mockVerifyClient

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
    }
    mockVerifyClient = {
      auth: {
        signInWithPassword: jest.fn(),
        updateUser: jest.fn(),
      },
    }
    createClient.mockReset()
    createClient
      .mockReturnValueOnce(mockSupabase)
      .mockReturnValueOnce(mockVerifyClient)
  })

  afterEach(() => jest.clearAllMocks())

  it('400 — missing access_token', async () => {
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ current_password: 'old', new_password: 'newpass123' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/access_token/)
      },
    })
  })

  it('400 — missing current_password', async () => {
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', new_password: 'newpass123' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/current_password/)
      },
    })
  })

  it('400 — missing new_password', async () => {
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'old' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/new_password/)
      },
    })
  })

  it('400 — new_password too short', async () => {
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'old', new_password: 'abc' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/6 characters/)
      },
    })
  })

  it('401 — getUser returns an error (invalid or expired token)', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid token' } })
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'bad-tok', current_password: 'old', new_password: 'newpass123' }))
        expect(res.status).toBe(401)
        expect((await res.json()).error).toMatch(/session has expired/)
      },
    })
  })

  it('401 — getUser returns no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'old', new_password: 'newpass123' }))
        expect(res.status).toBe(401)
        expect((await res.json()).error).toMatch(/session has expired/)
      },
    })
  })

  it('401 — current password is incorrect', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { email: 'user@example.com' } }, error: null })
    mockVerifyClient.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'wrongpass', new_password: 'newpass123' }))
        expect(res.status).toBe(401)
        expect((await res.json()).error).toMatch(/current password is incorrect/i)
      },
    })
  })

  it('400 — updateUser fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { email: 'user@example.com' } }, error: null })
    mockVerifyClient.auth.signInWithPassword.mockResolvedValueOnce({ error: null })
    mockVerifyClient.auth.updateUser.mockResolvedValueOnce({ error: { message: 'Password too weak' } })
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'current123', new_password: 'newpass123' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Password too weak')
      },
    })
  })

  it('200 — changes password successfully', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { email: 'user@example.com' } }, error: null })
    mockVerifyClient.auth.signInWithPassword.mockResolvedValueOnce({ error: null })
    mockVerifyClient.auth.updateUser.mockResolvedValueOnce({ error: null })
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'current123', new_password: 'newpass123' }))
        expect(res.status).toBe(200)
        expect((await res.json()).message).toBe('Password changed successfully')
      },
    })
  })


  it('200 — updateUser is called on verifyClient (uses signIn session)', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { email: 'user@example.com' } }, error: null })
    mockVerifyClient.auth.signInWithPassword.mockResolvedValueOnce({ error: null })
    mockVerifyClient.auth.updateUser.mockResolvedValueOnce({ error: null })
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        await fetch(post({ access_token: 'tok', current_password: 'current123', new_password: 'newpass123' }))
        expect(mockVerifyClient.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' })
      },
    })
  })

  it('500 — unexpected throw returns 500', async () => {
    mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('unexpected'))
    await testApiHandler({
      appHandler: changePasswordHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', current_password: 'old', new_password: 'newpass123' }))
        expect(res.status).toBe(500)
      },
    })
  })

})

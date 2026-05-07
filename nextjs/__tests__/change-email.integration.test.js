jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { createClient } = require('@supabase/supabase-js')
const changeEmailHandler = require('@/app/api/change-email/route')

const post = (body) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('POST /api/change-email', () => {
  let mockAnonClient
  let mockAdminClient
  let mockUsersQuery

  beforeEach(() => {
    mockUsersQuery = { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) }
    mockAnonClient = { auth: { getUser: jest.fn() } }
    mockAdminClient = {
      auth: { admin: { updateUserById: jest.fn() } },
      from: jest.fn(() => mockUsersQuery),
    }
    createClient.mockReset()
    createClient
      .mockReturnValueOnce(mockAnonClient)
      .mockReturnValueOnce(mockAdminClient)
  })

  afterEach(() => jest.clearAllMocks())

  it('400 — missing access_token', async () => {
    await testApiHandler({
      appHandler: changeEmailHandler,
      async test({ fetch }) {
        const res = await fetch(post({ new_email: 'x@x.com' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/access_token/)
      },
    })
  })

  it('400 — invalid email format', async () => {
    await testApiHandler({
      appHandler: changeEmailHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', new_email: 'notanemail' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/valid email/i)
      },
    })
  })

  it('401 — invalid or expired token', async () => {
    mockAnonClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } })
    await testApiHandler({
      appHandler: changeEmailHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'bad', new_email: 'new@example.com' }))
        expect(res.status).toBe(401)
      },
    })
  })

  it('400 — new email is the same as current', async () => {
    mockAnonClient.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'same@example.com' } }, error: null })
    await testApiHandler({
      appHandler: changeEmailHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', new_email: 'same@example.com' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/different/)
      },
    })
  })

  it('200 — updates auth + users table, returns new email (trimmed lowercase)', async () => {
    mockAnonClient.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'uid-1', email: 'old@example.com' } }, error: null })
    mockAdminClient.auth.admin.updateUserById.mockResolvedValueOnce({ error: null })

    await testApiHandler({
      appHandler: changeEmailHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', new_email: '  NEW@Example.COM  ' }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.email).toBe('new@example.com')
        expect(mockAdminClient.auth.admin.updateUserById).toHaveBeenCalledWith('uid-1', { email: 'new@example.com' })
        expect(mockUsersQuery.update).toHaveBeenCalledWith({ email: 'new@example.com' })
        expect(mockUsersQuery.eq).toHaveBeenCalledWith('id', 'uid-1')
      },
    })
  })

  it('400 — Supabase admin error is forwarded', async () => {
    mockAnonClient.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1', email: 'old@example.com' } }, error: null })
    mockAdminClient.auth.admin.updateUserById.mockResolvedValueOnce({ error: { message: 'Email rate limit exceeded' } })
    await testApiHandler({
      appHandler: changeEmailHandler,
      async test({ fetch }) {
        const res = await fetch(post({ access_token: 'tok', new_email: 'new@example.com' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Email rate limit exceeded')
      },
    })
  })
})


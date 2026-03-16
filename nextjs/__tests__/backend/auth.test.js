jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const supabase = require('@/lib/supabaseClient')
const signupHandler = require('@/app/api/signup/route')
const loginHandler = require('@/app/api/login/route')

const user = { id: 'uid', email: 'a@b.com' }
const session = { access_token: 'tok' }
const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => { supabase.signUp.mockClear(); supabase.signIn.mockClear(); db.query.mockClear() })

describe('POST /api/signup', () => {
  it('201 — creates user', async () => {
    supabase.signUp.mockResolvedValueOnce({ data: { user, session }, error: null })
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: signupHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'a@b.com', password: 'pw' }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.access_token).toBe('tok')
        expect(body.user).toMatchObject({ id: 'uid', email: 'a@b.com' })
      }
    })
  })

  it('400 — missing fields', async () => {
    await testApiHandler({
      appHandler: signupHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'a@b.com' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('email and password are required')
      }
    })
  })

})

describe('POST /api/login', () => {
  it('200 — returns token', async () => {
    supabase.signIn.mockResolvedValueOnce({ data: { user, session }, error: null })
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: loginHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'a@b.com', password: 'pw' }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.access_token).toBe('tok')
        expect(body.user).toMatchObject({ id: 'uid', email: 'a@b.com' })
      }
    })
  })

  it('400 — missing fields', async () => {
    await testApiHandler({
      appHandler: loginHandler,
      async test({ fetch }) {
        const res = await fetch(post({ email: 'a@b.com' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('email and password are required')
      }
    })
  })
})

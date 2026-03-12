jest.mock('../db', () => ({ query: jest.fn() }))
jest.mock('../supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('../middleware/auth', () =>
  jest.fn((req, res, next) => { req.user = { id: 'uid', email: 'a@b.com' }; next() })
)

const request = require('supertest')
const app = require('../index')
const supabase = require('../supabaseClient')
const db = require('../db')

beforeEach(() => { supabase.signUp.mockClear(); supabase.signIn.mockClear(); db.query.mockClear() })

const user = { id: 'uid', email: 'a@b.com' }
const session = { access_token: 'tok' }

// POST /signup
describe('POST /signup', () => {
  it('201 — creates user', async () => {
    supabase.signUp.mockResolvedValueOnce({ data: { user, session }, error: null })
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/signup').send({ email: 'a@b.com', password: 'pw' })
    expect(res.status).toBe(201)
    expect(res.body.access_token).toBe('tok')
    expect(res.body.user).toMatchObject({ id: 'uid', email: 'a@b.com' })
  })

  it('400 — missing fields', async () => {
    const res = await request(app).post('/signup').send({ email: 'a@b.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('email and password are required')
  })

  it('400 — supabase error', async () => {
    supabase.signUp.mockResolvedValueOnce({ data: null, error: { message: 'User already registered' } })
    const res = await request(app).post('/signup').send({ email: 'a@b.com', password: 'pw' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('User already registered')
  })

  it('500 — unexpected error', async () => {
    supabase.signUp.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/signup').send({ email: 'a@b.com', password: 'pw' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to sign up user')
  })
})

// POST /login
describe('POST /login', () => {
  it('200 — returns token', async () => {
    supabase.signIn.mockResolvedValueOnce({ data: { user, session }, error: null })
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'pw' })
    expect(res.status).toBe(200)
    expect(res.body.access_token).toBe('tok')
    expect(res.body.user).toMatchObject({ id: 'uid', email: 'a@b.com' })
  })

  it('400 — missing fields', async () => {
    const res = await request(app).post('/login').send({ email: 'a@b.com' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('email and password are required')
  })

  it('401 — invalid credentials', async () => {
    supabase.signIn.mockResolvedValueOnce({ data: null, error: { message: 'Invalid login credentials' } })
    const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'wrong' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid login credentials')
  })

  it('500 — unexpected error', async () => {
    supabase.signIn.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/login').send({ email: 'a@b.com', password: 'pw' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to log in user')
  })
})

jest.mock('../db', () => ({ query: jest.fn() }))
jest.mock('../supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('../middleware/auth', () =>
  jest.fn((req, res, next) => { req.user = { id: 'uid', email: 'a@b.com' }; next() })
)

const request = require('supertest')
const app = require('../index')
const db = require('../db')

beforeEach(() => db.query.mockClear())

describe('POST /income', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', month: '2026-03-01', notes: null, created_at: '2026-03-01T10:00:00Z' }

  it('creates income entry and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await request(app).post('/income').send({ amount: 3000, month: '2026-03-01' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', month: '2026-03-01' })
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('accepts optional source_id and notes', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, notes: 'Bonus included' }] })
    const res = await request(app).post('/income').send({ source_id: 'src-1', amount: 3000, month: '2026-03-01', notes: 'Bonus included' })
    expect(res.status).toBe(201)
    expect(res.body.notes).toBe('Bonus included')
  })

  it('rejects request without amount', async () => {
    const res = await request(app).post('/income').send({ month: '2026-03-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('amount and month are required')
  })

  it('rejects request without month', async () => {
    const res = await request(app).post('/income').send({ amount: 3000 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('amount and month are required')
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/income').send({ amount: 3000, month: '2026-03-01' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to create income')
  })
})

describe('GET /income', () => {
  it('returns all income entries and strips user_id from each', async () => {
    const rows = [
      { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', month: '2026-03-01', notes: null, source_name: 'Salary', source_icon: '💼' },
      { id: 2, user_id: 'uid', source_id: 'src-2', amount: '500.00', month: '2026-02-01', notes: 'Side project', source_name: 'Freelance', source_icon: '💻' },
    ]
    db.query.mockResolvedValueOnce({ rows })
    const res = await request(app).get('/income')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', source_name: 'Salary' })
    expect(res.body[1]).toMatchObject({ id: 2, source_id: 'src-2', notes: 'Side project', source_name: 'Freelance' })
    res.body.forEach(i => expect(i).not.toHaveProperty('user_id'))
  })

  it('returns empty array when user has no income', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/income')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).get('/income')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to fetch income')
  })
})

describe('GET /income/categories', () => {
  it('returns all income categories', async () => {
    const rows = [
      { id: 'src-1', name: 'Salary', icon: '💼' },
      { id: 'src-2', name: 'Freelance', icon: '💻' },
    ]
    db.query.mockResolvedValueOnce({ rows })
    const res = await request(app).get('/income/categories')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({ id: 'src-1', name: 'Salary', icon: '💼' })
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).get('/income/categories')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to fetch income categories')
  })
})

describe('POST /income/get', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', month: '2026-03-01', notes: null, source_name: 'Salary', source_icon: '💼' }

  it('returns income entry and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await request(app).post('/income/get').send({ income_id: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', source_name: 'Salary' })
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('rejects request without income_id', async () => {
    const res = await request(app).post('/income/get').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('income_id required')
  })

  it('returns 404 when income entry does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/income/get').send({ income_id: 999 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Income not found')
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/income/get').send({ income_id: 1 })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to fetch income')
  })
})

describe('POST /income/update', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3500.00', month: '2026-03-01', notes: null }

  it('updates amount and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await request(app).post('/income/update').send({ income_id: 1, amount: 3500 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1, amount: '3500.00' })
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('updates source_id field', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, source_id: 'src-2' }] })
    const res = await request(app).post('/income/update').send({ income_id: 1, source_id: 'src-2' })
    expect(res.status).toBe(200)
    expect(res.body.source_id).toBe('src-2')
  })

  it('updates multiple fields at once', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, notes: 'Raise applied', month: '2026-04-01' }] })
    const res = await request(app).post('/income/update').send({ income_id: 1, notes: 'Raise applied', month: '2026-04-01' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ notes: 'Raise applied', month: '2026-04-01' })
  })

  it('rejects update without income_id', async () => {
    const res = await request(app).post('/income/update').send({ amount: 3500 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('income_id required')
  })

  it('rejects update when no fields are provided', async () => {
    const res = await request(app).post('/income/update').send({ income_id: 1 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('No fields provided to update')
  })

  it('returns 404 when income entry does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/income/update').send({ income_id: 999, amount: 100 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Income not found')
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/income/update').send({ income_id: 1, amount: 100 })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to update income')
  })
})

describe('POST /income/delete', () => {
  it('deletes income entry and returns 204', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    const res = await request(app).post('/income/delete').send({ income_id: 1 })
    expect(res.status).toBe(204)
  })

  it('rejects delete without income_id', async () => {
    const res = await request(app).post('/income/delete').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('income_id required')
  })

  it('returns 404 when income entry does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/income/delete').send({ income_id: 999 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Income not found')
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/income/delete').send({ income_id: 1 })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to delete income')
  })
})

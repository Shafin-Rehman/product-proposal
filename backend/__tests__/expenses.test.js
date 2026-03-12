jest.mock('../db', () => ({ query: jest.fn() }))
jest.mock('../supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('../middleware/auth', () =>
  jest.fn((req, res, next) => { req.user = { id: 'uid', email: 'a@b.com' }; next() })
)

const request = require('supertest')
const app = require('../index')
const db = require('../db')

beforeEach(() => db.query.mockClear())

// POST /expenses
describe('POST /expenses', () => {
  const row = { id: 1, user_id: 'uid', category_id: null, amount: '25.00', description: 'Coffee', date: '2026-03-01', created_at: '2026-03-01T10:00:00Z' }

  it('201 — creates expense, without user_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await request(app).post('/expenses').send({ amount: 25, date: '2026-03-01', description: 'Coffee' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 1, amount: '25.00', description: 'Coffee' })
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('201 — accepts category_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, category_id: 3 }] })
    const res = await request(app).post('/expenses').send({ amount: 25, date: '2026-03-01', category_id: 3 })
    expect(res.status).toBe(201)
    expect(res.body.category_id).toBe(3)
  })

  it('400 — missing amount', async () => {
    const res = await request(app).post('/expenses').send({ date: '2026-03-01' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('amount and date are required')
  })

  it('400 — missing date', async () => {
    const res = await request(app).post('/expenses').send({ amount: 25 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('amount and date are required')
  })

  it('500 — db error', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/expenses').send({ amount: 25, date: '2026-03-01' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to create expense')
  })
})

// GET /expenses
describe('GET /expenses', () => {
  it('200 — returns list, omits user_id', async () => {
    const rows = [
      { id: 1, user_id: 'uid', amount: '10.00', date: '2026-03-01', category_name: 'Food' },
      { id: 2, user_id: 'uid', amount: '20.00', date: '2026-03-02', category_name: null },
    ]
    db.query.mockResolvedValueOnce({ rows })
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({ id: 1, amount: '10.00', date: '2026-03-01', category_name: 'Food' })
    expect(res.body[1]).toMatchObject({ id: 2, amount: '20.00', category_name: null })
    res.body.forEach(e => expect(e).not.toHaveProperty('user_id'))
  })

  it('200 — empty list', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('500 — db error', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).get('/expenses')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to fetch expenses')
  })
})

// POST /expenses/get
describe('POST /expenses/get', () => {
  const row = { id: 1, user_id: 'uid', amount: '15.00', date: '2026-03-01', category_name: 'Travel' }

  it('200 — returns expense, omits user_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await request(app).post('/expenses/get').send({ expense_id: 1 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1, amount: '15.00', category_name: 'Travel' })
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('400 — missing expense_id', async () => {
    const res = await request(app).post('/expenses/get').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('expense_id required')
  })

  it('404 — not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/expenses/get').send({ expense_id: 999 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Expense not found')
  })

  it('500 — db error', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/expenses/get').send({ expense_id: 1 })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to fetch expense')
  })
})

// POST /expenses/update
describe('POST /expenses/update', () => {
  const row = { id: 1, user_id: 'uid', category_id: 2, amount: '30.00', date: '2026-03-01', description: 'Updated' }

  it('200 — updates amount, omits user_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    const res = await request(app).post('/expenses/update').send({ expense_id: 1, amount: 30 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1, amount: '30.00' })
    expect(res.body).not.toHaveProperty('user_id')
  })

  it('200 — updates category_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, category_id: 5 }] })
    const res = await request(app).post('/expenses/update').send({ expense_id: 1, category_id: 5 })
    expect(res.status).toBe(200)
    expect(res.body.category_id).toBe(5)
  })

  it('200 — updates multiple fields', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, description: 'Dinner', date: '2026-03-05' }] })
    const res = await request(app).post('/expenses/update').send({ expense_id: 1, description: 'Dinner', date: '2026-03-05' })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ description: 'Dinner', date: '2026-03-05' })
  })

  it('400 — missing expense_id', async () => {
    const res = await request(app).post('/expenses/update').send({ amount: 30 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('expense_id required')
  })

  it('400 — no fields to update', async () => {
    const res = await request(app).post('/expenses/update').send({ expense_id: 1 })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('No fields provided to update')
  })

  it('404 — not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/expenses/update').send({ expense_id: 999, amount: 10 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Expense not found')
  })

  it('500 — db error', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/expenses/update').send({ expense_id: 1, amount: 10 })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to update expense')
  })
})

// POST /expenses/delete
describe('POST /expenses/delete', () => {
  it('204 — deleted', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    const res = await request(app).post('/expenses/delete').send({ expense_id: 1 })
    expect(res.status).toBe(204)
  })

  it('400 — missing expense_id', async () => {
    const res = await request(app).post('/expenses/delete').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('expense_id required')
  })

  it('404 — not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/expenses/delete').send({ expense_id: 999 })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Expense not found')
  })

  it('500 — db error', async () => {
    db.query.mockRejectedValueOnce(new Error())
    const res = await request(app).post('/expenses/delete').send({ expense_id: 1 })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to delete expense')
  })
})

jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')
const categoriesHandler = require('@/app/api/expenses/categories/route')
const expensesHandler = require('@/app/api/expenses/route')
const deleteHandler = require('@/app/api/expenses/delete/route')

const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  db.query.mockClear()
  authenticate.mockClear()
  authenticate.mockResolvedValue({ user: { id: 'uid', email: 'a@b.com' } })
})

describe('GET /api/expenses/categories', () => {
  it('200 — returns list of categories', async () => {
    const rows = [
      { id: 'cat-1', name: 'Food', icon: '🍔' },
      { id: 'cat-2', name: 'Transit', icon: '🚌' },
      { id: 'cat-3', name: 'Utilities', icon: '💡' },
    ]
    db.query.mockResolvedValueOnce({ rows })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveLength(3)
        expect(body[0]).toMatchObject({ id: 'cat-1', name: 'Food', icon: '🍔' })
        expect(body[1]).toMatchObject({ id: 'cat-2', name: 'Transit' })
      }
    })
  })

  it('401 — unauthenticated request is rejected', async () => {
    const { NextResponse } = require('next/server')
    authenticate.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(401)
        expect((await res.json()).error).toBe('Unauthorized')
      }
    })
  })

  it('500 — returns error on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'))
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(500)
        expect((await res.json()).error).toBe('Failed to fetch categories')
      }
    })
  })

  it('200 — returns empty array when no categories exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([])
      }
    })
  })
})

describe('GET /api/expenses — additional', () => {
  it('500 — returns error on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(500)
        expect((await res.json()).error).toBe('Failed to fetch expenses')
      }
    })
  })
})

describe('POST /api/expenses/delete — additional', () => {
  it('404 — expense not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 'missing-id' }))
        expect(res.status).toBe(404)
        expect((await res.json()).error).toBe('Expense not found')
      }
    })
  })
})

jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => ({
  normalizeMonth: jest.fn(),
  getMonthlyBudget: jest.fn(),
  upsertMonthlyBudget: jest.fn(),
  evaluateThresholdForMonth: jest.fn(),
  buildBudgetSummary: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { NextResponse } = require('next/server')
const { authenticate } = require('@/lib/auth')
const db = require('@/lib/db')
const budget = require('@/lib/budget')
const budgetHandler = require('@/app/api/budget/route')
const summaryHandler = require('@/app/api/budget/summary/route')
const breakdownHandler = require('@/app/api/expenses/breakdown/route')
const categoriesHandler = require('@/app/api/expenses/categories/route')

const authorizedUser = { id: 'uid', email: 'a@b.com' }
const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  authenticate.mockClear()
  db.query.mockClear()
  budget.normalizeMonth.mockClear()
  budget.getMonthlyBudget.mockClear()
  budget.upsertMonthlyBudget.mockClear()
  budget.evaluateThresholdForMonth.mockClear()
  budget.buildBudgetSummary.mockClear()
  authenticate.mockResolvedValue({ user: authorizedUser })
  budget.normalizeMonth.mockImplementation(value => value)
})

describe('GET /api/expenses/categories', () => {
  it('returns global and user expense categories', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', name: 'Food', icon: 'icon' }] })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([{ id: 'cat-1', name: 'Food', icon: 'icon' }])
      }
    })
  })

  it('returns 401 when unauthenticated', async () => {
    authenticate.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(401)
      }
    })
  })
})

describe('GET /api/expenses/breakdown', () => {
  it('returns grouped spending totals for the requested month', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ category_id: null, category_name: 'Uncategorized', total_amount: '45.00' }]
    })
    await testApiHandler({
      appHandler: breakdownHandler,
      url: 'http://localhost/api/expenses/breakdown?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([
          { category_id: null, category_name: 'Uncategorized', total_amount: '45.00' }
        ])
      }
    })
  })

  it('returns 400 for an invalid month', async () => {
    budget.normalizeMonth.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: breakdownHandler,
      url: 'http://localhost/api/expenses/breakdown?month=bad',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid month is required')
      }
    })
  })
})

describe('GET /api/budget', () => {
  it('returns the stored monthly budget', async () => {
    budget.getMonthlyBudget.mockResolvedValueOnce({ month: '2026-03-01', monthly_limit: '100.00', notified: false })
    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ month: '2026-03-01', monthly_limit: '100.00', notified: false })
      }
    })
  })

  it('returns null when no budget exists', async () => {
    budget.getMonthlyBudget.mockResolvedValueOnce(null)
    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toBeNull()
      }
    })
  })
})

describe('POST /api/budget', () => {
  it('upserts a monthly budget and returns the latest notification state', async () => {
    budget.upsertMonthlyBudget.mockResolvedValueOnce({ month: '2026-03-01', monthly_limit: '100.00', notified: false })
    budget.evaluateThresholdForMonth.mockResolvedValueOnce({ notified: true })
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 100 }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ month: '2026-03-01', monthly_limit: '100.00', notified: true })
      }
    })
  })

  it('returns 400 when monthly_limit is invalid', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 0 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('monthly_limit must be greater than 0')
      }
    })
  })
})

describe('GET /api/budget/summary', () => {
  it('returns the monthly budget summary', async () => {
    budget.buildBudgetSummary.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '500.00',
      total_income: '3000.00',
      total_expenses: '450.00',
      remaining_budget: '50.00',
      threshold_exceeded: false,
      notified: false,
    })
    await testApiHandler({
      appHandler: summaryHandler,
      url: 'http://localhost/api/budget/summary?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: '500.00',
          total_income: '3000.00',
          total_expenses: '450.00',
          remaining_budget: '50.00',
          threshold_exceeded: false,
          notified: false,
        })
      }
    })
  })

  it('returns 400 for an invalid month', async () => {
    budget.normalizeMonth.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: summaryHandler,
      url: 'http://localhost/api/budget/summary?month=bad',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid month is required')
      }
    })
  })
})

jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => {
  const actual = jest.requireActual('@/lib/budget')
  return {
    ...actual,
    normalizeMonth: jest.fn(actual.normalizeMonth),
    isPositiveMoneyValue: jest.fn(actual.isPositiveMoneyValue),
    getMonthlyBudget: jest.fn(),
    getMonthlyBudgetConfig: jest.fn(),
    getOwnedOrGlobalCategoriesByIds: jest.fn(),
    upsertMonthlyBudget: jest.fn(),
    upsertCategoryBudgets: jest.fn(),
    evaluateThresholdForMonth: jest.fn(),
    buildBudgetSummary: jest.fn(),
  }
})

const { testApiHandler } = require('next-test-api-route-handler')
const { NextResponse } = require('next/server')
const { authenticate } = require('@/lib/auth')
const db = require('@/lib/db')
const budget = require('@/lib/budget')
const actualBudget = jest.requireActual('@/lib/budget')
const breakdownHandler = require('@/app/api/expenses/breakdown/route')
const categoriesHandler = require('@/app/api/expenses/categories/route')

const authorizedUser = { id: 'uid', email: 'a@b.com' }

beforeEach(() => {
  authenticate.mockClear()
  db.query.mockClear()
  budget.normalizeMonth.mockClear()
  budget.getMonthlyBudget.mockClear()
  budget.getMonthlyBudgetConfig.mockClear()
  budget.getOwnedOrGlobalCategoriesByIds.mockClear()
  budget.upsertMonthlyBudget.mockClear()
  budget.upsertCategoryBudgets.mockClear()
  budget.evaluateThresholdForMonth.mockClear()
  budget.buildBudgetSummary.mockClear()
  authenticate.mockResolvedValue({ user: authorizedUser })
  budget.normalizeMonth.mockImplementation(actualBudget.normalizeMonth)
  budget.isPositiveMoneyValue.mockImplementation(actualBudget.isPositiveMoneyValue)
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

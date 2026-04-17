jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => {
  const actual = jest.requireActual('@/lib/budget')
  return {
    ...actual,
    normalizeMonth: jest.fn(actual.normalizeMonth),
    getMonthlyBudget: jest.fn(),
    upsertMonthlyBudget: jest.fn(),
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
  budget.normalizeMonth.mockImplementation(actualBudget.normalizeMonth)
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
  it('upserts a monthly budget and returns notified when spending reaches the limit', async () => {
    budget.upsertMonthlyBudget.mockResolvedValueOnce({ month: '2026-03-01', monthly_limit: '100.00', notified: false })
    budget.evaluateThresholdForMonth.mockResolvedValueOnce({
      notified: true,
      budget_alert: {
        month: '2026-03-01',
        monthly_limit: '100.00',
        total_expenses: '100.00',
        threshold_exceeded: true,
      },
    })
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 100 }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: '100.00',
          notified: true,
          budget_alert: {
            month: '2026-03-01',
            monthly_limit: '100.00',
            total_expenses: '100.00',
            threshold_exceeded: true,
          },
        })
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

  it('returns 400 when monthly_limit is not a positive money value', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 'abc' }))
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

  it('reports threshold_exceeded when spending reaches the monthly limit', async () => {
    budget.buildBudgetSummary.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '500.00',
      total_income: '3000.00',
      total_expenses: '500.00',
      remaining_budget: '0.00',
      threshold_exceeded: true,
      notified: true,
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
          total_expenses: '500.00',
          remaining_budget: '0.00',
          threshold_exceeded: true,
          notified: true,
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

describe('normalizeDate', () => {
  it('accepts plain YYYY-MM-DD input', () => {
    expect(actualBudget.normalizeDate('2026-03-15')).toBe('2026-03-15')
  })

  it('accepts ISO timestamp input', () => {
    expect(actualBudget.normalizeDate('2026-03-15T08:30:00Z')).toBe('2026-03-15')
  })

  it('accepts Date instance input', () => {
    const date = new Date(Date.UTC(2026, 2, 15, 8, 30, 0))
    expect(actualBudget.normalizeDate(date)).toBe('2026-03-15')
  })

  it('rejects invalid dates', () => {
    expect(actualBudget.normalizeDate('2026-02-30')).toBeNull()
  })
})

describe('isPositiveMoneyValue', () => {
  it('accepts positive numbers and numeric strings', () => {
    expect(actualBudget.isPositiveMoneyValue(25)).toBe(true)
    expect(actualBudget.isPositiveMoneyValue('25.50')).toBe(true)
    expect(actualBudget.isPositiveMoneyValue(' 25.50 ')).toBe(true)
  })

  it('rejects empty, non-numeric, and non-positive values', () => {
    expect(actualBudget.isPositiveMoneyValue('')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('abc')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(0)).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('-5')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(null)).toBe(false)
  })

  it('rejects positive values that are not storable as NUMERIC(10,2)', () => {
    expect(actualBudget.isPositiveMoneyValue(0.001)).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('0.001')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('1.999')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('1e2')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('100000000')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(100000000)).toBe(false)
  })
})

describe('budget helper threshold boundary', () => {
  it('treats spending equal to the limit as threshold reached in the summary', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: false }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '100.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '2500.00' }]
      })

    const summary = await actualBudget.buildBudgetSummary('uid', '2026-03-01')

    expect(summary).toEqual({
      month: '2026-03-01',
      monthly_limit: '100.00',
      total_income: '2500.00',
      total_expenses: '100.00',
      remaining_budget: '0.00',
      threshold_exceeded: true,
      notified: false,
    })
    expect(db.query).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/FROM public\.income[\s\S]*WHERE user_id = \$1 AND date >= \$2 AND date < \$3/),
      ['uid', '2026-03-01', '2026-04-01']
    )
  })

  it('triggers a budget alert when spending reaches the limit', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: false }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '100.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '0.00' }]
      })
      .mockResolvedValueOnce({ rows: [] })

    const result = await actualBudget.evaluateThresholdForMonth('uid', '2026-03-20')

    expect(result).toEqual({
      month: '2026-03-01',
      monthly_limit: '100.00',
      total_expenses: '100.00',
      threshold_exceeded: true,
      notified: true,
      alertTriggered: true,
      budget_alert: {
        month: '2026-03-01',
        monthly_limit: '100.00',
        total_expenses: '100.00',
        threshold_exceeded: true,
      },
    })
    expect(db.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE public.budget_thresholds'),
      ['uid', '2026-03-01', true]
    )
  })

  it('does not return a new budget alert when already over the limit and already notified', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: true }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '120.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '0.00' }]
      })

    const result = await actualBudget.evaluateThresholdForMonth('uid', '2026-03-25')

    expect(result).toEqual({
      month: '2026-03-01',
      monthly_limit: '100.00',
      total_expenses: '120.00',
      threshold_exceeded: true,
      notified: true,
      alertTriggered: false,
      budget_alert: null,
    })
    expect(db.query).toHaveBeenCalledTimes(3)
  })
})

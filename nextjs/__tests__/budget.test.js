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
const budgetHandler = require('@/app/api/budget/route')
const summaryHandler = require('@/app/api/budget/summary/route')
const breakdownHandler = require('@/app/api/expenses/breakdown/route')
const categoriesHandler = require('@/app/api/expenses/categories/route')

const authorizedUser = { id: 'uid', email: 'a@b.com' }
const FOOD_CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

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

describe('GET /api/budget', () => {
  it('returns the stored monthly budget config with category budgets', async () => {
    budget.getMonthlyBudgetConfig.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '100.00',
      notified: false,
      category_budgets: [
        {
          category_id: 'cat-1',
          category_name: 'Food',
          category_icon: '🍔',
          monthly_limit: '40.00',
        },
      ],
    })
    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: '100.00',
          notified: false,
          category_budgets: [
            {
              category_id: 'cat-1',
              category_name: 'Food',
              category_icon: '🍔',
              monthly_limit: '40.00',
            },
          ],
        })
      }
    })
  })

  it('returns null when no budget exists', async () => {
    budget.getMonthlyBudgetConfig.mockResolvedValueOnce(null)
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
  it('upserts an overall monthly budget and keeps category budgets in the response', async () => {
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
    budget.getMonthlyBudgetConfig.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '100.00',
      notified: false,
      category_budgets: [],
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
          category_budgets: [],
        })
      }
    })
  })

  it('upserts category budgets without requiring an overall monthly limit', async () => {
    budget.getOwnedOrGlobalCategoriesByIds.mockResolvedValueOnce([{ id: FOOD_CATEGORY_ID, name: 'Food', icon: '🍔' }])
    budget.upsertCategoryBudgets.mockResolvedValueOnce([{ category_id: FOOD_CATEGORY_ID, month: '2026-03-01', monthly_limit: '40.00' }])
    budget.getMonthlyBudgetConfig.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: null,
      notified: false,
      category_budgets: [
        {
          category_id: FOOD_CATEGORY_ID,
          category_name: 'Food',
          category_icon: '🍔',
          monthly_limit: '40.00',
        },
      ],
    })

    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          month: '2026-03-01',
          category_budgets: [{ category_id: FOOD_CATEGORY_ID, monthly_limit: 40 }],
        }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: null,
          notified: false,
          budget_alert: null,
          category_budgets: [
            {
              category_id: FOOD_CATEGORY_ID,
              category_name: 'Food',
              category_icon: '🍔',
              monthly_limit: '40.00',
            },
          ],
        })
        expect(budget.evaluateThresholdForMonth).not.toHaveBeenCalled()
      }
    })
  })

  it('upserts combined overall and category budgets', async () => {
    budget.getOwnedOrGlobalCategoriesByIds.mockResolvedValueOnce([{ id: FOOD_CATEGORY_ID, name: 'Food', icon: '🍔' }])
    budget.upsertMonthlyBudget.mockResolvedValueOnce({ month: '2026-03-01', monthly_limit: '120.00', notified: false })
    budget.upsertCategoryBudgets.mockResolvedValueOnce([{ category_id: FOOD_CATEGORY_ID, month: '2026-03-01', monthly_limit: '60.00' }])
    budget.evaluateThresholdForMonth.mockResolvedValueOnce({
      notified: false,
      budget_alert: null,
    })
    budget.getMonthlyBudgetConfig.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '120.00',
      notified: false,
      category_budgets: [
        {
          category_id: FOOD_CATEGORY_ID,
          category_name: 'Food',
          category_icon: '🍔',
          monthly_limit: '60.00',
        },
      ],
    })

    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          month: '2026-03-01',
          monthly_limit: 120,
          category_budgets: [{ category_id: FOOD_CATEGORY_ID, monthly_limit: 60 }],
        }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: '120.00',
          notified: false,
          budget_alert: null,
          category_budgets: [
            {
              category_id: FOOD_CATEGORY_ID,
              category_name: 'Food',
              category_icon: '🍔',
              monthly_limit: '60.00',
            },
          ],
        })
        expect(budget.evaluateThresholdForMonth).toHaveBeenCalledWith('uid', '2026-03-01')
      }
    })
  })

  it('returns 400 when both monthly_limit and category_budgets are missing', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('monthly_limit or category_budgets is required')
      }
    })
  })

  it('returns 400 when monthly_limit is not a positive money value', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 'abc' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('monthly_limit must be a valid positive money amount')
      }
    })
  })

  it('returns 400 when category budget values are invalid', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          month: '2026-03-01',
          category_budgets: [{ category_id: FOOD_CATEGORY_ID, monthly_limit: 0 }],
        }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Each category budget monthly_limit must be a valid positive money amount')
      }
    })
  })

  it('returns 400 when category_id is not a valid UUID', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          month: '2026-03-01',
          category_budgets: [{ category_id: 'cat-1', monthly_limit: 40 }],
        }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Each category budget requires a valid UUID category_id')
        expect(budget.getOwnedOrGlobalCategoriesByIds).not.toHaveBeenCalled()
      }
    })
  })
})

describe('GET /api/budget/summary', () => {
  it('returns the monthly budget summary with category totals and statuses', async () => {
    budget.buildBudgetSummary.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: '500.00',
      category_budget_total: '300.00',
      total_budget: '500.00',
      total_income: '3000.00',
      total_expenses: '450.00',
      remaining_budget: '50.00',
      threshold_exceeded: false,
      notified: false,
      category_statuses: [
        {
          category_id: 'cat-1',
          category_name: 'Food',
          category_icon: '🍔',
          monthly_limit: '200.00',
          spent: '150.00',
          remaining_budget: '50.00',
          threshold_exceeded: false,
          progress_percentage: 75,
        },
      ],
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
          category_budget_total: '300.00',
          total_budget: '500.00',
          total_income: '3000.00',
          total_expenses: '450.00',
          remaining_budget: '50.00',
          threshold_exceeded: false,
          notified: false,
          category_statuses: [
            {
              category_id: 'cat-1',
              category_name: 'Food',
              category_icon: '🍔',
              monthly_limit: '200.00',
              spent: '150.00',
              remaining_budget: '50.00',
              threshold_exceeded: false,
              progress_percentage: 75,
            },
          ],
        })
      }
    })
  })

  it('reports threshold_exceeded when spending reaches total_budget', async () => {
    budget.buildBudgetSummary.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: null,
      category_budget_total: '500.00',
      total_budget: '500.00',
      total_income: '3000.00',
      total_expenses: '500.00',
      remaining_budget: '0.00',
      threshold_exceeded: true,
      notified: false,
      category_statuses: [],
    })
    await testApiHandler({
      appHandler: summaryHandler,
      url: 'http://localhost/api/budget/summary?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: null,
          category_budget_total: '500.00',
          total_budget: '500.00',
          total_income: '3000.00',
          total_expenses: '500.00',
          remaining_budget: '0.00',
          threshold_exceeded: true,
          notified: false,
          category_statuses: [],
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

describe('buildBudgetSummary helper', () => {
  it('returns overall-budget-only summary values', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: false }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '60.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '2500.00' }]
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: []
      })

    const summary = await actualBudget.buildBudgetSummary('uid', '2026-03-01')

    expect(summary).toEqual({
      month: '2026-03-01',
      monthly_limit: '100.00',
      category_budget_total: '0.00',
      total_budget: '100.00',
      total_income: '2500.00',
      total_expenses: '60.00',
      remaining_budget: '40.00',
      threshold_exceeded: false,
      notified: false,
      category_statuses: [],
    })
  })

  it('uses category budgets when no overall monthly limit exists', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '45.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '2500.00' }]
      })
      .mockResolvedValueOnce({
        rows: [
          { category_id: 'cat-1', monthly_limit: '40.00', category_name: 'Food', category_icon: '🍔' },
          { category_id: 'cat-2', monthly_limit: '25.00', category_name: 'Transit', category_icon: '🚌' },
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { category_id: 'cat-1', category_name: 'Food', category_icon: '🍔', spent: '35.00' },
        ]
      })

    const summary = await actualBudget.buildBudgetSummary('uid', '2026-03-01')

    expect(summary).toEqual({
      month: '2026-03-01',
      monthly_limit: null,
      category_budget_total: '65.00',
      total_budget: '65.00',
      total_income: '2500.00',
      total_expenses: '45.00',
      remaining_budget: '20.00',
      threshold_exceeded: false,
      notified: false,
      category_statuses: [
        {
          category_id: 'cat-1',
          category_name: 'Food',
          category_icon: '🍔',
          monthly_limit: '40.00',
          spent: '35.00',
          remaining_budget: '5.00',
          threshold_exceeded: false,
          progress_percentage: 87.5,
        },
        {
          category_id: 'cat-2',
          category_name: 'Transit',
          category_icon: '🚌',
          monthly_limit: '25.00',
          spent: '0.00',
          remaining_budget: '25.00',
          threshold_exceeded: false,
          progress_percentage: 0,
        },
      ],
    })
  })

  it('prefers the overall monthly limit as total_budget when both overall and category budgets exist', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '120.00', notified: true }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '80.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '2500.00' }]
      })
      .mockResolvedValueOnce({
        rows: [
          { category_id: 'cat-1', monthly_limit: '50.00', category_name: 'Food', category_icon: '🍔' },
          { category_id: 'cat-2', monthly_limit: '40.00', category_name: 'Transit', category_icon: '🚌' },
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          { category_id: 'cat-1', category_name: 'Food', category_icon: '🍔', spent: '45.00' },
          { category_id: 'cat-2', category_name: 'Transit', category_icon: '🚌', spent: '25.00' },
        ]
      })

    const summary = await actualBudget.buildBudgetSummary('uid', '2026-03-01')

    expect(summary.total_budget).toBe('120.00')
    expect(summary.category_budget_total).toBe('90.00')
    expect(summary.remaining_budget).toBe('40.00')
    expect(summary.notified).toBe(true)
  })

  it('includes categories with spend even when no category budget exists', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '22.00' }]
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '2500.00' }]
      })
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: [
          { category_id: null, category_name: 'Uncategorized', category_icon: null, spent: '7.00' },
          { category_id: 'cat-9', category_name: 'Fun', category_icon: '🎉', spent: '15.00' },
        ]
      })

    const summary = await actualBudget.buildBudgetSummary('uid', '2026-03-01')

    expect(summary).toEqual({
      month: '2026-03-01',
      monthly_limit: null,
      category_budget_total: '0.00',
      total_budget: null,
      total_income: '2500.00',
      total_expenses: '22.00',
      remaining_budget: null,
      threshold_exceeded: false,
      notified: false,
      category_statuses: [
        {
          category_id: 'cat-9',
          category_name: 'Fun',
          category_icon: '🎉',
          monthly_limit: null,
          spent: '15.00',
          remaining_budget: null,
          threshold_exceeded: false,
          progress_percentage: 0,
        },
        {
          category_id: null,
          category_name: 'Uncategorized',
          category_icon: null,
          monthly_limit: null,
          spent: '7.00',
          remaining_budget: null,
          threshold_exceeded: false,
          progress_percentage: 0,
        },
      ],
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

  it('accepts numeric inputs that are valid cent values despite floating-point noise', () => {
    expect(actualBudget.isPositiveMoneyValue(0.1 + 0.2)).toBe(true)
    expect(actualBudget.isPositiveMoneyValue(10.23 * 100 / 100)).toBe(true)
  })

  it('rejects empty, non-numeric, and non-positive values', () => {
    expect(actualBudget.isPositiveMoneyValue('')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('abc')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(0)).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('-5')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(null)).toBe(false)
  })

  it('rejects positive values that are not storable as NUMERIC(10,2)', () => {
    expect(actualBudget.isPositiveMoneyValue(1e-12)).toBe(false)
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
      .mockResolvedValueOnce({
        rows: []
      })
      .mockResolvedValueOnce({
        rows: []
      })

    const summary = await actualBudget.buildBudgetSummary('uid', '2026-03-01')

    expect(summary).toEqual({
      month: '2026-03-01',
      monthly_limit: '100.00',
      category_budget_total: '0.00',
      total_budget: '100.00',
      total_income: '2500.00',
      total_expenses: '100.00',
      remaining_budget: '0.00',
      threshold_exceeded: true,
      notified: false,
      category_statuses: [],
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

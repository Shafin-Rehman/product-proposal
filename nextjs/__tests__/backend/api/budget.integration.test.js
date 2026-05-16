jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/db', () => ({ connect: jest.fn(), query: jest.fn() }))
jest.mock('@/lib/budget', () => {
  const actual = jest.requireActual('@/lib/budget')
  return {
    ...actual,
    normalizeMonth: jest.fn(actual.normalizeMonth),
    isPositiveMoneyValue: jest.fn(actual.isPositiveMoneyValue),
    clearCategoryBudgetConfig: jest.fn(),
    getMonthlyBudget: jest.fn(),
    getMonthlyBudgetConfig: jest.fn(),
    getOwnedOrGlobalCategoriesByIds: jest.fn(),
    deleteCategoryBudget: jest.fn(),
    upsertMonthlyBudget: jest.fn(),
    upsertCategoryBudgets: jest.fn(),
    evaluateThresholdForMonth: jest.fn(),
    buildBudgetSummary: jest.fn(),
  }
})

const { testApiHandler } = require('next-test-api-route-handler')
const { authenticate } = require('@/lib/auth')
const db = require('@/lib/db')
const budget = require('@/lib/budget')
const actualBudget = jest.requireActual('@/lib/budget')
const budgetHandler = require('@/app/api/budget/route')
const summaryHandler = require('@/app/api/budget/summary/route')

const authorizedUser = { id: 'uid', email: 'a@b.com' }
const FOOD_CATEGORY_ID = '11111111-1111-4111-8111-111111111111'
const TRANSIT_CATEGORY_ID = '22222222-2222-4222-8222-222222222222'
const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
const deleteBudget = () => ({ method: 'DELETE' })

beforeEach(() => {
  authenticate.mockClear()
  db.query.mockClear()
  db.connect.mockClear()
  budget.normalizeMonth.mockClear()
  budget.getMonthlyBudget.mockClear()
  budget.getMonthlyBudgetConfig.mockClear()
  budget.getOwnedOrGlobalCategoriesByIds.mockClear()
  budget.clearCategoryBudgetConfig.mockClear()
  budget.deleteCategoryBudget.mockClear()
  budget.upsertMonthlyBudget.mockClear()
  budget.upsertCategoryBudgets.mockClear()
  budget.evaluateThresholdForMonth.mockClear()
  budget.buildBudgetSummary.mockClear()
  authenticate.mockResolvedValue({ user: authorizedUser })
  budget.normalizeMonth.mockImplementation(actualBudget.normalizeMonth)
  budget.isPositiveMoneyValue.mockImplementation(actualBudget.isPositiveMoneyValue)
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

describe('DELETE /api/budget', () => {
  it('clears one category budget and returns remaining category budgets', async () => {
    budget.getOwnedOrGlobalCategoriesByIds.mockResolvedValueOnce([{ id: FOOD_CATEGORY_ID }])
    budget.clearCategoryBudgetConfig.mockResolvedValueOnce({
      month: '2026-03-01',
      monthly_limit: null,
      notified: false,
      category_budgets: [
        {
          category_id: TRANSIT_CATEGORY_ID,
          category_name: 'Transit',
          category_icon: '🚌',
          monthly_limit: '25.00',
        },
      ],
    })

    await testApiHandler({
      appHandler: budgetHandler,
      url: `http://localhost/api/budget?month=2026-03-01&category_id=${FOOD_CATEGORY_ID}`,
      async test({ fetch }) {
        const res = await fetch(deleteBudget())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: null,
          notified: false,
          budget_alert: null,
          category_budgets: [
            {
              category_id: TRANSIT_CATEGORY_ID,
              category_name: 'Transit',
              category_icon: '🚌',
              monthly_limit: '25.00',
            },
          ],
        })
        expect(budget.getOwnedOrGlobalCategoriesByIds).toHaveBeenCalledWith('uid', [FOOD_CATEGORY_ID])
        expect(budget.clearCategoryBudgetConfig).toHaveBeenCalledWith('uid', '2026-03-01', FOOD_CATEGORY_ID)
      }
    })
  })

  it('returns an empty budget envelope when clearing the final or missing category budget', async () => {
    budget.getOwnedOrGlobalCategoriesByIds.mockResolvedValueOnce([{ id: FOOD_CATEGORY_ID }])
    budget.clearCategoryBudgetConfig.mockResolvedValueOnce(null)

    await testApiHandler({
      appHandler: budgetHandler,
      url: `http://localhost/api/budget?month=2026-03-01&category_id=${FOOD_CATEGORY_ID}`,
      async test({ fetch }) {
        const res = await fetch(deleteBudget())
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: null,
          notified: false,
          budget_alert: null,
          category_budgets: [],
        })
      }
    })
  })

  it('returns 400 when category_id is a valid UUID but not owned or global', async () => {
    budget.getOwnedOrGlobalCategoriesByIds.mockResolvedValueOnce([])

    await testApiHandler({
      appHandler: budgetHandler,
      url: `http://localhost/api/budget?month=2026-03-01&category_id=${FOOD_CATEGORY_ID}`,
      async test({ fetch }) {
        const res = await fetch(deleteBudget())
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('category_id must reference an owned or global category')
        expect(budget.getOwnedOrGlobalCategoriesByIds).toHaveBeenCalledWith('uid', [FOOD_CATEGORY_ID])
        expect(budget.clearCategoryBudgetConfig).not.toHaveBeenCalled()
      }
    })
  })

  it('returns 400 when category_id is missing or invalid', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch(deleteBudget())
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('category_id is required')
      }
    })

    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget?month=2026-03-01&category_id=cat-1',
      async test({ fetch }) {
        const res = await fetch(deleteBudget())
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('category_id must be a valid UUID')
        expect(budget.clearCategoryBudgetConfig).not.toHaveBeenCalled()
      }
    })
  })

  it('returns 400 when the clear month is invalid', async () => {
    await testApiHandler({
      appHandler: budgetHandler,
      url: `http://localhost/api/budget?month=bad&category_id=${FOOD_CATEGORY_ID}`,
      async test({ fetch }) {
        const res = await fetch(deleteBudget())
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid month is required')
        expect(budget.clearCategoryBudgetConfig).not.toHaveBeenCalled()
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
    expect(actualBudget.isPositiveMoneyValue(1e-12)).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(0.001)).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('0.001')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('1.999')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('1e2')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue('100000000')).toBe(false)
    expect(actualBudget.isPositiveMoneyValue(100000000)).toBe(false)
  })
})

describe('deleteCategoryBudget', () => {
  it('deletes only the matching user month and category budget row', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ category_id: FOOD_CATEGORY_ID, month: '2026-03-01' }]
    })

    await expect(actualBudget.deleteCategoryBudget('uid', '2026-03-01', FOOD_CATEGORY_ID)).resolves.toEqual({
      category_id: FOOD_CATEGORY_ID,
      month: '2026-03-01',
    })
    expect(db.query).toHaveBeenCalledWith(
      expect.stringMatching(/DELETE FROM public\.category_budgets[\s\S]*WHERE user_id = \$1 AND month = \$2 AND category_id = \$3[\s\S]*RETURNING category_id, month/),
      ['uid', '2026-03-01', FOOD_CATEGORY_ID]
    )
  })

  it('returns null when there is no matching category budget row to clear', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })

    await expect(actualBudget.deleteCategoryBudget('uid', '2026-03-01', FOOD_CATEGORY_ID)).resolves.toBeNull()
  })
})

describe('clearCategoryBudgetConfig', () => {
  it('deletes and reads the updated budget config in one transaction', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ category_id: FOOD_CATEGORY_ID, month: '2026-03-01' }] })
        .mockResolvedValueOnce({ rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: false }] })
        .mockResolvedValueOnce({
          rows: [{
            category_id: TRANSIT_CATEGORY_ID,
            category_name: 'Transit',
            category_icon: '🚌',
            monthly_limit: '25.00',
          }],
        })
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    }
    db.connect.mockResolvedValueOnce(client)

    await expect(actualBudget.clearCategoryBudgetConfig('uid', '2026-03-01', FOOD_CATEGORY_ID)).resolves.toEqual({
      month: '2026-03-01',
      monthly_limit: '100.00',
      notified: false,
      category_budgets: [{
        category_id: TRANSIT_CATEGORY_ID,
        category_name: 'Transit',
        category_icon: '🚌',
        monthly_limit: '25.00',
      }],
    })
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/DELETE FROM public\.category_budgets/),
      ['uid', '2026-03-01', FOOD_CATEGORY_ID]
    )
    expect(client.query).toHaveBeenLastCalledWith('COMMIT')
    expect(client.release).toHaveBeenCalled()
  })

  it('rolls back when the post-delete config read fails', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [{ category_id: FOOD_CATEGORY_ID, month: '2026-03-01' }] })
        .mockRejectedValueOnce(new Error('read failed'))
        .mockResolvedValueOnce({}),
      release: jest.fn(),
    }
    db.connect.mockResolvedValueOnce(client)

    await expect(actualBudget.clearCategoryBudgetConfig('uid', '2026-03-01', FOOD_CATEGORY_ID)).rejects.toThrow('read failed')
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalled()
  })
})

describe('budget helper threshold boundary', () => {
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

// __tests__/budget.integration.test.js
import * as budget from '../src/lib/budget'
import db from '../src/lib/db'

jest.mock('../src/lib/db') // mock the db module

describe('Integration test: buildBudgetSummary', () => {
  const userId = 1
  const month = '2026-03-01'

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns correct summary when DB queries succeed', async () => {
    // Mock the database responses
    db.query.mockImplementation((query, params) => {
      if (query.includes('FROM public.budget_thresholds')) {
        return Promise.resolve({ rows: [{ month, monthly_limit: 1000, notified: false }] })
      } else if (query.includes('FROM public.expenses')) {
        return Promise.resolve({ rows: [{ total_expenses: '200' }] })
      } else if (query.includes('FROM public.income')) {
        return Promise.resolve({ rows: [{ total_income: '3000' }] })
      }
      return Promise.resolve({ rows: [] })
    })

    const result = await budget.buildBudgetSummary(userId, month)

    expect(result).toEqual({
      month,
      monthly_limit: '1000',
      total_expenses: '200',
      total_income: '3000',
      remaining_budget: '800.00',
      threshold_exceeded: false,
      notified: false,
    })
  })

  it('throws error when DB query fails', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection failed'))

    await expect(budget.buildBudgetSummary(userId, month)).rejects.toThrow('DB connection failed')
  })
})
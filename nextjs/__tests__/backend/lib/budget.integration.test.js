import {
  buildBudgetSummary,
  evaluateThresholdForMonth,
  getMonthlyCategorySpend,
  getMonthlyTotals,
} from '@/lib/budget'
import db from '@/lib/db'

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}))

const userId = 1
const month = '2026-03-01'

describe('budget specification', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  function installBuildBudgetSummaryMock() {
    db.query.mockImplementation((sql) => {
      const text = String(sql)
      if (text.includes('budget_thresholds') && text.includes('SELECT')) {
        return Promise.resolve({ rows: [{ month: '2026-03-01', monthly_limit: '1000.00', notified: false }] })
      }
      if (text.includes('total_expenses') && text.includes('public.expenses')) {
        return Promise.resolve({ rows: [{ total_expenses: '100.00' }] })
      }
      if (text.includes('total_income') && text.includes('public.income')) {
        return Promise.resolve({ rows: [{ total_income: '500.00' }] })
      }
      if (text.includes('category_budgets')) {
        return Promise.resolve({ rows: [] })
      }
      if (text.includes('FROM public.expenses e') && text.includes('GROUP BY')) {
        return Promise.resolve({ rows: [] })
      }
      return Promise.resolve({ rows: [] })
    })
  }

  function installEvaluateThresholdExceededMock() {
    db.query.mockImplementation((sql) => {
      const text = String(sql)
      if (text.includes('budget_thresholds') && text.includes('SELECT')) {
        return Promise.resolve({ rows: [{ month: '2026-03-01', monthly_limit: '50.00', notified: false }] })
      }
      if (text.includes('total_expenses') && text.includes('public.expenses')) {
        return Promise.resolve({ rows: [{ total_expenses: '80.00' }] })
      }
      if (text.includes('total_income') && text.includes('public.income')) {
        return Promise.resolve({ rows: [{ total_income: '0.00' }] })
      }
      if (text.includes('UPDATE public.budget_thresholds')) {
        return Promise.resolve({ rows: [] })
      }
      return Promise.resolve({ rows: [] })
    })
  }

  describe('getMonthlyCategorySpend', () => {
    it('exposes the category label returned for a keyed expense category', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { category_id: 1, category_name: 'Food', category_icon: null, spent: '100.00' },
        ],
      })

      const rows = await getMonthlyCategorySpend(userId, month)

      expect(rows[0]).toEqual(expect.objectContaining({
        category_name: 'Food',
        spent: '100.00',
      }))
    })

    it('exposes Uncategorized when the row has no category assignment', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { category_id: null, category_name: 'Uncategorized', category_icon: null, spent: '50.00' },
        ],
      })

      const rows = await getMonthlyCategorySpend(userId, month)

      expect(rows[0]).toEqual(expect.objectContaining({
        category_name: 'Uncategorized',
      }))
    })
  })

  describe('getMonthlyTotals', () => {
    it('returns coerced zero strings when both aggregates are empty', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_expenses: '0.00' }] })
        .mockResolvedValueOnce({ rows: [{ total_income: '0.00' }] })

      const totals = await getMonthlyTotals(userId, month)

      expect(totals).toEqual({
        total_expenses: '0.00',
        total_income: '0.00',
      })
    })
  })

  describe('buildBudgetSummary', () => {
    it('assembles summary fields from the four parallel data sources', async () => {
      installBuildBudgetSummaryMock()

      const summary = await buildBudgetSummary(userId, month)

      expect(summary).toEqual(expect.objectContaining({
        month: '2026-03-01',
        monthly_limit: '1000.00',
        total_budget: '1000.00',
        total_expenses: '100.00',
        total_income: '500.00',
      }))
    })
  })

  describe('evaluateThresholdForMonth', () => {
    it('returns null when the month string cannot be normalized to a real calendar month', async () => {
      const result = await evaluateThresholdForMonth(userId, 'bad-month')

      expect(result).toBeNull()
      expect(db.query).not.toHaveBeenCalled()
    })

    it('returns alert metadata when spend exceeds the stored limit and notify was false', async () => {
      installEvaluateThresholdExceededMock()

      const result = await evaluateThresholdForMonth(userId, month)

      expect(result).toEqual(expect.objectContaining({
        threshold_exceeded: true,
        alertTriggered: true,
        budget_alert: expect.objectContaining({ threshold_exceeded: true }),
      }))
    })
  })
})

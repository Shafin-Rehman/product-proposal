jest.mock('@/lib/db', () => ({ query: jest.fn() }))

const db = require('@/lib/db')
const { buildBudgetSummary, normalizeMonth } = require('@/lib/budget')

describe('budget lib', () => {
  beforeEach(() => {
    db.query.mockReset()
  })

  it('builds a monthly summary for valid budget data', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '500.00', notified: false }],
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '125.50' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '3000.00' }],
      })

    await expect(buildBudgetSummary('uid', '2026-03-01')).resolves.toEqual({
      month: '2026-03-01',
      monthly_limit: '500.00',
      total_income: '3000.00',
      total_expenses: '125.50',
      remaining_budget: '374.50',
      threshold_exceeded: false,
      notified: false,
    })
  })

  it('returns null for an invalid month input', () => {
    expect(normalizeMonth('2026-02-30')).toBeNull()
  })
})

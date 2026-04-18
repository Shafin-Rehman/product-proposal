jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
}))
jest.mock('@/lib/apiClient', () => ({
  ApiError: class ApiError extends Error {},
  apiGet: jest.fn(),
}))
jest.mock('@/lib/demoData', () => ({
  DEMO_MONTH: '2026-03-01',
  demoActivity: [],
  demoBudgetSummary: null,
  demoCategoryBudgets: [],
  demoIncomeSources: [],
  demoRecurringCharges: [],
}))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryVisual: jest.fn((value) => ({
    label: value || 'Uncategorized',
    color: '#123456',
    soft: '#abcdef',
    symbol: value?.[0] || '?',
  })),
  getEntryVisual: jest.fn(),
}))
jest.mock('@/lib/financeUtils', () => ({
  buildActivityFeed: jest.fn(),
  buildIncomeSourceBreakdown: jest.fn(),
  formatCurrency: jest.fn((value) => `$${value}`),
  formatMonthLabel: jest.fn((value) => value),
  formatPercentage: jest.fn((value) => `${value}%`),
  getCurrentMonthStart: jest.fn(() => '2026-03-01'),
  getMonthStartValue: jest.fn(),
  isInMonth: jest.fn(),
  shiftMonth: jest.fn(),
}))

const { getExpenseItems } = require('@/components/insights-view')

describe('getExpenseItems', () => {
  it('falls back to a derived expense breakdown when category statuses are unavailable', () => {
    expect(getExpenseItems(undefined, [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '18.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '12.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '7.00' },
    ])).toEqual([
      expect.objectContaining({
        name: 'Food',
        amount: 30,
        summaryLine: 'This month: $30',
        detailLine: '2 transactions',
        secondary: '2 transactions',
      }),
      expect.objectContaining({
        name: 'Fun',
        amount: 7,
        summaryLine: 'This month: $7',
        detailLine: '1 transaction',
        secondary: '1 transaction',
      }),
    ])
  })

  it('prefers summary-backed category statuses when available', () => {
    expect(getExpenseItems([
      {
        category_id: 'cat-food',
        category_name: 'Food',
        category_icon: 'F',
        monthly_limit: '80.00',
        spent: '50.00',
        remaining_budget: '30.00',
      },
    ], [
      { id: 'e1', category_id: 'cat-other', category_name: 'Other', amount: '999.00' },
    ])).toEqual([
      expect.objectContaining({
        name: 'Food',
        amount: 50,
        summaryLine: 'This month: $50',
        detailLine: 'Budget: $80.00',
        secondary: '$30 left',
      }),
    ])
  })
})

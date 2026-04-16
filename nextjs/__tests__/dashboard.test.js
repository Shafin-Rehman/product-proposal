jest.mock('next/link', () => 'mock-link')
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
  useDataChanged: jest.fn(),
}))
jest.mock('@/lib/apiClient', () => ({
  ApiError: class ApiError extends Error {},
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}))
jest.mock('@/lib/demoData', () => ({
  DEMO_MONTH: '2026-03-01',
  demoActivity: [],
  demoBudgetSummary: null,
  demoBudgetTrend: [],
  demoCategoryBudgets: [],
}))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryVisual: jest.fn(),
  getEntryVisual: jest.fn(),
  getInitialsLabel: jest.fn(),
}))
jest.mock('@/lib/financeUtils', () => ({
  buildActivityFeed: jest.fn(),
  buildMonthlySpendTrend: jest.fn(),
  formatCurrency: jest.fn((value) => `$${value}`),
  formatMonthPeriod: jest.fn((value) => value),
  formatShortDate: jest.fn((value) => value),
  getCurrentMonthStart: jest.fn(() => '2026-03-01'),
}))

const { getBudgetCtaLabel } = require('@/components/dashboard-view')

describe('getBudgetCtaLabel', () => {
  it('returns Set budget when only category budgets exist', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: '75.00',
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: '75.00' },
      ],
    })).toBe('Set budget')
  })

  it('returns Edit budget when an overall monthly limit exists', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: '125.00',
      total_budget: '125.00',
    })).toBe('Edit budget')
  })
})

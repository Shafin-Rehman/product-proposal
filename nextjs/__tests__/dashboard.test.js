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
  getCategoryVisual: jest.fn((value) => ({
    label: value,
    color: '#123456',
    soft: '#abcdef',
    symbol: value?.[0] || '?',
  })),
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
  isInMonth: jest.fn(),
}))

const { buildDerivedCategoryCards, getBudgetCtaLabel, getBudgetHintText, getCategoryCards } = require('@/components/dashboard-view')

describe('getBudgetCtaLabel', () => {
  it('returns Set budget when no budgets exist', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [],
    })).toBe('Set budget')
  })

  it('returns Set overall limit when only category budgets exist', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: '75.00',
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: '75.00' },
      ],
    })).toBe('Set overall limit')
  })

  it('returns Edit budget when an overall monthly limit exists', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: '125.00',
      total_budget: '125.00',
    })).toBe('Edit budget')
  })
})

describe('getBudgetHintText', () => {
  it('explains that the sheet controls the overall monthly cap when no budgets exist', () => {
    expect(getBudgetHintText({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [],
    })).toBe('Set an overall monthly limit here to control the monthly cap and overall-budget alerts.')
  })

  it('clarifies that category budgets already exist when there is no overall limit', () => {
    expect(getBudgetHintText({
      monthly_limit: null,
      total_budget: '75.00',
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: '75.00' },
      ],
    })).toBe('Category budgets are already set. Add an overall monthly limit here to control the monthly cap and overall-budget alerts.')
  })

  it('shows the current overall monthly limit when one exists', () => {
    expect(getBudgetHintText({
      monthly_limit: '125.00',
      total_budget: '125.00',
    })).toBe('Current limit: $125.00. Changes take effect immediately.')
  })
})

describe('getCategoryCards', () => {
  it('falls back to derived expense cards when category statuses are unavailable', () => {
    expect(getCategoryCards(undefined, [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '30.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '20.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '50.00' },
    ])).toEqual([
      expect.objectContaining({ name: 'Food', amount: 50, progress: 50, note: '50% of spend' }),
      expect.objectContaining({ name: 'Fun', amount: 50, progress: 50, note: '50% of spend' }),
    ])
  })

  it('prefers summary category statuses when they are available', () => {
    expect(getCategoryCards([
      {
        category_id: 'cat-food',
        category_name: 'Food',
        category_icon: 'F',
        monthly_limit: '80.00',
        spent: '50.00',
        remaining_budget: '30.00',
        progress_percentage: 62.5,
      },
    ], [
      { id: 'e1', category_id: 'cat-other', category_name: 'Other', amount: '999.00' },
    ])).toEqual([
      expect.objectContaining({ name: 'Food', amount: 50, progress: 62.5, note: '$30 left' }),
    ])
  })
})

describe('buildDerivedCategoryCards', () => {
  it('groups live expenses by category and calculates share-based fallback cards', () => {
    expect(buildDerivedCategoryCards([
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '25.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '15.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '10.00' },
    ])).toEqual([
      expect.objectContaining({ name: 'Food', amount: 40, progress: 80, note: '80% of spend' }),
      expect.objectContaining({ name: 'Fun', amount: 10, progress: 20, note: '20% of spend' }),
    ])
  })
})

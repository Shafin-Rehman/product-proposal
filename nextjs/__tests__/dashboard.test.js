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

const {
  buildDerivedCategoryCards,
  getBudgetCtaLabel,
  getBudgetHintText,
  getBudgetHudModel,
  getBudgetPressureHighlight,
  getCategoryCards,
  getMonthProgressState,
} = require('@/components/dashboard-view')

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

  it('returns Set budget when category statuses only come from spending', () => {
    expect(getBudgetCtaLabel({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: null, spent: '75.00' },
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

  it('does not claim category budgets already exist for spend-only statuses', () => {
    expect(getBudgetHintText({
      monthly_limit: null,
      total_budget: null,
      category_statuses: [
        { category_id: '11111111-1111-4111-8111-111111111111', monthly_limit: null, spent: '75.00' },
      ],
    })).toBe('Set an overall monthly limit here to control the monthly cap and overall-budget alerts.')
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

  it('falls back to derived expense cards when category statuses do not include real budgets', () => {
    expect(getCategoryCards([
      {
        category_id: 'cat-food',
        category_name: 'Food',
        category_icon: 'F',
        monthly_limit: null,
        spent: '50.00',
        remaining_budget: null,
        progress_percentage: 0,
      },
    ], [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '30.00' },
      { id: 'e2', category_id: 'cat-food', category_name: 'Food', amount: '20.00' },
      { id: 'e3', category_id: 'cat-fun', category_name: 'Fun', amount: '50.00' },
    ])).toEqual([
      expect.objectContaining({ name: 'Food', amount: 50, progress: 50, note: '50% of spend' }),
      expect.objectContaining({ name: 'Fun', amount: 50, progress: 50, note: '50% of spend' }),
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

describe('getMonthProgressState', () => {
  it('uses the current UTC date for live current-month days remaining', () => {
    expect(getMonthProgressState('2026-03-01', {
      observedDayCount: 3,
      referenceDate: new Date('2026-03-21T12:00:00Z'),
    })).toEqual({
      monthLength: 31,
      activeDay: 21,
      daysRemaining: 11,
      isCurrentMonth: true,
    })
  })

  it('falls back to observed dashboard trend days for sample or non-current months', () => {
    expect(getMonthProgressState('2026-03-01', {
      observedDayCount: 15,
      referenceDate: new Date('2026-04-21T12:00:00Z'),
    })).toEqual({
      monthLength: 31,
      activeDay: 15,
      daysRemaining: 17,
      isCurrentMonth: false,
    })
  })
})

describe('getBudgetHudModel', () => {
  it('returns a no-budget HUD state when only live spend is available', () => {
    expect(getBudgetHudModel({
      month: '2026-03-01',
      total_income: '1200.00',
      total_expenses: '450.00',
      total_budget: null,
      remaining_budget: null,
      threshold_exceeded: false,
    }, {
      month: '2026-03-01',
      observedDayCount: 10,
      referenceDate: new Date('2026-03-10T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      tone: 'neutral',
      badge: 'No budget',
      value: '$450 spent',
      hasBudget: false,
      progressWidth: '0%',
      metrics: [
        expect.objectContaining({ label: 'Spent', value: '$450' }),
        expect.objectContaining({ label: 'Income', value: '$1200' }),
        expect.objectContaining({ label: 'Net this month', value: '$750' }),
      ],
    }))
  })

  it('returns a near-limit HUD state at eighty percent used', () => {
    expect(getBudgetHudModel({
      month: '2026-03-01',
      total_income: '2000.00',
      total_expenses: '800.00',
      total_budget: '1000.00',
      remaining_budget: '200.00',
      threshold_exceeded: false,
    }, {
      month: '2026-03-01',
      observedDayCount: 20,
      referenceDate: new Date('2026-03-20T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      tone: 'warning',
      badge: 'Near limit',
      value: '$200 left',
      progressWidth: '80%',
      isNearLimit: true,
      daysRemaining: 12,
      dailyAllowance: 16.67,
    }))
  })

  it('returns an over-budget HUD state with a corrective daily allowance', () => {
    expect(getBudgetHudModel({
      month: '2026-03-01',
      total_income: '900.00',
      total_expenses: '1100.00',
      total_budget: '1000.00',
      remaining_budget: '-100.00',
      threshold_exceeded: true,
    }, {
      month: '2026-03-01',
      observedDayCount: 25,
      referenceDate: new Date('2026-03-25T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      tone: 'warning',
      badge: 'Over budget',
      value: '$100 over',
      isOverBudget: true,
      daysRemaining: 7,
      dailyAllowance: -14.29,
    }))
  })
})

describe('getBudgetPressureHighlight', () => {
  it('prioritizes the strongest over-budget category', () => {
    expect(getBudgetPressureHighlight({
      category_statuses: [
        {
          category_id: 'cat-food',
          category_name: 'Food',
          monthly_limit: '100.00',
          spent: '140.00',
          remaining_budget: '-40.00',
          progress_percentage: 140,
        },
        {
          category_id: 'cat-fun',
          category_name: 'Fun',
          monthly_limit: '100.00',
          spent: '120.00',
          remaining_budget: '-20.00',
          progress_percentage: 120,
        },
      ],
    })).toEqual({
      tone: 'warning',
      label: 'Strongest overspend',
      title: 'Food',
      detail: '$40 over budget right now.',
    })
  })

  it('falls back to the top spend-share category when no category budgets exist', () => {
    expect(getBudgetPressureHighlight({
      category_statuses: [],
    }, [
      { id: 'e1', category_id: 'cat-food', category_name: 'Food', amount: '60.00' },
      { id: 'e2', category_id: 'cat-fun', category_name: 'Fun', amount: '40.00' },
    ])).toEqual({
      tone: 'neutral',
      label: 'Top spend area',
      title: 'Food',
      detail: '60% of spend this month.',
    })
  })
})

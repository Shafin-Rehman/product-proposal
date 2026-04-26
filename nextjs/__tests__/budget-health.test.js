const {
  BUDGET_NEAR_LIMIT_RATIO,
  BUDGET_WATCH_RATIO,
  buildBudgetPressureHighlight,
  buildCategoryBudgetHealth,
  buildFinancialHealth,
  buildOverallBudgetHealth,
} = require('@/lib/budgetHealth')

describe('buildOverallBudgetHealth', () => {
  it('returns a loading state while summary data is pending', () => {
    expect(buildOverallBudgetHealth({
      summary: null,
      availability: 'loading',
      month: '2026-03-01',
      referenceDate: new Date('2026-03-10T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      key: 'loading',
      label: 'Waiting',
      tone: 'neutral',
      primaryValue: 'Waiting on live totals',
    }))
  })

  it('returns an unavailable state when live summary data fails', () => {
    expect(buildOverallBudgetHealth({
      summary: null,
      availability: 'unavailable',
      month: '2026-03-01',
    })).toEqual(expect.objectContaining({
      key: 'unavailable',
      label: 'Unavailable',
      tone: 'neutral',
      primaryValue: 'Budget unavailable',
    }))
  })

  it('returns a no-budget state when no budget exists', () => {
    expect(buildOverallBudgetHealth({
      summary: {
        month: '2026-03-01',
        total_income: '1200.00',
        total_expenses: '450.00',
        total_budget: null,
        remaining_budget: null,
      },
      availability: 'ready',
      month: '2026-03-01',
      referenceDate: new Date('2026-03-10T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      key: 'no_budget',
      label: 'No budget',
      tone: 'neutral',
      primaryValue: '$450.00 spent',
      totalBudget: null,
    }))
  })

  it('returns an on-track state when spending pace is healthy', () => {
    expect(buildOverallBudgetHealth({
      summary: {
        month: '2026-03-01',
        total_income: '2000.00',
        total_expenses: '400.00',
        total_budget: '1000.00',
        remaining_budget: '600.00',
        threshold_exceeded: false,
      },
      availability: 'ready',
      month: '2026-03-01',
      referenceDate: new Date('2026-03-10T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      key: 'on_track',
      label: 'On track',
      tone: 'positive',
      primaryValue: '$600.00 left',
    }))
  })

  it('returns a near-limit state at exactly the canonical threshold', () => {
    expect(BUDGET_NEAR_LIMIT_RATIO).toBe(0.8)

    expect(buildOverallBudgetHealth({
      summary: {
        month: '2026-03-01',
        total_income: '2000.00',
        total_expenses: '800.00',
        total_budget: '1000.00',
        remaining_budget: '200.00',
        threshold_exceeded: false,
      },
      availability: 'ready',
      month: '2026-03-01',
      referenceDate: new Date('2026-03-20T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      key: 'near_limit',
      label: 'Near limit',
      tone: 'warning',
      primaryValue: '$200.00 left',
    }))
  })

  it('returns an over-budget state when remaining budget is negative', () => {
    expect(buildOverallBudgetHealth({
      summary: {
        month: '2026-03-01',
        total_income: '900.00',
        total_expenses: '1100.00',
        total_budget: '1000.00',
        remaining_budget: '-100.00',
        threshold_exceeded: false,
      },
      availability: 'ready',
      month: '2026-03-01',
      referenceDate: new Date('2026-03-25T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      key: 'over_budget',
      label: 'Over budget',
      tone: 'danger',
      primaryValue: '$100.00 over',
    }))
  })

  it('returns an over-budget state when threshold_exceeded is true', () => {
    expect(buildOverallBudgetHealth({
      summary: {
        month: '2026-03-01',
        total_income: '1200.00',
        total_expenses: '1000.00',
        total_budget: '1000.00',
        remaining_budget: '0.00',
        threshold_exceeded: true,
      },
      availability: 'ready',
      month: '2026-03-01',
      referenceDate: new Date('2026-03-21T12:00:00Z'),
    })).toEqual(expect.objectContaining({
      key: 'over_budget',
      tone: 'danger',
    }))
  })

  it('uses category-budget total when no explicit monthly limit exists', () => {
    expect(buildOverallBudgetHealth({
      summary: {
        month: '2026-03-01',
        monthly_limit: null,
        total_budget: '600.00',
        total_income: '1400.00',
        total_expenses: '250.00',
        remaining_budget: '350.00',
        threshold_exceeded: false,
      },
      availability: 'ready',
      month: '2026-03-01',
    })).toEqual(expect.objectContaining({
      key: 'on_track',
      budgetSource: 'category_total',
      totalBudget: 600,
    }))
  })
})

describe('buildFinancialHealth', () => {
  it('returns a positive cash-flow state', () => {
    expect(buildFinancialHealth({
      summary: { total_income: '2000.00', total_expenses: '1200.00' },
      availability: 'ready',
    })).toEqual(expect.objectContaining({
      key: 'positive_cash_flow',
      label: 'Positive cash flow',
      tone: 'positive',
      valueText: '$800.00 ahead',
      detailText: 'Income exceeds expenses this month.',
    }))
  })

  it('returns a negative cash-flow state', () => {
    expect(buildFinancialHealth({
      summary: { total_income: '900.00', total_expenses: '1200.00' },
      availability: 'ready',
    })).toEqual(expect.objectContaining({
      key: 'negative_cash_flow',
      label: 'Negative cash flow',
      tone: 'danger',
      valueText: '$300.00 behind',
      detailText: 'Expenses exceed income this month.',
    }))
  })

  it('returns a break-even state when income matches expenses', () => {
    expect(buildFinancialHealth({
      summary: { total_income: '1200.00', total_expenses: '1200.00' },
      availability: 'ready',
    })).toEqual(expect.objectContaining({
      key: 'break_even',
      label: 'Break even',
      tone: 'neutral',
      valueText: '$0.00',
      detailText: 'Income matches expenses this month.',
    }))
  })
})

describe('buildCategoryBudgetHealth', () => {
  it('returns no-budget when no limit and no spend exist', () => {
    expect(buildCategoryBudgetHealth({
      monthlyLimit: null,
      spent: '0.00',
      actualsAvailable: true,
    })).toEqual(expect.objectContaining({
      key: 'no_budget',
      label: 'No budget',
      tone: 'neutral',
      remainingText: 'No budget set',
    }))
  })

  it('returns unplanned spend when money lands without a budget', () => {
    expect(buildCategoryBudgetHealth({
      monthlyLimit: null,
      spent: '18.25',
      actualsAvailable: true,
    })).toEqual(expect.objectContaining({
      key: 'unplanned_spend',
      label: 'Unplanned spend',
      tone: 'warning',
      progressPercentage: 100,
    }))
  })

  it('returns on-track for healthy planned spending', () => {
    expect(buildCategoryBudgetHealth({
      monthlyLimit: '100.00',
      spent: '40.00',
      actualsAvailable: true,
    })).toEqual(expect.objectContaining({
      key: 'on_track',
      label: 'On track',
      tone: 'positive',
      remainingAmount: 60,
    }))
  })

  it('returns near-limit at eighty percent', () => {
    expect(buildCategoryBudgetHealth({
      monthlyLimit: '100.00',
      spent: '80.00',
      actualsAvailable: true,
    })).toEqual(expect.objectContaining({
      key: 'near_limit',
      label: 'Near limit',
      tone: 'warning',
      remainingAmount: 20,
    }))
  })

  it('returns watch between watch ratio and near-limit', () => {
    expect(BUDGET_WATCH_RATIO).toBe(0.6)
    expect(buildCategoryBudgetHealth({
      monthlyLimit: '100.00',
      spent: '65.00',
      actualsAvailable: true,
    })).toEqual(expect.objectContaining({
      key: 'watch',
      label: 'Watch',
      tone: 'caution',
      remainingAmount: 35,
    }))
  })

  it('returns over-budget when spending passes the limit', () => {
    expect(buildCategoryBudgetHealth({
      monthlyLimit: '100.00',
      spent: '120.00',
      actualsAvailable: true,
    })).toEqual(expect.objectContaining({
      key: 'over_budget',
      label: 'Over budget',
      tone: 'danger',
      remainingAmount: -20,
    }))
  })

  it('returns actual-unavailable when a plan exists but actual spend is missing', () => {
    expect(buildCategoryBudgetHealth({
      monthlyLimit: '100.00',
      spent: null,
      actualsAvailable: false,
    })).toEqual(expect.objectContaining({
      key: 'actual_unavailable',
      label: 'Actual unavailable',
      tone: 'neutral',
      remainingText: 'Actual spend unavailable',
    }))
  })
})

describe('buildBudgetPressureHighlight', () => {
  it('prioritizes strongest overspend over all other states', () => {
    expect(buildBudgetPressureHighlight({
      categoryStatuses: [
        { category_name: 'Food', monthly_limit: '100.00', spent: '130.00', progress_percentage: 130 },
        { category_name: 'Fun', monthly_limit: '100.00', spent: '90.00', progress_percentage: 90 },
      ],
    })).toEqual(expect.objectContaining({
      key: 'strongest_overspend',
      tone: 'danger',
      title: 'Food',
    }))
  })

  it('falls back to highest pressure when budgets exist but none are over', () => {
    expect(buildBudgetPressureHighlight({
      categoryStatuses: [
        { category_name: 'Food', monthly_limit: '100.00', spent: '92.00', progress_percentage: 92 },
        { category_name: 'Fun', monthly_limit: '100.00', spent: '60.00', progress_percentage: 60 },
      ],
    })).toEqual(expect.objectContaining({
      key: 'highest_pressure',
      tone: 'warning',
      title: 'Food',
      detail: '92% used with $8.00 left.',
    }))
  })

  it('falls back to top spend area when no budgeted categories exist', () => {
    expect(buildBudgetPressureHighlight({
      categoryStatuses: [],
      fallbackSpendCards: [{ name: 'Food', note: '60% of spend' }],
    })).toEqual(expect.objectContaining({
      key: 'top_spend_area',
      tone: 'neutral',
      title: 'Food',
    }))
  })

  it('returns waiting when there is no category signal at all', () => {
    expect(buildBudgetPressureHighlight({
      categoryStatuses: [],
      fallbackSpendCards: [],
    })).toEqual(expect.objectContaining({
      key: 'waiting',
      tone: 'neutral',
      title: 'Waiting on categories',
    }))
  })
})

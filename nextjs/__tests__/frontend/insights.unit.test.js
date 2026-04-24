jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/budget', () => ({ buildBudgetSummary: jest.fn() }))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryVisual: jest.fn((value) => ({
    label: value || 'Uncategorized',
    color: `#${String(value || 'uncat').length}23456`,
    soft: 'rgba(120, 140, 160, 0.18)',
    symbol: (value || '?').slice(0, 1).toUpperCase(),
  })),
}))

const {
  buildBudgetHealth,
  buildCashFlowSeries,
  buildCategoryMovers,
  buildComparisonMetrics,
  buildDailySpendSeries,
} = require('@/lib/insights')

describe('buildComparisonMetrics', () => {
  it('builds compact month-over-month metrics with the restored tones', () => {
    const metrics = buildComparisonMetrics(
      { total_income: '3229.00', total_expenses: '1011.36', total_budget: '2600.00', remaining_budget: '1588.64' },
      { total_income: '3010.00', total_expenses: '934.18', total_budget: '2600.00', remaining_budget: '1665.82' }
    )

    expect(metrics).toEqual([
      expect.objectContaining({ id: 'income', deltaTone: 'positive' }),
      expect.objectContaining({ id: 'expenses', deltaTone: 'warning' }),
      expect.objectContaining({ id: 'net', deltaTone: 'positive' }),
      expect.objectContaining({ id: 'budget-left', deltaTone: 'warning' }),
    ])
  })
})

describe('buildCategoryMovers', () => {
  it('keeps status labels aligned with the restored budget language', () => {
    const movers = buildCategoryMovers(
      [
        { category_id: 'shopping', category_name: 'Shopping', spent: '347.00', monthly_limit: '500.00', remaining_budget: '153.00', progress_percentage: 69.4 },
        { category_id: 'groceries', category_name: 'Groceries', spent: '289.00', monthly_limit: '360.00', remaining_budget: '71.00', progress_percentage: 80.28 },
      ],
      [
        { category_id: 'shopping', category_name: 'Shopping', spent: '271.00', monthly_limit: '500.00', remaining_budget: '229.00', progress_percentage: 54.2 },
        { category_id: 'groceries', category_name: 'Groceries', spent: '248.00', monthly_limit: '360.00', remaining_budget: '112.00', progress_percentage: 68.9 },
      ]
    )

    expect(movers).toEqual([
      expect.objectContaining({ id: 'shopping', statusLabel: 'Watch', tone: 'caution' }),
      expect.objectContaining({ id: 'groceries', statusLabel: 'Near limit', tone: 'warning' }),
    ])
  })
})

describe('buildBudgetHealth', () => {
  it('returns pressure categories with On track, Watch, Near limit, and Over budget states', () => {
    const health = buildBudgetHealth({
      total_budget: '2600.00',
      total_expenses: '1011.36',
      remaining_budget: '1588.64',
      category_statuses: [
        { category_id: 'fun', category_name: 'Fun', spent: '94.56', monthly_limit: '180.00', remaining_budget: '85.44', progress_percentage: 52.53 },
        { category_id: 'shopping', category_name: 'Shopping', spent: '347.00', monthly_limit: '500.00', remaining_budget: '153.00', progress_percentage: 69.4 },
        { category_id: 'groceries', category_name: 'Groceries', spent: '289.00', monthly_limit: '360.00', remaining_budget: '71.00', progress_percentage: 80.28 },
        { category_id: 'rent', category_name: 'Rent', spent: '910.00', monthly_limit: '900.00', remaining_budget: '-10.00', progress_percentage: 101.1 },
      ],
    })

    expect(health.statusLabel).toBe('On track')
    expect(health.pressureCategories).toEqual([
      expect.objectContaining({ id: 'rent', statusLabel: 'Over budget', tone: 'danger' }),
      expect.objectContaining({ id: 'groceries', statusLabel: 'Near limit', tone: 'warning' }),
      expect.objectContaining({ id: 'shopping', statusLabel: 'Watch', tone: 'caution' }),
    ])
  })

  it('returns a neutral no-budget state when no monthly budget exists', () => {
    expect(buildBudgetHealth({ total_budget: null, total_expenses: '45.00', remaining_budget: null, category_statuses: [] })).toEqual(
      expect.objectContaining({ tone: 'neutral', statusLabel: 'No budget' })
    )
  })
})

describe('buildCashFlowSeries', () => {
  it('builds a six-month range summary and range label', () => {
    const cashFlow = buildCashFlowSeries(
      ['2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01'],
      [
        { month: '2025-10-01', total_expenses: '980.00' },
        { month: '2025-11-01', total_expenses: '1160.00' },
        { month: '2025-12-01', total_expenses: '1288.00' },
        { month: '2026-01-01', total_expenses: '1064.00' },
        { month: '2026-02-01', total_expenses: '934.18' },
        { month: '2026-03-01', total_expenses: '1011.36' },
      ],
      [
        { month: '2025-10-01', total_income: '2890.00' },
        { month: '2025-11-01', total_income: '3015.00' },
        { month: '2025-12-01', total_income: '3102.00' },
        { month: '2026-01-01', total_income: '2988.00' },
        { month: '2026-02-01', total_income: '3010.00' },
        { month: '2026-03-01', total_income: '3229.00' },
      ]
    )

    expect(cashFlow.rangeLabel).toBe('Oct 2025 - Mar 2026')
    expect(cashFlow.summary).toEqual(
      expect.objectContaining({ totalIncome: 18234, totalExpenses: 6437.54, totalNet: 11796.46, averageNet: 1966.08 })
    )
  })
})

describe('buildDailySpendSeries', () => {
  it('includes activeDayAverage for the restored rhythm view', () => {
    const daily = buildDailySpendSeries(
      [
        { day: '2026-03-18', total_spend: '18.50' },
        { day: '2026-03-21', total_spend: '89.50' },
        { day: '2026-03-22', total_spend: '147.00' },
      ],
      '2026-03-01'
    )

    expect(daily.activeDays).toBe(3)
    expect(daily.totalAmount).toBe(255)
    expect(daily.activeDayAverage).toBe(85)
    expect(daily.peakDay).toEqual(expect.objectContaining({ day: 22, amount: 147 }))
  })
})

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
  buildDailySpendDetails,
  buildDailySpendSeries,
} = require('@/lib/insights')

describe('buildComparisonMetrics', () => {
  it('builds neutral metrics when summaries are empty or missing', () => {
    const metrics = buildComparisonMetrics({}, null)
    expect(metrics).toEqual([
      expect.objectContaining({ id: 'income', deltaTone: 'neutral' }),
      expect.objectContaining({ id: 'expenses', deltaTone: 'neutral' }),
      expect.objectContaining({ id: 'net', deltaTone: 'neutral' }),
      expect.objectContaining({ id: 'budget-left', deltaTone: 'neutral' }),
    ])
  })

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
  it('returns an empty list when both months lack data', () => {
    expect(buildCategoryMovers([], [])).toEqual([])
  })

  it('treats missing progress and limits as zero progress without throwing', () => {
    const movers = buildCategoryMovers(
      [{ category_id: 'a', category_name: 'Alpha', spent: '40.00' }],
      [{ category_id: 'a', category_name: 'Alpha', spent: '10.00' }]
    )
    expect(movers[0].progressValue).toBe(0)
    expect(movers[0].statusLabel).toBe('No budget')
  })

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
  it('uses overall progress boundaries: 0% is on track, 100% is over budget', () => {
    const atZero = buildBudgetHealth({
      total_budget: '1000.00',
      total_expenses: '0',
      remaining_budget: '1000.00',
      category_statuses: [],
    })
    expect(atZero.progressValue).toBe(0)
    expect(atZero.tone).toBe('positive')
    expect(atZero.statusLabel).toBe('On track')

    const atFull = buildBudgetHealth({
      total_budget: '1000.00',
      total_expenses: '1000.00',
      remaining_budget: '0',
      category_statuses: [],
    })
    expect(atFull.progressValue).toBe(100)
    expect(atFull.tone).toBe('danger')
    expect(atFull.statusLabel).toBe('Over budget')
  })

  it('surfaces category progress at exactly 0 and 100 in pressure categories when budgets exist', () => {
    const health = buildBudgetHealth({
      total_budget: '2000.00',
      total_expenses: '600.00',
      remaining_budget: '1400.00',
      category_statuses: [
        {
          category_id: 'just-started',
          category_name: 'Just started',
          spent: '0.01',
          monthly_limit: '500.00',
          remaining_budget: '499.99',
          progress_percentage: 0,
        },
        {
          category_id: 'at-cap',
          category_name: 'At cap',
          spent: '200.00',
          monthly_limit: '200.00',
          remaining_budget: '0',
          progress_percentage: 100,
        },
      ],
    })

    const byId = Object.fromEntries(health.pressureCategories.map((item) => [item.id, item]))
    expect(byId['just-started'].progressValue).toBe(0)
    expect(byId['just-started'].tone).toBe('positive')
    expect(byId['at-cap'].progressValue).toBe(100)
    expect(byId['at-cap'].tone).toBe('danger')
  })

  it('handles empty category_statuses and partially missing budget fields', () => {
    const minimal = buildBudgetHealth({
      total_budget: '500.00',
      total_expenses: '100.00',
      remaining_budget: null,
      category_statuses: [
        {
          category_id: 'loose',
          category_name: 'Loose',
          spent: '100.00',
          monthly_limit: null,
          remaining_budget: null,
          progress_percentage: null,
        },
      ],
    })
    expect(minimal.pressureCategories).toEqual([])
    expect(minimal.tone).toBe('positive')
  })

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
  it('handles an empty month window without throwing', () => {
    const cashFlow = buildCashFlowSeries([], [], [])
    expect(cashFlow.series).toEqual([])
    expect(cashFlow.rangeLabel).toBeNull()
    expect(cashFlow.summary).toEqual(
      expect.objectContaining({ totalIncome: 0, totalExpenses: 0, totalNet: 0, averageNet: 0 })
    )
  })

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

describe('buildDailySpendDetails', () => {
  it('uses stable fallback ids from row fields so reordering raw rows does not change ids', () => {
    const row = {
      id: null,
      occurred_on: '2026-03-15',
      amount: '12.50',
      title: 'Coffee',
      category_name: 'Food',
    }
    const firstOrder = buildDailySpendDetails([row, { ...row, id: null, amount: '40.00', title: 'Dinner' }])
    const secondOrder = buildDailySpendDetails([{ ...row, id: null, amount: '40.00', title: 'Dinner' }, row])

    const coffeeFirst = firstOrder.find((item) => item.title === 'Coffee')
    const coffeeSecond = secondOrder.find((item) => item.title === 'Coffee')
    expect(coffeeFirst.id).toBe(coffeeSecond.id)
    expect(coffeeFirst.id).toMatch(/^daily-expense-fallback:2026-03-15:12\.5:Coffee:Food$/)
  })

  it('appends an ordinal when fallback rows collide on day, amount, title, and category', () => {
    const duplicate = {
      id: null,
      occurred_on: '2026-03-20',
      amount: '5.00',
      title: 'Snack',
      category_name: 'Food',
    }
    const details = buildDailySpendDetails([duplicate, { ...duplicate, id: null }])
    const ids = details.map((item) => item.id).sort()
    expect(ids[0]).toBe('daily-expense-fallback:2026-03-20:5:Snack:Food')
    expect(ids[1]).toBe('daily-expense-fallback:2026-03-20:5:Snack:Food:2')
  })

  it('preserves real expense ids from the database when present', () => {
    const details = buildDailySpendDetails([
      { id: 'exp-uuid-1', occurred_on: '2026-03-01', amount: '10', title: 'A', category_name: 'Cat' },
    ])
    expect(details[0].id).toBe('exp-uuid-1')
  })

  it('skips rows with no parseable date', () => {
    expect(buildDailySpendDetails([{ id: 'x', occurred_on: null, amount: '1', title: 'Nope', category_name: 'C' }])).toEqual([])
  })
})

describe('buildDailySpendSeries', () => {
  it('returns zeroed aggregates when there are no daily totals', () => {
    const daily = buildDailySpendSeries([], '2026-03-01')
    expect(daily.totalAmount).toBe(0)
    expect(daily.activeDays).toBe(0)
    expect(daily.peakDay).toBeNull()
    expect(daily.series.length).toBe(31)
  })

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

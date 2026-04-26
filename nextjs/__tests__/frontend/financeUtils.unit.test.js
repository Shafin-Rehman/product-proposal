const { UNCATEGORIZED_EXPENSE_DISPLAY } = require('@/lib/financeVisuals')
const {
  parseCalendarDate,
  isInMonth,
  shiftMonth,
  formatCurrency,
  formatMonthPeriod,
  buildMonthlySpendTrend,
  buildActivityFeed,
  buildDailySpendDetailsFromExpenses,
  getEditFormCategoryName,
  resolveCategoryOrSourceMutation,
  groupActivityByDate,
  buildIncomeSourceBreakdown,
  buildRecentCashFlow,
  buildCumulativeDailyTotals,
  buildTrendChartAxes,
} = require('@/lib/financeUtils')

describe('parseCalendarDate', () => {
  it('returns null for falsy input', () => {
    expect(parseCalendarDate(null)).toBeNull()
    expect(parseCalendarDate('')).toBeNull()
  })

  it('parses a YYYY-MM-DD string into the correct UTC date parts', () => {
    const d = parseCalendarDate('2026-03-15')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(2)
    expect(d.getUTCDate()).toBe(15)
  })
})

describe('isInMonth', () => {
  it('returns true for a matching month and false for a different one', () => {
    expect(isInMonth('2026-03-15', '2026-03-01')).toBe(true)
    expect(isInMonth('2026-04-01', '2026-03-01')).toBe(false)
  })
})

describe('shiftMonth', () => {
  it('moves forward by a positive offset', () => {
    expect(shiftMonth('2026-01-01', 2)).toBe('2026-03-01')
  })

  it('moves backward and wraps across year boundaries', () => {
    expect(shiftMonth('2026-01-01', -1)).toBe('2025-12-01')
  })
})

describe('formatCurrency', () => {
  it('formats a typical dollar amount', () => {
    expect(formatCurrency(25)).toBe('$25.00')
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('returns "--" for non-finite values', () => {
    expect(formatCurrency('banana')).toBe('--')
    expect(formatCurrency(Infinity)).toBe('--')
  })
})

describe('formatMonthPeriod', () => {
  it('returns "Month unavailable" for null input', () => {
    expect(formatMonthPeriod(null)).toBe('Month unavailable')
  })

  it('formats a valid date string as abbreviated month and full year', () => {
    const label = formatMonthPeriod('2026-03-01')
    expect(label).toContain('Mar')
    expect(label).toContain('2026')
  })
})

describe('buildMonthlySpendTrend', () => {
  it('builds correct cumulative day-by-day totals', () => {
    const expenses = [
      { id: 1, amount: '50.00', date: '2025-01-10', created_at: '2025-01-10T00:00:00Z' },
      { id: 2, amount: '30.00', date: '2025-01-20', created_at: '2025-01-20T00:00:00Z' },
    ]
    const points = buildMonthlySpendTrend(expenses, '2025-01-01')
    expect(points[9]).toBe(50)
    expect(points[19]).toBe(80)
    expect(points[30]).toBe(80)
  })
})

describe('buildActivityFeed', () => {
  it('maps an expense row to a correctly shaped feed entry', () => {
    const expenseRow = { id: 'e1', amount: '25.00', date: '2026-03-10', created_at: '2026-03-10T00:00:00Z', description: 'Coffee', category_name: 'Dining' }
    const [entry] = buildActivityFeed([expenseRow], [])
    expect(entry.kind).toBe('expense')
    expect(entry.id).toBe('expense-e1')
    expect(entry.amount).toBe(25)
    expect(entry.title).toBe('Coffee')
  })

  it('uses a compact no-category label for expenses without a category name', () => {
    const expenseRow = { id: 'e2', amount: '5.00', date: '2026-03-10', created_at: '2026-03-10T00:00:00Z', description: '' }
    const [entry] = buildActivityFeed([expenseRow], [])
    expect(entry.chip).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
  })

  it('sorts combined entries with the most recent first', () => {
    const expenses = [{ id: 'e1', amount: '10.00', date: '2026-03-05', created_at: '2026-03-25T09:00:00Z' }]
    const income = [{ id: 'i1', amount: '2000.00', date: '2026-03-20', created_at: '2026-03-01T09:00:00Z', source_name: 'Payroll' }]
    const feed = buildActivityFeed(expenses, income)
    expect(feed[0].kind).toBe('income')
  })

  it('uses created_at as a tie-breaker when occurred dates match', () => {
    const expenses = [{ id: 'e1', amount: '10.00', date: '2026-03-20', created_at: '2026-03-20T08:00:00Z' }]
    const income = [{ id: 'i1', amount: '2000.00', date: '2026-03-20', created_at: '2026-03-20T09:00:00Z', source_name: 'Payroll' }]
    const feed = buildActivityFeed(expenses, income)
    expect(feed[0].kind).toBe('income')
  })

  it('does not invent a month-style note for income entries without notes', () => {
    const income = [{ id: 'i1', amount: '2000.00', date: '2026-03-20', source_name: 'Payroll' }]
    const [entry] = buildActivityFeed([], income)
    expect(entry.note).toBe('')
  })

  it('threads category_icon and source_icon for list visuals', () => {
    const [exp] = buildActivityFeed([{
      id: 'e1',
      amount: '10.00',
      date: '2026-03-10',
      created_at: '2026-03-10T00:00:00Z',
      category_name: 'Food',
      category_icon: '🥘',
    }], [])
    expect(exp.chip).toBe('Food')
    expect(exp.categoryIcon).toBe('🥘')

    const [inc] = buildActivityFeed([], [{
      id: 'i1',
      amount: '1.00',
      date: '2026-03-20',
      source_name: 'X',
      source_icon: '💰',
    }])
    expect(inc.sourceIcon).toBe('💰')
  })
})

describe('getEditFormCategoryName', () => {
  it('prefers raw category_name over a stale display chip for expenses', () => {
    const name = getEditFormCategoryName({
      kind: 'expense',
      chip: 'Dining',
      raw: { category_name: 'Food' },
    })
    expect(name).toBe('Food')
  })

  it('returns empty when raw category is missing (chip is display-only, not a form value)', () => {
    const name = getEditFormCategoryName({
      kind: 'expense',
      chip: 'No cat',
      raw: { category_name: null },
    })
    expect(name).toBe('')
  })

  it('returns empty when raw income source is missing', () => {
    expect(
      getEditFormCategoryName({ kind: 'income', chip: 'No source', raw: { source_name: null, source_id: null } })
    ).toBe('')
  })
})

describe('resolveCategoryOrSourceMutation (Issue #58 clear-on-edit)', () => {
  const expOpts = [{ id: 'c1', name: 'Food' }, { id: 'c2', name: 'Transit' }]
  const incOpts = [{ id: 's1', name: 'Salary' }]

  it('create expense: no key when unselected, id when selected', () => {
    expect(resolveCategoryOrSourceMutation({ isEdit: false, selectedName: '', options: expOpts, kind: 'expense' })).toEqual({})
    expect(
      resolveCategoryOrSourceMutation({ isEdit: false, selectedName: 'Food', options: expOpts, kind: 'expense' })
    ).toEqual({ category_id: 'c1' })
  })

  it('update expense: null when unselected, id when selected', () => {
    expect(resolveCategoryOrSourceMutation({ isEdit: true, selectedName: '', options: expOpts, kind: 'expense' })).toEqual({
      category_id: null,
    })
    expect(
      resolveCategoryOrSourceMutation({ isEdit: true, selectedName: 'Food', options: expOpts, kind: 'expense' })
    ).toEqual({ category_id: 'c1' })
  })

  it('create income: no key when unselected, id when selected', () => {
    expect(resolveCategoryOrSourceMutation({ isEdit: false, selectedName: '', options: incOpts, kind: 'income' })).toEqual({})
    expect(
      resolveCategoryOrSourceMutation({ isEdit: false, selectedName: 'Salary', options: incOpts, kind: 'income' })
    ).toEqual({ source_id: 's1' })
  })

  it('update income: null when unselected, id when selected', () => {
    expect(resolveCategoryOrSourceMutation({ isEdit: true, selectedName: '', options: incOpts, kind: 'income' })).toEqual({
      source_id: null,
    })
    expect(
      resolveCategoryOrSourceMutation({ isEdit: true, selectedName: 'Salary', options: incOpts, kind: 'income' })
    ).toEqual({ source_id: 's1' })
  })
})

describe('buildDailySpendDetailsFromExpenses', () => {
  it('maps expense API rows into modal detail entries grouped by day', () => {
    const rows = [
      { id: 'a', amount: '30.00', date: '2026-03-10', description: 'Lunch', category_name: 'Dining' },
      { id: 'b', amount: '10.00', date: '2026-03-10', description: 'Snack', category_name: 'Dining' },
    ]
    const details = buildDailySpendDetailsFromExpenses(rows)
    expect(details).toHaveLength(2)
    expect(details[0].amount).toBe(30)
    expect(details[0].occurredOn).toBe('2026-03-10')
    expect(details[0].categoryName).toBeTruthy()
    expect(details[1].amount).toBe(10)
  })

  it('skips rows without a parseable date', () => {
    expect(buildDailySpendDetailsFromExpenses([{ id: 'x', amount: 5, date: null }])).toEqual([])
  })

  it('assigns distinct fallback ids when the same day has multiple id-less rows with an identical fingerprint', () => {
    const rows = [
      { id: null, amount: '10.00', date: '2026-03-10', description: 'Snack', category_name: 'Dining' },
      { id: null, amount: '10.00', date: '2026-03-10', description: 'Snack', category_name: 'Dining' },
    ]
    const details = buildDailySpendDetailsFromExpenses(rows)
    const ids = details.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids.some((id) => /:2/.test(String(id)))).toBe(true)
  })
})

describe('groupActivityByDate', () => {
  it('groups entries sharing a day and sorts groups newest first', () => {
    const entries = [
      { id: 'a', occurredOn: '2026-03-01' },
      { id: 'b', occurredOn: '2026-03-15' },
      { id: 'c', occurredOn: '2026-03-15' },
    ]
    const groups = groupActivityByDate(entries)
    expect(groups).toHaveLength(2)
    expect(groups[0].key).toBe('2026-03-15')
    expect(groups[0].entries).toHaveLength(2)
  })
})

describe('buildIncomeSourceBreakdown', () => {
  it('groups by source, sums amounts, and ignores entries outside the month', () => {
    const income = [
      { id: 1, source_name: 'Payroll', amount: '2000.00', date: '2026-03-03' },
      { id: 2, source_name: 'Payroll', amount: '500.00', date: '2026-03-18' },
      { id: 3, source_name: 'Freelance', amount: '800.00', date: '2026-02-28' },
    ]
    const result = buildIncomeSourceBreakdown(income, '2026-03-01')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Payroll')
    expect(result[0].amount).toBe(2500)
  })
})

describe('buildRecentCashFlow', () => {
  it('returns the last N months of income, expense, and net totals', () => {
    const expenses = [
      { id: 'e1', amount: '80', date: '2026-01-12' },
      { id: 'e2', amount: '120', date: '2026-02-04' },
      { id: 'e3', amount: '200', date: '2026-03-15' },
      { id: 'e4', amount: '50', date: '2026-03-22' },
    ]
    const income = [
      { id: 'i1', amount: '1000', date: '2026-01-05' },
      { id: 'i2', amount: '1200', date: '2026-02-05' },
      { id: 'i3', amount: '1500', date: '2026-03-02' },
    ]
    const series = buildRecentCashFlow(expenses, income, '2026-03-01', 3)
    expect(series.map((item) => item.month)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
    expect(series[0].incomeAmount).toBe(1000)
    expect(series[0].expenseAmount).toBe(80)
    expect(series[0].netAmount).toBe(920)
    expect(series[2].expenseAmount).toBe(250)
    expect(series[2].netAmount).toBe(1250)
  })

  it('returns an empty array when the month is invalid', () => {
    expect(buildRecentCashFlow([], [], 'nope')).toEqual([])
  })

  it('returns zeroed months when there is no matching data', () => {
    const series = buildRecentCashFlow([], [], '2026-03-01', 2)
    expect(series).toHaveLength(2)
    series.forEach((item) => {
      expect(item.incomeAmount).toBe(0)
      expect(item.expenseAmount).toBe(0)
      expect(item.netAmount).toBe(0)
    })
  })
})

describe('buildCumulativeDailyTotals', () => {
  it('produces one entry per day with running spend totals', () => {
    const expenses = [
      { id: 'e1', amount: '50', date: '2026-03-03' },
      { id: 'e2', amount: '30', date: '2026-03-10' },
      { id: 'e3', amount: '70', date: '2026-03-10' },
    ]
    const series = buildCumulativeDailyTotals(expenses, '2026-03-01')
    expect(series).toHaveLength(31)
    expect(series[2].amount).toBe(50)
    expect(series[9].amount).toBe(150)
    expect(series[30].amount).toBe(150)
  })

  it('returns an empty array for an invalid month', () => {
    expect(buildCumulativeDailyTotals([], 'nope')).toEqual([])
  })
})

describe('buildTrendChartAxes', () => {
  it('returns a pace line, budget line y-coordinate, and axis labels when a budget exists', () => {
    const axes = buildTrendChartAxes({
      budget: 1000,
      monthLength: 31,
      activeDay: 15,
      pointCount: 15,
      width: 312,
      height: 148,
      inset: 18,
    })

    expect(axes.budgetLineY).toBe(18)
    expect(axes.axisLabels).toHaveLength(2)
    expect(axes.axisLabels[0]).toEqual({ y: 130, value: 0 })
    expect(axes.axisLabels[1]).toEqual({ y: 18, value: 1000 })
    expect(axes.paceLine).toMatchObject({ startX: 18, startY: 130 })
    expect(axes.paceLine.endX).toBeGreaterThan(18)
    expect(axes.paceLine.endY).toBeLessThan(130)
    expect(axes.budgetLineLabel).toBe('$1,000.00')
  })

  it('omits pace line and axis labels when no budget is provided', () => {
    const axes = buildTrendChartAxes({
      budget: 0,
      monthLength: 30,
      activeDay: 10,
      pointCount: 10,
      width: 312,
      height: 148,
      inset: 18,
    })
    expect(axes.paceLine).toBeNull()
    expect(axes.budgetLineY).toBeNull()
    expect(axes.axisLabels).toBeNull()
  })
})

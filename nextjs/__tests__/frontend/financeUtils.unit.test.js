const {
  parseCalendarDate,
  isInMonth,
  shiftMonth,
  formatCurrency,
  formatMonthPeriod,
  buildMonthlySpendTrend,
  buildActivityFeed,
  groupActivityByDate,
  buildIncomeSourceBreakdown,
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

  it('sorts combined entries with the most recent first', () => {
    const expenses = [{ id: 'e1', amount: '10.00', date: '2026-03-05', created_at: '2026-03-05' }]
    const income = [{ id: 'i1', amount: '2000.00', date: '2026-03-20', created_at: '2026-03-01', source_name: 'Payroll' }]
    const feed = buildActivityFeed(expenses, income)
    expect(feed[0].kind).toBe('income')
  })

  it('does not invent a month-style note for income entries without notes', () => {
    const income = [{ id: 'i1', amount: '2000.00', date: '2026-03-20', source_name: 'Payroll' }]
    const [entry] = buildActivityFeed([], income)
    expect(entry.note).toBe('')
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

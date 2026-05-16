const { UNCATEGORIZED_EXPENSE_DISPLAY, UNKNOWN_INCOME_DISPLAY } = require('@/lib/financeVisuals')
const {
  getCurrentMonthStart,
  parseCalendarDate,
  isInMonth,
  shiftMonth,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  formatSyncLabel,
  formatPercentage,
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
} = require('@/lib/financeUtils')

describe('financeUtils specification', () => {
  describe('getCurrentMonthStart', () => {
    it('returns the first day of the month for a given date', () => {
      const referenceDay = new Date(Date.UTC(2026, 3, 15))

      const monthStart = getCurrentMonthStart(referenceDay)

      expect(monthStart).toBe('2026-04-01')
    })
  })

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

  describe('formatMonthLabel', () => {
    it('uses a long month and year in UTC for a real calendar value', () => {
      const label = formatMonthLabel('2026-08-10')
      expect(label).toMatch(/August/)
      expect(label).toMatch(/2026/)
    })

    it('returns "This month" when the value does not parse', () => {
      expect(formatMonthLabel('')).toBe('This month')
    })
  })

  describe('formatShortDate', () => {
    it('returns a short month+day in UTC for valid input', () => {
      const s = formatShortDate('2026-02-20')
      expect(s).toMatch(/Feb/)
      expect(s).toMatch(/20/)
    })

    it('returns "Date unavailable" for invalid input', () => {
      expect(formatShortDate('')).toBe('Date unavailable')
    })
  })

  describe('formatSyncLabel', () => {
    it('returns a default when there is no sync time', () => {
      expect(formatSyncLabel(null)).toBe('Waiting for live data')
    })

    it('returns an Updated prefix when a Date is present', () => {
      const d = new Date(2026, 3, 1, 14, 5, 0)
      const label = formatSyncLabel(d)
      expect(label.startsWith('Updated ')).toBe(true)
    })
  })

  describe('formatPercentage', () => {
    it('rounds to an integer percent string', () => {
      expect(formatPercentage(3.2)).toBe('3%')
      expect(formatPercentage('x')).toBe('0%')
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
      const month = '2025-01-01'
      const expenses = [
        { id: 1, amount: '50.00', date: '2025-01-10', created_at: '2025-01-10T00:00:00Z' },
        { id: 2, amount: '30.00', date: '2025-01-20', created_at: '2025-01-20T00:00:00Z' },
      ]

      const points = buildMonthlySpendTrend(expenses, month)

      expect(points[9]).toBe(50)
      expect(points[19]).toBe(80)
      expect(points[30]).toBe(80)
    })

    it('returns an empty array when the month has no positive spend (all zeros or out of month)', () => {
      expect(buildMonthlySpendTrend([], '2025-01-01')).toEqual([])
      expect(buildMonthlySpendTrend(
        [{ id: 1, amount: '0', date: '2025-01-10', created_at: '2025-01-10T00:00:00Z' }],
        '2025-01-01',
      )).toEqual([])
      expect(buildMonthlySpendTrend(
        [{ id: 1, amount: '20', date: '2025-02-10', created_at: '2025-02-10T00:00:00Z' }],
        '2025-01-01',
      )).toEqual([])
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
      expect(entry.merchant).toBe('Coffee')
      expect(entry.note).toBe('')
    })

    it('uses a compact no-category label for expenses without a category name', () => {
      const expenseRow = { id: 'e2', amount: '5.00', date: '2026-03-10', created_at: '2026-03-10T00:00:00Z', description: '' }
      const [entry] = buildActivityFeed([expenseRow], [])
      expect(entry.chip).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    })

    it('does not leak live-mode placeholder text for expenses without descriptions', () => {
      const expenseRow = { id: 'e3', amount: '4.00', date: '2026-03-10', created_at: '2026-03-10T00:00:00Z', description: '', category_name: 'Education' }
      const [entry] = buildActivityFeed([expenseRow], [])
      expect(entry.title).toBe('Education')
      expect(entry.merchant).toBe('')
      expect(entry.note).toBe('')
      expect(Object.values(entry).join(' ')).not.toMatch(/live expense/i)
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

    it('uses notes as the income title and keeps source as merchant when notes are present', () => {
      const income = [{ id: 'i2', amount: '100.00', date: '2026-03-21', source_name: 'Freelance', notes: 'Weekend session' }]
      const [entry] = buildActivityFeed([], income)
      expect(entry.title).toBe('Weekend session')
      expect(entry.merchant).toBe('Freelance')
      expect(entry.note).toBe('Weekend session')
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

    it('returns the raw source name "Income" (not a display placeholder)', () => {
      expect(getEditFormCategoryName({
        kind: 'income',
        chip: UNKNOWN_INCOME_DISPLAY,
        raw: { source_name: 'Income' },
      })).toBe('Income')
    })

  })

  describe('resolveCategoryOrSourceMutation', () => {
    const expOpts = [{ id: 'c1', name: 'Food' }, { id: 'c2', name: 'Transit' }]
    const incOpts = [{ id: 's1', name: 'Salary' }]

    it('leaves new expense payloads without category_id until the member selects a category', () => {
      expect(resolveCategoryOrSourceMutation({ isEdit: false, selectedName: '', options: expOpts, kind: 'expense' })).toEqual({})
      expect(
        resolveCategoryOrSourceMutation({ isEdit: false, selectedName: 'Food', options: expOpts, kind: 'expense' })
      ).toEqual({ category_id: 'c1' })
    })

    it('lets members clear an expense category on edit or set it again from the picker', () => {
      expect(resolveCategoryOrSourceMutation({ isEdit: true, selectedName: '', options: expOpts, kind: 'expense' })).toEqual({
        category_id: null,
      })
      expect(
        resolveCategoryOrSourceMutation({ isEdit: true, selectedName: 'Food', options: expOpts, kind: 'expense' })
      ).toEqual({ category_id: 'c1' })
    })

    it('does not emit ids when free-typed labels do not match any option', () => {
      expect(resolveCategoryOrSourceMutation({
        isEdit: true,
        selectedName: 'Not in list',
        options: expOpts,
        kind: 'expense',
      })).toEqual({})
      expect(resolveCategoryOrSourceMutation({
        isEdit: true,
        selectedName: 'Ghost source',
        options: incOpts,
        kind: 'income',
      })).toEqual({})
    })

    it('returns an empty object when kind is not expense or income', () => {
      expect(resolveCategoryOrSourceMutation({
        isEdit: true,
        selectedName: 'x',
        options: [],
        kind: 'transfer',
      })).toEqual({})
    })

    it('does not emit category or source ids when the matched option has no stable id', () => {
      const opts = [{ id: null, name: 'Food' }]
      expect(resolveCategoryOrSourceMutation({ isEdit: false, selectedName: 'Food', options: opts, kind: 'expense' })).toEqual({})
      expect(resolveCategoryOrSourceMutation({ isEdit: false, selectedName: 'Food', options: opts, kind: 'income' })).toEqual({})
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

    it('groups missing or blank source_name under an empty key (display as no source in UI)', () => {
      const income = [
        { id: 1, source_name: null, amount: '100.00', date: '2026-03-03' },
        { id: 2, source_name: '', amount: '50.00', date: '2026-03-04' },
        { id: 3, source_name: '   ', amount: '25.00', date: '2026-03-05' },
        { id: 4, source_name: 'Income', amount: '10.00', date: '2026-03-06' },
      ]
      const result = buildIncomeSourceBreakdown(income, '2026-03-01')
      expect(result).toHaveLength(2)
      const noSource = result.find((r) => r.name === '')
      const namedIncome = result.find((r) => r.name === 'Income')
      expect(noSource?.amount).toBe(175)
      expect(namedIncome?.amount).toBe(10)
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
  })
})

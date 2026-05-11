const {
  buildCalendarGrid,
  buildCashFlowGeometry,
  buildCumulativeSeries,
  buildDailyDetailMap,
  buildDonutSegments,
  buildRhythmBars,
  clamp,
  formatSignedCurrency,
  getActiveBreakdownItems,
  getBudgetUsageHeadline,
  getCashFlowHighlights,
  getDefaultSelectedDay,
  getFilenameFromDisposition,
  getMetricAccent,
  getMetricDeltaContext,
  getMetricDeltaValue,
  getMetricValue,
  getMonthLength,
  getMonthShortLabel,
  getMoverScaleMax,
  pickTopExpensesFromDetails,
} = require('@/lib/insightsViewModels')

describe('insightsViewModels specification', () => {
  describe('getActiveBreakdownItems', () => {
    it('returns the matching breakdown array for the view mode', () => {
      const snapshot = { expenseBreakdown: [{ id: 'e' }], incomeBreakdown: [{ id: 'i' }] }
      expect(getActiveBreakdownItems(snapshot, 'expenses')).toEqual([{ id: 'e' }])
      expect(getActiveBreakdownItems(snapshot, 'income')).toEqual([{ id: 'i' }])
      expect(getActiveBreakdownItems(null, 'expenses')).toEqual([])
    })
  })

  describe('clamp', () => {
    it('pins values inside the inclusive range', () => {
      expect(clamp(5, 10, 20)).toBe(10)
      expect(clamp(25, 10, 20)).toBe(20)
      expect(clamp(15, 10, 20)).toBe(15)
    })
  })

  describe('formatSignedCurrency', () => {
    it('prefixes positive, negative, and zero amounts', () => {
      expect(formatSignedCurrency(12.5)).toMatch(/^\+\$12\.50$/)
      expect(formatSignedCurrency(-3)).toMatch(/^-\$3\.00$/)
      expect(formatSignedCurrency(0)).toMatch(/^\$0\.00$/)
    })
  })

  describe('getMetricValue', () => {
    it('shows a friendly label when budget-left has no amount', () => {
      expect(getMetricValue({ id: 'budget-left', currentAmount: null })).toBe('No budget')
    })

    it('formats currency for populated metrics', () => {
      expect(getMetricValue({ id: 'income', currentAmount: 100 })).toContain('100')
    })
  })

  describe('getMetricDeltaValue', () => {
    it('handles missing deltas and flat changes', () => {
      expect(getMetricDeltaValue({ id: 'budget-left', currentAmount: null })).toBe('Set budget')
      expect(getMetricDeltaValue({ id: 'income', deltaAmount: null })).toBe('No baseline')
      expect(getMetricDeltaValue({ id: 'income', deltaAmount: 0, previousAmount: 10 })).toBe('Flat')
    })

    it('prefers a percentage delta when a positive baseline exists', () => {
      const text = getMetricDeltaValue({
        id: 'expenses',
        deltaAmount: 5,
        previousAmount: 10,
        deltaPercentage: 12.34,
      })
      expect(text).toContain('%')
    })

    it('falls back to signed currency when no percentage context exists', () => {
      const text = getMetricDeltaValue({
        id: 'expenses',
        deltaAmount: -4,
        previousAmount: 0,
        deltaPercentage: null,
      })
      expect(text).toMatch(/^-\$/)
    })
  })

  describe('getMetricDeltaContext', () => {
    it('returns null when there is nothing to compare', () => {
      expect(getMetricDeltaContext({ id: 'budget-left', currentAmount: null, deltaAmount: 1 })).toBeNull()
      expect(getMetricDeltaContext({ id: 'income', deltaAmount: null })).toBeNull()
    })

    it('returns the comparison label when a delta exists', () => {
      expect(getMetricDeltaContext({ id: 'income', deltaAmount: 5 })).toBe('vs last month')
    })
  })

  describe('getMetricAccent', () => {
    it('returns stable unicode markers per metric id', () => {
      expect(getMetricAccent('income')).toBe('\u2197')
      expect(getMetricAccent('expenses')).toBe('\u2198')
      expect(getMetricAccent('net')).toBe('\u223F')
      expect(getMetricAccent('budget-left')).toBe('\u25CE')
      expect(getMetricAccent('other')).toBe('\u2022')
    })
  })

  describe('pickTopExpensesFromDetails', () => {
    it('returns empty input unchanged', () => {
      expect(pickTopExpensesFromDetails(null)).toEqual([])
      expect(pickTopExpensesFromDetails([])).toEqual([])
    })

    it('orders by amount descending and respects the limit', () => {
      const rows = [
        { amount: '10', title: 'Small' },
        { amount: '40', title: 'Big' },
        { amount: '25', title: 'Mid' },
      ]
      expect(pickTopExpensesFromDetails(rows, 2).map((row) => row.title)).toEqual(['Big', 'Mid'])
    })
  })

  describe('buildDonutSegments', () => {
    it('returns an empty list when there is no spend to visualize', () => {
      expect(buildDonutSegments([])).toEqual([])
      expect(buildDonutSegments([{ amount: 0 }])).toEqual([])
    })

    it('builds paths and marker anchors for multi-slice donuts', () => {
      const segments = buildDonutSegments([
        { id: 'a', amount: 35 },
        { id: 'b', amount: 25 },
        { id: 'c', amount: 20 },
        { id: 'd', amount: 12 },
        { id: 'e', amount: 8 },
      ])
      expect(segments).toHaveLength(5)
      expect(segments[0].path).toMatch(/^M /)
      expect(segments.every((s) => typeof s.markerAngle === 'number')).toBe(true)
    })
  })

  describe('getBudgetUsageHeadline', () => {
    it('falls back when budget amount is missing', () => {
      expect(getBudgetUsageHeadline(null)).toBe('Budget not set')
      expect(getBudgetUsageHeadline({ budgetAmount: null })).toBe('Budget not set')
    })

    it('rounds progress into a short headline', () => {
      expect(getBudgetUsageHeadline({ progressValue: 62.4, budgetAmount: 500 })).toBe('62% used')
    })
  })

  describe('buildCashFlowGeometry', () => {
    it('returns baseline geometry for an empty series', () => {
      const geo = buildCashFlowGeometry([])
      expect(geo.groups).toEqual([])
      expect(geo.maxBarValue).toBe(1)
    })

    it('lays out bars for each month bucket', () => {
      const geo = buildCashFlowGeometry([
        { label: 'Jan', incomeAmount: 1000, expenseAmount: 400, netAmount: 600 },
        { label: 'Feb', incomeAmount: 800, expenseAmount: 500, netAmount: 300 },
      ])
      expect(geo.groups).toHaveLength(2)
      expect(geo.groups[0].barWidth).toBeGreaterThan(0)
      expect(geo.linePath.startsWith('M')).toBe(true)
    })
  })

  describe('buildCalendarGrid', () => {
    it('returns blanks when month is missing', () => {
      expect(buildCalendarGrid([{ day: 1, amount: 5 }], null).weeks).toEqual([])
    })

    it('pads weeks to full rows for a valid month', () => {
      const { weeks, weekdayLabels } = buildCalendarGrid(
        [{ day: 1, amount: 10, key: '2026-03-01' }],
        '2026-03-01',
      )
      expect(weekdayLabels.length).toBe(7)
      expect(weeks.length).toBeGreaterThan(0)
      expect(weeks[0].length).toBe(7)
    })

    it('returns an empty grid when the month string is not parseable', () => {
      const { weeks } = buildCalendarGrid([{ day: 1, amount: 1, key: 'x' }], 'not-a-month')
      expect(weeks).toEqual([])
    })
  })

  describe('buildRhythmBars', () => {
    it('computes tick days and normalized heights', () => {
      const rhythm = buildRhythmBars([
        { day: 3, amount: 10 },
        { day: 10, amount: 40 },
      ])
      expect(rhythm.columns).toHaveLength(2)
      expect(rhythm.tickDays.length).toBeGreaterThan(0)
    })
  })

  describe('buildDailyDetailMap', () => {
    it('groups entries by key and skips rows without keys', () => {
      const map = buildDailyDetailMap([
        { key: '2026-03-01', title: 'A' },
        { key: '2026-03-01', title: 'B' },
        { title: 'missing' },
      ])
      expect(Object.keys(map)).toEqual(['2026-03-01'])
      expect(map['2026-03-01']).toHaveLength(2)
    })
  })

  describe('buildCumulativeSeries', () => {
    it('accumulates running totals', () => {
      expect(buildCumulativeSeries([{ day: 1, amount: 1 }, { day: 2, amount: 2 }])).toEqual([
        { day: 1, amount: 1 },
        { day: 2, amount: 3 },
      ])
    })
  })

  describe('getMonthLength', () => {
    it('returns 31 for invalid months and correct February length in leap years', () => {
      expect(getMonthLength('')).toBe(31)
      expect(getMonthLength('2024-02-01')).toBe(29)
    })
  })

  describe('getMonthShortLabel', () => {
    it('returns a short label or a safe fallback', () => {
      expect(getMonthShortLabel('2026-06-01')).toBe('Jun')
      expect(getMonthShortLabel('')).toBe('Month')
    })
  })

  describe('getDefaultSelectedDay', () => {
    it('prefers the peak day key when present', () => {
      expect(getDefaultSelectedDay({ peakDay: { key: '2026-03-20' } })).toBe('2026-03-20')
    })

    it('falls back to the first day with spend', () => {
      expect(getDefaultSelectedDay({ series: [{ key: '2026-03-02', amount: 0 }, { key: '2026-03-04', amount: 5 }] })).toBe(
        '2026-03-04',
      )
    })
  })

  describe('getCashFlowHighlights', () => {
    it('summarizes positive months and strongest net month', () => {
      const highlights = getCashFlowHighlights([
        { label: 'Jan', netAmount: 100, incomeAmount: 500, expenseAmount: 200 },
        { label: 'Feb', netAmount: -20, incomeAmount: 400, expenseAmount: 420 },
      ])
      expect(highlights.positiveCashMonths).toBe(1)
      expect(highlights.strongestCashMonth.label).toBe('Jan')
    })

    it('computes focus tone and savings rate when a month is selected', () => {
      const positive = getCashFlowHighlights([], {
        label: 'Mar',
        netAmount: 40,
        incomeAmount: 200,
        expenseAmount: 160,
      })
      expect(positive.cashFlowFocusTone).toBe('positive')
      expect(positive.focusSavingsRate).toBeCloseTo(20)

      const negative = getCashFlowHighlights([], {
        label: 'Apr',
        netAmount: -10,
        incomeAmount: 100,
        expenseAmount: 110,
      })
      expect(negative.cashFlowFocusTone).toBe('negative')
    })
  })

  describe('getMoverScaleMax', () => {
    it('returns at least 1 even for empty movers', () => {
      expect(getMoverScaleMax([])).toBe(1)
      expect(getMoverScaleMax([{ amount: 12, previousAmount: 30 }])).toBe(30)
    })
  })

  describe('getFilenameFromDisposition', () => {
    it('returns the fallback when header is missing', () => {
      expect(getFilenameFromDisposition('', 'fallback.csv')).toBe('fallback.csv')
    })

    it('parses a simple filename token', () => {
      expect(getFilenameFromDisposition('attachment; filename="report.csv"', 'out.csv')).toBe('report.csv')
    })

    it('parses RFC5987 filename* values', () => {
      const header = "attachment; filename*=UTF-8''my%20file.csv"
      expect(getFilenameFromDisposition(header, 'out.csv')).toBe('my file.csv')
    })

    it('falls back when encoded bytes cannot be decoded', () => {
      const header = "attachment; filename*=UTF-8''%ZZ"
      expect(getFilenameFromDisposition(header, 'safe.csv')).toBe('safe.csv')
    })
  })
})

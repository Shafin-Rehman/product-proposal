const {
  buildActivityFeed,
  buildIncomeSourceBreakdown,
  groupActivityByDate,
  formatCurrency,
} = require('@/lib/financeUtils')

const { getEntryVisual, getCategoryVisual } = require('@/lib/financeVisuals')

const EXPENSE = {
  id: 'e1',
  amount: '45.00',
  date: '2026-03-10',
  created_at: '2026-03-10T00:00:00Z',
  description: 'Groceries run',
  category_name: 'grocery store',
}

const INCOME = {
  id: 'i1',
  amount: '2000.00',
  date: '2026-03-01',
  created_at: '2026-03-20T00:00:00Z',
  source_name: 'Payroll',
}

describe('financeVisuals specification', () => {
  describe('financeUtils buildActivityFeed with financeVisuals', () => {
    it('maps a grocery-line expense feed row to the groceries palette', () => {
      const [entry] = buildActivityFeed([EXPENSE], [])

      const visual = getEntryVisual(entry)

      expect(visual).toMatchObject({
        label: 'grocery store',
        color: '#4d9a6a',
      })
    })

    it('maps a payroll income feed row to the keyword income palette', () => {
      const [entry] = buildActivityFeed([], [INCOME])

      const visual = getEntryVisual(entry)

      expect(visual).toMatchObject({
        label: 'Payroll',
        color: '#2f8f55',
      })
    })
  })

  describe('groupActivityByDate with financeVisuals', () => {
    it('keeps stable visuals after grouping by date', () => {
      const groups = groupActivityByDate(buildActivityFeed([EXPENSE], [INCOME]))

      expect(getEntryVisual(groups[0].entries[0])).toMatchObject({
        label: 'grocery store',
        color: '#4d9a6a',
      })
      expect(getEntryVisual(groups[1].entries[0])).toMatchObject({
        label: 'Payroll',
        color: '#2f8f55',
      })
    })
  })

  describe('buildIncomeSourceBreakdown with formatCurrency', () => {
    it('formats breakdown amounts as stable currency strings', () => {
      const income = [
        { id: 1, source_name: 'Payroll', amount: '2000.00', date: '2026-03-03' },
        { id: 2, source_name: 'Freelance', amount: '850.50', date: '2026-03-19' },
      ]

      const [payroll, freelance] = buildIncomeSourceBreakdown(income, '2026-03-01')

      expect(formatCurrency(payroll.amount)).toBe('$2,000.00')
      expect(formatCurrency(freelance.amount)).toBe('$850.50')
    })
  })
})

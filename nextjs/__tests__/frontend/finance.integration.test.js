const {
  buildActivityFeed,
  buildIncomeSourceBreakdown,
  groupActivityByDate,
  formatCurrency,
} = require('@/lib/financeUtils')

const { getEntryVisual, getCategoryVisual } = require('@/lib/financeVisuals')

const EXPENSE = { id: 'e1', amount: '45.00', date: '2026-03-10', created_at: '2026-03-10T00:00:00Z', description: 'Groceries run', category_name: 'grocery store' }
const INCOME  = { id: 'i1', amount: '2000.00', month: '2026-03-01', created_at: '2026-03-20T00:00:00Z', source_name: 'Payroll' }

describe('buildActivityFeed → getEntryVisual', () => {
  it('entry produced by buildActivityFeed is a valid input to getEntryVisual', () => {
    const [entry] = buildActivityFeed([EXPENSE], [])
    const visual = getEntryVisual(entry)
    expect(visual).toHaveProperty('color')
    expect(visual).toHaveProperty('label')
    expect(typeof visual.color).toBe('string')
  })

  it('income entry from buildActivityFeed also produces a valid visual', () => {
    const visual = getEntryVisual(buildActivityFeed([], [INCOME])[0])
    expect(visual).toHaveProperty('color')
    expect(typeof visual.label).toBe('string')
  })

  it('chip and kind on feed entries map to the correct category color', () => {
    const [entry] = buildActivityFeed([EXPENSE], [])
    const visual = getCategoryVisual(entry.chip, entry.kind)
    expect(visual.color).toBe('#6faa80')  // grocery store → Groceries → green
  })
})

describe('buildActivityFeed → groupActivityByDate → getEntryVisual', () => {
  it('expense entry inside its date group produces a valid visual', () => {
    // groups[1] = older group (2026-03-10, expense)
    const groups = groupActivityByDate(buildActivityFeed([EXPENSE], [INCOME]))
    const visual = getEntryVisual(groups[1].entries[0])
    expect(visual).toHaveProperty('color')
    expect(visual).toHaveProperty('label')
  })

  it('income entry inside its date group produces a valid visual', () => {
    // groups[0] = newer group (2026-03-20, income)
    const groups = groupActivityByDate(buildActivityFeed([EXPENSE], [INCOME]))
    const visual = getEntryVisual(groups[0].entries[0])
    expect(visual).toHaveProperty('color')
    expect(visual).toHaveProperty('label')
  })
})

describe('buildIncomeSourceBreakdown → formatCurrency', () => {
  it('breakdown amounts format correctly into display strings', () => {
    const income = [
      { id: 1, source_name: 'Payroll', amount: '2000.00', month: '2026-03-01' },
      { id: 2, source_name: 'Freelance', amount: '850.50', month: '2026-03-01' },
    ]
    // sorted descending by amount: Payroll first, Freelance second
    const [payroll, freelance] = buildIncomeSourceBreakdown(income, '2026-03-01')
    expect(formatCurrency(payroll.amount)).toBe('$2,000.00')
    expect(formatCurrency(freelance.amount)).toBe('$850.50')
  })
})

const {
  getInitialsLabel,
  getCategoryLabel,
  getCategoryVisual,
  getEntryVisual,
} = require('@/lib/financeVisuals')

describe('getInitialsLabel', () => {
  it('returns up to two uppercase initials from a name', () => {
    expect(getInitialsLabel('john doe')).toBe('JD')
    expect(getInitialsLabel('alice')).toBe('A')
  })
})

describe('getCategoryLabel', () => {
  it('resolves well-known expense keywords to their label', () => {
    expect(getCategoryLabel('grocery store', 'expense')).toBe('Groceries')
    expect(getCategoryLabel('rent payment', 'expense')).toBe('Housing')
  })

  it('falls back to "Uncategorized" for unknown expense strings', () => {
    expect(getCategoryLabel('', 'expense')).toBe('Uncategorized')
  })
})

describe('getCategoryVisual', () => {
  it('returns an object with the expected shape', () => {
    const visual = getCategoryVisual('grocery store', 'expense')
    expect(visual).toHaveProperty('label')
    expect(visual).toHaveProperty('symbol')
    expect(visual).toHaveProperty('color')
    expect(visual).toHaveProperty('soft')
  })

  it('maps a known keyword to the correct color', () => {
    expect(getCategoryVisual('grocery store', 'expense').color).toBe('#6faa80')
  })
})

describe('getEntryVisual', () => {
  it('derives a visual from a standard entry', () => {
    const entry = { chip: 'Dining', merchant: 'Starbucks', title: 'Coffee', kind: 'expense' }
    const visual = getEntryVisual(entry)
    expect(visual.label).toBe('Dining')
    expect(visual).toHaveProperty('color')
  })
})

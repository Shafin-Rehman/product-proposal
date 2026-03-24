const { normalizeMonth } = require('@/lib/budget')

describe('normalizeMonth', () => {
  it('returns YYYY-MM-01 for valid YYYY-MM-DD input', () => {
    expect(normalizeMonth('2026-03-15')).toBe('2026-03-01')
  })

  it('returns YYYY-MM-01 for valid YYYY-MM input', () => {
    expect(normalizeMonth('2026-03')).toBe('2026-03-01')
  })

  it('handles leap years correctly', () => {
    expect(normalizeMonth('2024-02-29')).toBe('2024-02-01')
  })

  it('returns null for non-string input', () => {
    expect(normalizeMonth(123)).toBeNull()
    expect(normalizeMonth(null)).toBeNull()
    expect(normalizeMonth({})).toBeNull()
  })

  it('returns null for wrongly formatted string', () => {
    expect(normalizeMonth('03-2026-15')).toBeNull()
    expect(normalizeMonth('abc')).toBeNull()
    expect(normalizeMonth('2026/03/15')).toBeNull()
  })

  it('returns null for invalid month values', () => {
    expect(normalizeMonth('2026-00-15')).toBeNull()
    expect(normalizeMonth('2026-13-15')).toBeNull()
  })

  it('returns null for invalid day values', () => {
    expect(normalizeMonth('2026-03-00')).toBeNull()
    expect(normalizeMonth('2026-03-32')).toBeNull()
    expect(normalizeMonth('2026-02-30')).toBeNull() // Invalid day for February
  })
})

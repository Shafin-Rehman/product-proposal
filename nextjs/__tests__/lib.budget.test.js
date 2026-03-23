jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}))

const { normalizeMonth } = require('@/lib/budget')

describe('normalizeMonth (unit)', () => {
  it('normalizes any valid date string to the first day of that month (YYYY-MM-01), preserving year and month', () => {
    // Normalization means the output is always the first of the same month.
    // For example, 2026-03-15 becomes 2026-03-01.
    const first = normalizeMonth('2026-03-01')
    const mid = normalizeMonth('2026-03-15')
    const last = normalizeMonth('2026-03-31')
    expect(first).toBe('2026-03-01')
    expect(mid).toBe('2026-03-01')
    expect(last).toBe('2026-03-01')
    // Explicitly check that the output is always day '01' and the year/month are preserved
    const [year, month, day] = mid.split('-')
    expect(year).toBe('2026')
    expect(month).toBe('03')
    expect(day).toBe('01')
  })

  // Null is returned for error cases as required by assignment
  it('month boundary: accepts 12 (last valid month) and rejects 13 (first invalid)', () => {
    expect(normalizeMonth('2026-12-01')).toBe('2026-12-01')
    expect(normalizeMonth('2026-13-01')).toBeNull()
  })

  it('leap year boundary: accepts Feb 29 in 2024 (leap year) and rejects it in 2026 (non-leap)', () => {
    expect(normalizeMonth('2024-02-29')).toBe('2024-02-01')
    expect(normalizeMonth('2026-02-29')).toBeNull()
  })

  it('rejects non-string inputs that are not even close to a date string', () => {
    expect(normalizeMonth(20260301)).toBeNull()
    expect(normalizeMonth(null)).toBeNull()
    expect(normalizeMonth('bad')).toBeNull()
  })
})

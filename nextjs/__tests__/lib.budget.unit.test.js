import { isPositiveMoneyValue, normalizeDate, normalizeMonth } from '@/lib/budget'

describe('normalizeMonth (unit)', () => {
  test('returns correct normalized month', () => {
    expect(normalizeMonth('2025-03')).toBe('2025-03-01')
  })

  test('handles full date input correctly', () => {
    expect(normalizeMonth('2025-03-15')).toBe('2025-03-01')
  })

  test('returns null for invalid month', () => {
    expect(normalizeMonth('2025-13')).toBeNull()
  })

  test('returns null for bad format', () => {
    expect(normalizeMonth('abcd')).toBeNull()
  })

  test('returns null for empty input', () => {
    expect(normalizeMonth('')).toBeNull()
  })
})

describe('normalizeDate (unit)', () => {
  test('accepts YYYY-MM-DD input', () => {
    expect(normalizeDate('2026-03-15')).toBe('2026-03-15')
  })

  test('accepts ISO timestamp input', () => {
    expect(normalizeDate('2026-03-15T08:30:00Z')).toBe('2026-03-15')
  })

  test('returns null for invalid dates', () => {
    expect(normalizeDate('2026-02-30')).toBeNull()
  })
})

describe('isPositiveMoneyValue (unit)', () => {
  test('returns false for malformed inputs', () => {
    expect(isPositiveMoneyValue('')).toBe(false)
    expect(isPositiveMoneyValue('abc')).toBe(false)
    expect(isPositiveMoneyValue('1.999')).toBe(false)
    expect(isPositiveMoneyValue('1e2')).toBe(false)
    expect(isPositiveMoneyValue(null)).toBe(false)
  })

  test('returns false for non-positive values', () => {
    expect(isPositiveMoneyValue(0)).toBe(false)
    expect(isPositiveMoneyValue('0')).toBe(false)
    expect(isPositiveMoneyValue('-5')).toBe(false)
  })

  test('returns true for valid positive money amounts', () => {
    expect(isPositiveMoneyValue(25)).toBe(true)
    expect(isPositiveMoneyValue('25.50')).toBe(true)
    expect(isPositiveMoneyValue(' 25.50 ')).toBe(true)
  })
})
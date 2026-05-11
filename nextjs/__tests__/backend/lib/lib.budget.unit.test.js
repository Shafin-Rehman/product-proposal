import { isPositiveMoneyValue, normalizeDate, normalizeMonth } from '@/lib/budget'

describe('budget helpers (unit)', () => {
  test('isPositiveMoneyValue returns false for malformed inputs', () => {
    expect(isPositiveMoneyValue('')).toBe(false)
    expect(isPositiveMoneyValue('abc')).toBe(false)
    expect(isPositiveMoneyValue('1.999')).toBe(false)
    expect(isPositiveMoneyValue('1e2')).toBe(false)
    expect(isPositiveMoneyValue(null)).toBe(false)
  })

  test('isPositiveMoneyValue returns false for non-positive values', () => {
    expect(isPositiveMoneyValue(0)).toBe(false)
    expect(isPositiveMoneyValue('0')).toBe(false)
    expect(isPositiveMoneyValue('-5')).toBe(false)
  })

  test('isPositiveMoneyValue returns true for valid positive money amounts', () => {
    expect(isPositiveMoneyValue(25)).toBe(true)
    expect(isPositiveMoneyValue('25.50')).toBe(true)
    expect(isPositiveMoneyValue(' 25.50 ')).toBe(true)
  })

  test('normalizeDate returns null for malformed or invalid inputs', () => {
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate('abcd')).toBeNull()
    expect(normalizeDate('2026-02-30')).toBeNull()
  })

  test('normalizeDate accepts valid date inputs', () => {
    expect(normalizeDate('2026-03-15')).toBe('2026-03-15')
    expect(normalizeDate('2026-03-15T08:30:00Z')).toBe('2026-03-15')
  })

  test('normalizeMonth returns null for malformed inputs', () => {
    expect(normalizeMonth('')).toBeNull()
    expect(normalizeMonth('abcd')).toBeNull()
    expect(normalizeMonth('2025-13')).toBeNull()
  })

  test('normalizeMonth accepts valid month inputs', () => {
    expect(normalizeMonth('2025-03')).toBe('2025-03-01')
    expect(normalizeMonth('2025-03-15')).toBe('2025-03-01')
  })
})
import { isPositiveMoneyValue, normalizeDate, normalizeMonth } from '@/lib/budget'

describe('budget specification', () => {
  describe('isPositiveMoneyValue', () => {
    it('rejects empty, non-numeric, over-precision, scientific, and null inputs', () => {
      expect(isPositiveMoneyValue('')).toBe(false)
      expect(isPositiveMoneyValue('abc')).toBe(false)
      expect(isPositiveMoneyValue('1.999')).toBe(false)
      expect(isPositiveMoneyValue('1e2')).toBe(false)
      expect(isPositiveMoneyValue(null)).toBe(false)
    })

    it('rejects zero, negative values, and amounts above the money cap', () => {
      expect(isPositiveMoneyValue(0)).toBe(false)
      expect(isPositiveMoneyValue('0')).toBe(false)
      expect(isPositiveMoneyValue('-5')).toBe(false)
      expect(isPositiveMoneyValue(100000000)).toBe(false)
    })

    it('accepts trimmed string amounts and finite positive numbers within scale', () => {
      expect(isPositiveMoneyValue(25)).toBe(true)
      expect(isPositiveMoneyValue('25.50')).toBe(true)
      expect(isPositiveMoneyValue(' 25.50 ')).toBe(true)
    })
  })

  describe('normalizeDate', () => {
    it('returns null for empty, non-ISO, and impossible calendar dates', () => {
      expect(normalizeDate('')).toBeNull()
      expect(normalizeDate('abcd')).toBeNull()
      expect(normalizeDate('2026-02-30')).toBeNull()
    })

    it('normalizes plain dates and strips time from ISO timestamps', () => {
      expect(normalizeDate('2026-03-15')).toBe('2026-03-15')
      expect(normalizeDate('2026-03-15T08:30:00Z')).toBe('2026-03-15')
    })

    it('normalizes a valid UTC Date instance', () => {
      expect(normalizeDate(new Date(Date.UTC(2026, 2, 15)))).toBe('2026-03-15')
    })

    it('returns null for an invalid Date instance', () => {
      expect(normalizeDate(new Date(Number.NaN))).toBeNull()
    })
  })

  describe('normalizeMonth', () => {
    it('returns null for values that are not a valid year-month', () => {
      expect(normalizeMonth('')).toBeNull()
      expect(normalizeMonth('abcd')).toBeNull()
      expect(normalizeMonth('2025-13')).toBeNull()
    })

    it('anchors both year-month and full date inputs to the first of the month', () => {
      expect(normalizeMonth('2025-03')).toBe('2025-03-01')
      expect(normalizeMonth('2025-03-15')).toBe('2025-03-01')
    })

    it('normalizes a Date in UTC to the corresponding month start', () => {
      expect(normalizeMonth(new Date(Date.UTC(2025, 10, 15)))).toBe('2025-11-01')
    })
  })
})

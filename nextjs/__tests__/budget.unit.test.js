import { normalizeMonth } from '@/lib/budget'

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
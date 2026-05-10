import {
  addPeriod,
  addUtcCalendarDays,
  advanceNextDateOnResume,
  effectiveBillingDayFromClient,
  getMissedOccurrences,
  maxIsoDate,
} from '@/lib/recurringDates'

describe('addPeriod', () => {
  test('weekly adds 7 days', () => {
    expect(addPeriod('2026-05-01', 'weekly')).toBe('2026-05-08')
  })

  test('monthly adds one month', () => {
    expect(addPeriod('2026-01-15', 'monthly')).toBe('2026-02-15')
  })

  test('monthly wraps year', () => {
    expect(addPeriod('2026-12-10', 'monthly')).toBe('2027-01-10')
  })

  test('yearly adds one year', () => {
    expect(addPeriod('2026-03-20', 'yearly')).toBe('2027-03-20')
  })

  test('weekly crossing month boundary', () => {
    expect(addPeriod('2026-04-28', 'weekly')).toBe('2026-05-05')
  })
})

describe('maxIsoDate', () => {
  test('picks the later YYYY-MM-DD', () => {
    expect(maxIsoDate('2026-06-10', '2026-06-12')).toBe('2026-06-12')
    expect(maxIsoDate('2026-06-12', '2026-06-10')).toBe('2026-06-12')
  })
})

describe('addUtcCalendarDays', () => {
  test('adds days in UTC without shifting string compare semantics', () => {
    expect(addUtcCalendarDays('2026-06-10', 1)).toBe('2026-06-11')
    expect(addUtcCalendarDays('2026-06-30', 1)).toBe('2026-07-01')
  })
})

describe('effectiveBillingDayFromClient', () => {
  test('local day ahead of UTC uses client when within UTC+1', () => {
    expect(effectiveBillingDayFromClient('2026-06-10', '2026-06-11')).toBe('2026-06-11')
  })

  test('rejects client beyond UTC+1', () => {
    expect(effectiveBillingDayFromClient('2026-06-10', '2026-06-12')).toBe('2026-06-10')
    expect(effectiveBillingDayFromClient('2026-07-12', '2099-01-01')).toBe('2026-07-12')
  })
})

describe('advanceNextDateOnResume', () => {
  test('monthly: next_date as JS Date (node-pg) still advances past resume (May→June scenario)', () => {
    const june10 = new Date('2026-06-10T00:00:00.000Z')
    expect(advanceNextDateOnResume(june10, 'monthly', '2026-06-11')).toBe('2026-07-10')
  })

  test('monthly: due July 11, resume July 12 → next charge Aug 11 (skip missed 11th)', () => {
    expect(advanceNextDateOnResume('2026-07-11', 'monthly', '2026-07-12')).toBe('2026-08-11')
  })

  test('monthly: due July 11, resume July 11 → Aug 11 (due on/before resume day is skipped)', () => {
    expect(advanceNextDateOnResume('2026-07-11', 'monthly', '2026-07-11')).toBe('2026-08-11')
  })

  test('weekly: due July 11, resume July 12 → July 18', () => {
    expect(advanceNextDateOnResume('2026-07-11', 'weekly', '2026-07-12')).toBe('2026-07-18')
  })

  test('next already after resume day is unchanged', () => {
    expect(advanceNextDateOnResume('2026-08-11', 'monthly', '2026-07-12')).toBe('2026-08-11')
  })
})

describe('getMissedOccurrences', () => {
  test('returns empty array when next_date is in the future', () => {
    expect(getMissedOccurrences('2026-05-10', 'weekly', '2026-05-09')).toEqual([])
  })

  test('returns the single date when next_date equals asOf (due today)', () => {
    expect(getMissedOccurrences('2026-05-09', 'weekly', '2026-05-09')).toEqual(['2026-05-09'])
  })

  test('weekly: one week overdue yields 1 occurrence', () => {
    expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-07')).toEqual(['2026-05-01'])
  })

  test('weekly: three weeks elapsed but not yet on boundary — 3 occurrences', () => {
    expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-21')).toEqual([
      '2026-05-01', '2026-05-08', '2026-05-15',
    ])
  })

  test('weekly: exactly on the 3-week boundary — 4th charge fires today too', () => {
    expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-22')).toEqual([
      '2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22',
    ])
  })

  test('retroactive weekly subscription set 3 months back produces correct count and bounds', () => {
    const result = getMissedOccurrences('2026-02-01', 'weekly', '2026-05-01')
    expect(result).toHaveLength(13)
    expect(result[0]).toBe('2026-02-01')
    expect(result[12]).toBe('2026-04-26')
  })

  test('monthly: 3 periods lapsed before boundary — 3 charges', () => {
    expect(getMissedOccurrences('2026-02-01', 'monthly', '2026-04-30')).toEqual([
      '2026-02-01', '2026-03-01', '2026-04-01',
    ])
  })

  test('monthly: exactly on the 3-month boundary — today\'s charge fires too (4 total)', () => {
    expect(getMissedOccurrences('2026-02-01', 'monthly', '2026-05-01')).toEqual([
      '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01',
    ])
  })

  test('monthly: next_date is today — only that date is included, not the next month', () => {
    expect(getMissedOccurrences('2026-05-09', 'monthly', '2026-05-09')).toEqual(['2026-05-09'])
  })

  test('yearly: 2 years elapsed before anniversary — 2 charges', () => {
    expect(getMissedOccurrences('2024-01-15', 'yearly', '2026-01-14')).toEqual([
      '2024-01-15', '2025-01-15',
    ])
  })

  test('yearly: exactly on the 2-year anniversary — today\'s charge fires too (3 total)', () => {
    expect(getMissedOccurrences('2024-01-15', 'yearly', '2026-01-15')).toEqual([
      '2024-01-15', '2025-01-15', '2026-01-15',
    ])
  })

  test('time-simulation: weekly sub started May 9, advance to Jun 5 — 4 charges', () => {
    const result = getMissedOccurrences('2026-05-09', 'weekly', '2026-06-05')
    expect(result).toHaveLength(4)
    expect(result).toEqual(['2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30'])
  })

  test('time-simulation: weekly sub started May 9, advance to Jun 6 (boundary) — 5th charge fires', () => {
    const result = getMissedOccurrences('2026-05-09', 'weekly', '2026-06-06')
    expect(result).toHaveLength(5)
    expect(result[4]).toBe('2026-06-06')
  })

  test('time-simulation: monthly sub Jan 1, advance to Jun 30 — 6 charges', () => {
    const result = getMissedOccurrences('2026-01-01', 'monthly', '2026-06-30')
    expect(result).toHaveLength(6)
    expect(result[0]).toBe('2026-01-01')
    expect(result[5]).toBe('2026-06-01')
  })

  test('time-simulation: yearly sub started 3 years ago — 3 charges, no charge for the future year', () => {
    const result = getMissedOccurrences('2023-06-01', 'yearly', '2026-05-31')
    expect(result).toHaveLength(3)
    expect(result).toEqual(['2023-06-01', '2024-06-01', '2025-06-01'])
  })
})

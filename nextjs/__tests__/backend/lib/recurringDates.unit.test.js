import {
  addPeriod,
  addUtcCalendarDays,
  advanceNextDateOnResume,
  effectiveBillingDayFromClient,
  getMissedOccurrences,
  maxIsoDate,
} from '@/lib/recurringDates'

describe('recurringDates specification', () => {
  describe('addPeriod', () => {
    it('weekly adds 7 days', () => {
      expect(addPeriod('2026-05-01', 'weekly')).toBe('2026-05-08')
    })

    it('monthly adds one month', () => {
      expect(addPeriod('2026-01-15', 'monthly')).toBe('2026-02-15')
    })

    it('monthly wraps year', () => {
      expect(addPeriod('2026-12-10', 'monthly')).toBe('2027-01-10')
    })

    it('yearly adds one year', () => {
      expect(addPeriod('2026-03-20', 'yearly')).toBe('2027-03-20')
    })

    it('weekly crossing month boundary', () => {
      expect(addPeriod('2026-04-28', 'weekly')).toBe('2026-05-05')
    })

    it('monthly clamps day when target month is shorter (Jan 31 → Feb 28)', () => {
      expect(addPeriod('2026-01-31', 'monthly')).toBe('2026-02-28')
    })

    it('monthly clamps to Feb 29 in leap years', () => {
      expect(addPeriod('2024-01-31', 'monthly')).toBe('2024-02-29')
    })

    it('monthly Mar 31 → Apr 30', () => {
      expect(addPeriod('2026-03-31', 'monthly')).toBe('2026-04-30')
    })

    it('yearly clamps Feb 29 across non-leap year', () => {
      expect(addPeriod('2024-02-29', 'yearly')).toBe('2025-02-28')
    })
  })

  describe('maxIsoDate', () => {
    it('picks the later YYYY-MM-DD', () => {
      expect(maxIsoDate('2026-06-10', '2026-06-12')).toBe('2026-06-12')
      expect(maxIsoDate('2026-06-12', '2026-06-10')).toBe('2026-06-12')
    })
  })

  describe('addUtcCalendarDays', () => {
    it('adds days in UTC without shifting string compare semantics', () => {
      expect(addUtcCalendarDays('2026-06-10', 1)).toBe('2026-06-11')
      expect(addUtcCalendarDays('2026-06-30', 1)).toBe('2026-07-01')
    })
  })

  describe('effectiveBillingDayFromClient', () => {
    it('local day ahead of UTC uses client when within UTC+1', () => {
      expect(effectiveBillingDayFromClient('2026-06-10', '2026-06-11')).toBe('2026-06-11')
    })

    it('rejects client beyond UTC+1', () => {
      expect(effectiveBillingDayFromClient('2026-06-10', '2026-06-12')).toBe('2026-06-10')
      expect(effectiveBillingDayFromClient('2026-07-12', '2099-01-01')).toBe('2026-07-12')
    })
  })

  describe('advanceNextDateOnResume', () => {
    it('monthly: next_date as JS Date (node-pg) still advances past resume (May→June scenario)', () => {
      const june10 = new Date('2026-06-10T00:00:00.000Z')
      expect(advanceNextDateOnResume(june10, 'monthly', '2026-06-11')).toBe('2026-07-10')
    })

    it('monthly: due July 11, resume July 12 → next charge Aug 11 (skip missed 11th)', () => {
      expect(advanceNextDateOnResume('2026-07-11', 'monthly', '2026-07-12')).toBe('2026-08-11')
    })

    it('monthly: due July 11, resume July 11 → Aug 11 (due on/before resume day is skipped)', () => {
      expect(advanceNextDateOnResume('2026-07-11', 'monthly', '2026-07-11')).toBe('2026-08-11')
    })

    it('weekly: due July 11, resume July 12 → July 18', () => {
      expect(advanceNextDateOnResume('2026-07-11', 'weekly', '2026-07-12')).toBe('2026-07-18')
    })

    it('next already after resume day is unchanged', () => {
      expect(advanceNextDateOnResume('2026-08-11', 'monthly', '2026-07-12')).toBe('2026-08-11')
    })
  })

  describe('getMissedOccurrences', () => {
    it('returns empty array when next_date is in the future', () => {
      expect(getMissedOccurrences('2026-05-10', 'weekly', '2026-05-09')).toEqual([])
    })

    it('returns the single date when next_date equals asOf (due today)', () => {
      expect(getMissedOccurrences('2026-05-09', 'weekly', '2026-05-09')).toEqual(['2026-05-09'])
    })

    it('weekly: one week overdue yields 1 occurrence', () => {
      expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-07')).toEqual(['2026-05-01'])
    })

    it('weekly: three weeks elapsed but not yet on boundary — 3 occurrences', () => {
      expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-21')).toEqual([
        '2026-05-01', '2026-05-08', '2026-05-15',
      ])
    })

    it('weekly: exactly on the 3-week boundary — 4th charge fires today too', () => {
      expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-22')).toEqual([
        '2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22',
      ])
    })

    it('retroactive weekly subscription set 3 months back produces correct count and bounds', () => {
      const result = getMissedOccurrences('2026-02-01', 'weekly', '2026-05-01')
      expect(result).toHaveLength(13)
      expect(result[0]).toBe('2026-02-01')
      expect(result[12]).toBe('2026-04-26')
    })

    it('monthly: 3 periods lapsed before boundary — 3 charges', () => {
      expect(getMissedOccurrences('2026-02-01', 'monthly', '2026-04-30')).toEqual([
        '2026-02-01', '2026-03-01', '2026-04-01',
      ])
    })

    it('monthly: exactly on the 3-month boundary — today\'s charge fires too (4 total)', () => {
      expect(getMissedOccurrences('2026-02-01', 'monthly', '2026-05-01')).toEqual([
        '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01',
      ])
    })

    it('monthly: next_date is today — only that date is included, not the next month', () => {
      expect(getMissedOccurrences('2026-05-09', 'monthly', '2026-05-09')).toEqual(['2026-05-09'])
    })

    it('yearly: 2 years elapsed before anniversary — 2 charges', () => {
      expect(getMissedOccurrences('2024-01-15', 'yearly', '2026-01-14')).toEqual([
        '2024-01-15', '2025-01-15',
      ])
    })

    it('yearly: exactly on the 2-year anniversary — today\'s charge fires too (3 total)', () => {
      expect(getMissedOccurrences('2024-01-15', 'yearly', '2026-01-15')).toEqual([
        '2024-01-15', '2025-01-15', '2026-01-15',
      ])
    })

    it('time-simulation: weekly sub started May 9, advance to Jun 5 — 4 charges', () => {
      const result = getMissedOccurrences('2026-05-09', 'weekly', '2026-06-05')
      expect(result).toHaveLength(4)
      expect(result).toEqual(['2026-05-09', '2026-05-16', '2026-05-23', '2026-05-30'])
    })

    it('time-simulation: weekly sub started May 9, advance to Jun 6 (boundary) — 5th charge fires', () => {
      const result = getMissedOccurrences('2026-05-09', 'weekly', '2026-06-06')
      expect(result).toHaveLength(5)
      expect(result[4]).toBe('2026-06-06')
    })

    it('time-simulation: monthly sub Jan 1, advance to Jun 30 — 6 charges', () => {
      const result = getMissedOccurrences('2026-01-01', 'monthly', '2026-06-30')
      expect(result).toHaveLength(6)
      expect(result[0]).toBe('2026-01-01')
      expect(result[5]).toBe('2026-06-01')
    })

    it('time-simulation: yearly sub started 3 years ago — 3 charges, no charge for the future year', () => {
      const result = getMissedOccurrences('2023-06-01', 'yearly', '2026-05-31')
      expect(result).toHaveLength(3)
      expect(result).toEqual(['2023-06-01', '2024-06-01', '2025-06-01'])
    })
  })
})

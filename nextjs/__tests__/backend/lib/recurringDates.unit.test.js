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
    it('monthly wraps year', () => {
      expect(addPeriod('2026-12-10', 'monthly')).toBe('2027-01-10')
    })

    it('yearly adds one year', () => {
      expect(addPeriod('2026-03-20', 'yearly')).toBe('2027-03-20')
    })

    it('weekly crossing month boundary', () => {
      expect(addPeriod('2026-04-28', 'weekly')).toBe('2026-05-05')
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

    it('weekly: exactly on the 3-week boundary — 4th charge fires today too', () => {
      expect(getMissedOccurrences('2026-05-01', 'weekly', '2026-05-22')).toEqual([
        '2026-05-01', '2026-05-08', '2026-05-15', '2026-05-22',
      ])
    })

    it('monthly: exactly on the 3-month boundary — today\'s charge fires too (4 total)', () => {
      expect(getMissedOccurrences('2026-02-01', 'monthly', '2026-05-01')).toEqual([
        '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01',
      ])
    })

    it('yearly: exactly on the 2-year anniversary — today\'s charge fires too (3 total)', () => {
      expect(getMissedOccurrences('2024-01-15', 'yearly', '2026-01-15')).toEqual([
        '2024-01-15', '2025-01-15', '2026-01-15',
      ])
    })

  })
})

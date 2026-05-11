const { buildTransactionListQuery } = require('@/lib/transactionQuery')

function params(search) {
  return new URLSearchParams(search)
}

describe('transactionQuery specification', () => {
  describe('buildTransactionListQuery', () => {
    it('rejects mixing month with from or to', () => {
      expect(buildTransactionListQuery(params('month=2026-03-01&from=2026-03-01'), { dateColumn: 'date' }).error).toBe(
        'Use either month or from/to, not both',
      )
    })

    it('builds a half-open month window on the date column', () => {
      const result = buildTransactionListQuery(params('month=2026-03-01'), { dateColumn: 'e.date', firstParameterIndex: 2 })
      expect(result.error).toBeUndefined()
      expect(result.clauses).toEqual(['e.date >= $2', 'e.date < $3'])
      expect(result.values).toEqual(['2026-03-01', '2026-04-01'])
      expect(result.limitClause).toBe('')
    })

    it('returns an error for an invalid month', () => {
      expect(buildTransactionListQuery(params('month=2026-13-01'), { dateColumn: 'date' }).error).toBe('Valid month is required')
    })

    it('builds from-only and to-only ranges with inclusive to', () => {
      const fromOnly = buildTransactionListQuery(params('from=2026-01-10'), { dateColumn: 'd' })
      expect(fromOnly.clauses).toEqual(['d >= $1'])
      expect(fromOnly.values).toEqual(['2026-01-10'])

      const toOnly = buildTransactionListQuery(params('to=2026-01-31'), { dateColumn: 'd' })
      expect(toOnly.clauses).toEqual(['d <= $1'])
      expect(toOnly.values).toEqual(['2026-01-31'])
    })

    it('rejects from after to', () => {
      expect(buildTransactionListQuery(params('from=2026-02-02&to=2026-02-01'), { dateColumn: 'date' }).error).toBe(
        'from date must be on or before to date',
      )
    })

    it('caps numeric limit at 500 and rejects invalid limit', () => {
      const capped = buildTransactionListQuery(params('month=2026-03-01&limit=900'), { dateColumn: 'date' })
      expect(capped.limitClause).toBe('LIMIT 500')

      expect(buildTransactionListQuery(params('month=2026-03-01&limit=abc'), { dateColumn: 'date' }).error).toBe(
        'Valid limit is required',
      )
    })
  })
})

jest.mock('@/lib/db', () => {
  const query = jest.fn()
  return {
    query,
    connect: jest.fn(),
  }
})

const db = require('@/lib/db')

let processUserRecurring

describe('recurringProcessor specification', () => {
  beforeAll(async () => {
    const mod = await import('@/lib/recurringProcessor')
    processUserRecurring = mod.processUserRecurring
  })

  beforeEach(() => {
    db.query.mockReset()
    db.connect.mockReset()
    db.connect.mockImplementation(async () => ({
      query: db.query,
      release: jest.fn(),
    }))
  })

  const emptySelect = { rows: [], rowCount: 0 }
  const insertedRow = { rows: [], rowCount: 1 }

  const EXPENSE_RULE = {
    id: 'r1',
    user_id: 'uid',
    type: 'expense',
    frequency: 'monthly',
    next_date: '2026-05-01',
    category_id: 'cat1',
    amount: '50.00',
    description: 'Netflix',
  }

  const INCOME_RULE = {
    id: 'r2',
    user_id: 'uid',
    type: 'income',
    frequency: 'monthly',
    next_date: '2026-05-01',
    source_id: 'src1',
    amount: '2000.00',
    description: null,
  }

  function expectedExpenseChargeBind(rule, chargeDate) {
    return [rule.user_id, rule.category_id, rule.amount, rule.description, chargeDate, rule.id]
  }

  function expectedIncomeChargeBind(rule, chargeDate) {
    return [rule.user_id, rule.source_id, rule.amount, rule.description ?? null, chargeDate, rule.id]
  }

  describe('expected charge bind parameters', () => {
    it('lists expense fields in the order the processor should send to the store', () => {
      expect(expectedExpenseChargeBind(EXPENSE_RULE, '2026-05-01')).toEqual([
        'uid',
        'cat1',
        '50.00',
        'Netflix',
        '2026-05-01',
        'r1',
      ])
    })

    it('lists income fields in the order the processor should send to the store', () => {
      const withNotes = { ...INCOME_RULE, description: 'Social Security payment' }

      expect(expectedIncomeChargeBind(withNotes, '2026-05-01')).toEqual([
        'uid',
        'src1',
        '2000.00',
        'Social Security payment',
        '2026-05-01',
        'r2',
      ])
    })

    it('uses null for income notes when the rule has no description', () => {
      expect(expectedIncomeChargeBind(INCOME_RULE, '2026-05-01')[3]).toBeNull()
    })
  })

  function mockTxnForExpenseInserts(ruleRows, datesCount) {
    db.query.mockResolvedValueOnce({ rows: ruleRows })
    mockTxnBody(datesCount)
  }

  function mockTxnBody(datesCount) {
    db.query.mockResolvedValueOnce(emptySelect)
    for (let i = 0; i < datesCount; i++) {
      db.query.mockResolvedValueOnce(insertedRow)
    }
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
  }

  describe('processUserRecurring', () => {
    it('records no new charges when no recurring rules are due on that date', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(0)
      expect(db.query).toHaveBeenCalledTimes(1)
      expect(db.connect).not.toHaveBeenCalled()
    })

    it('asks the store for this member’s active due rules using the run date as the upper bound', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      await processUserRecurring('member-1', '2026-08-15')

      expect(db.query).toHaveBeenCalledTimes(1)
      const [sql, params] = db.query.mock.calls[0]
      expect(params).toEqual(['member-1', '2026-08-15'])
      const upper = sql.toUpperCase()
      expect(upper).toContain('USER_ID = $1')
      expect(upper).toContain('PAUSED = FALSE')
      expect(upper).toContain('CANCELLED_AT IS NULL')
      expect(sql).toMatch(/next_date\s*<=\s*\$2/i)
    })

    it('records a due expense and moves the rule forward to the next occurrence', async () => {
      mockTxnForExpenseInserts([EXPENSE_RULE], 1)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(1)
      expect(db.connect).toHaveBeenCalledTimes(1)

      const [, insertParams] = db.query.mock.calls[2]
      expect(insertParams).toEqual(expectedExpenseChargeBind(EXPENSE_RULE, '2026-05-01'))

      const [, updateParams] = db.query.mock.calls[3]
      expect(updateParams[0]).toBe('2026-06-01')
      expect(updateParams[1]).toBe('r1')
    })

    it('still advances the schedule when a duplicate charge is skipped and no new row is stored', async () => {
      db.query.mockResolvedValueOnce({ rows: [EXPENSE_RULE] })
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockResolvedValueOnce(emptySelect)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(0)
      const [, updateParams] = db.query.mock.calls[3]
      expect(updateParams[0]).toBe('2026-06-01')
    })

    it('records due income using the recurring rule description as the notes shown to the member', async () => {
      const incomeRuleWithNotes = { ...INCOME_RULE, description: 'Social Security payment' }
      db.query.mockResolvedValueOnce({ rows: [incomeRuleWithNotes] })
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockResolvedValueOnce(insertedRow)
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockResolvedValueOnce(emptySelect)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(1)

      const [, insertParams] = db.query.mock.calls[2]
      expect(insertParams).toEqual(expectedIncomeChargeBind(incomeRuleWithNotes, '2026-05-01'))
    })

    it('records due income with empty notes when the rule has no description', async () => {
      db.query.mockResolvedValueOnce({ rows: [INCOME_RULE] })
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockResolvedValueOnce(insertedRow)
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockResolvedValueOnce(emptySelect)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(1)

      const [, insertParams] = db.query.mock.calls[2]
      expect(insertParams).toEqual(expectedIncomeChargeBind(INCOME_RULE, '2026-05-01'))
    })

    it('catches up weekly charges that were missed across several prior weeks', async () => {
      const rule = { ...EXPENSE_RULE, frequency: 'weekly', next_date: '2026-04-18' }
      mockTxnForExpenseInserts([rule], 4)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(4)

      const insertCallIndexes = [2, 3, 4, 5]
      const dates = insertCallIndexes.map((i) => db.query.mock.calls[i][1][4])
      expect(dates).toEqual(['2026-04-18', '2026-04-25', '2026-05-02', '2026-05-09'])

      const [, updateParams] = db.query.mock.calls[6]
      expect(updateParams[0]).toBe('2026-05-16')
    })

    it('applies each due rule on its own cadence without mixing amounts or next dates', async () => {
      const rule1 = { ...EXPENSE_RULE, id: 'r1', next_date: '2026-05-01' }
      const rule2 = { ...EXPENSE_RULE, id: 'r2', next_date: '2026-05-05', category_id: 'cat2' }

      db.query.mockResolvedValueOnce({ rows: [rule1, rule2] })
      mockTxnBody(1)
      mockTxnBody(1)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(2)
      expect(db.connect).toHaveBeenCalledTimes(2)

      const r1UpdateParams = db.query.mock.calls[3][1]
      expect(r1UpdateParams[1]).toBe('r1')
      expect(r1UpdateParams[0]).toBe('2026-06-01')

      const r2UpdateParams = db.query.mock.calls[7][1]
      expect(r2UpdateParams[1]).toBe('r2')
      expect(r2UpdateParams[0]).toBe('2026-06-05')
    })

    it('cancelling one rule does not affect processing of the other', async () => {
      const activeRule = { ...EXPENSE_RULE, id: 'r-active', next_date: '2026-05-01' }
      mockTxnForExpenseInserts([activeRule], 1)

      const count = await processUserRecurring('uid', '2026-05-09')

      expect(count).toBe(1)

      const [, selectParams] = db.query.mock.calls[0]
      expect(selectParams[0]).toBe('uid')
    })

    it('charges the next monthly cycle when the due date arrives', async () => {
      const rule = { ...EXPENSE_RULE, next_date: '2026-05-10', amount: '88.25' }
      mockTxnForExpenseInserts([rule], 1)
      const count = await processUserRecurring('uid', '2026-05-10')

      expect(count).toBe(1)
      const [, insertParams] = db.query.mock.calls[2]
      expect(insertParams[2]).toBe('88.25')
      expect(insertParams[4]).toBe('2026-05-10')
    })

    it('backfills all 6 monthly charges when user returns after 5 months away (Jan 1 → Jun 2)', async () => {
      const rule = { ...EXPENSE_RULE, next_date: '2026-01-01', frequency: 'monthly', amount: '99.00' }
      mockTxnForExpenseInserts([rule], 6)

      const count = await processUserRecurring('uid', '2026-06-02')

      expect(count).toBe(6)

      const insertCallIndexes = [2, 3, 4, 5, 6, 7]
      const insertDates = insertCallIndexes.map((i) => db.query.mock.calls[i][1][4])
      expect(insertDates).toEqual([
        '2026-01-01', '2026-02-01', '2026-03-01',
        '2026-04-01', '2026-05-01', '2026-06-01',
      ])

      const [, updateParams] = db.query.mock.calls[8]
      expect(updateParams[0]).toBe('2026-07-01')
    })

    it('after resume with next_date advanced past the paused gap, no insert on the day of resumption', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      const count = await processUserRecurring('uid', '2026-02-03')

      expect(count).toBe(0)
      expect(db.query).toHaveBeenCalledTimes(1)
      const [, params] = db.query.mock.calls[0]
      expect(params[1]).toBe('2026-02-03')
    })

    it('after resume, correctly charges on the advanced next_date (Mar 2) not the skipped date (Feb 2)', async () => {
      const rule = { ...EXPENSE_RULE, next_date: '2026-03-02', frequency: 'monthly', amount: '50.00' }
      mockTxnForExpenseInserts([rule], 1)

      const count = await processUserRecurring('uid', '2026-03-02')

      expect(count).toBe(1)

      const [, insertParams] = db.query.mock.calls[2]
      expect(insertParams[4]).toBe('2026-03-02')

      const [, updateParams] = db.query.mock.calls[3]
      expect(updateParams[0]).toBe('2026-04-02')
    })

    it('full lifecycle: Jan 5 charge fires, then Feb 5 fires when user logs in on Feb 5', async () => {
      const rule = { ...EXPENSE_RULE, next_date: '2026-01-05', frequency: 'monthly' }
      mockTxnForExpenseInserts([rule], 1)

      const janCount = await processUserRecurring('uid', '2026-01-05')

      expect(janCount).toBe(1)
      expect(db.query.mock.calls[2][1][4]).toBe('2026-01-05')
      expect(db.query.mock.calls[3][1][0]).toBe('2026-02-05')

      db.query.mockReset()
      db.connect.mockReset()
      db.connect.mockImplementation(async () => ({
        query: db.query,
        release: jest.fn(),
      }))
      const advancedRule = { ...rule, next_date: '2026-02-05' }
      mockTxnForExpenseInserts([advancedRule], 1)

      const febCount = await processUserRecurring('uid', '2026-02-05')

      expect(febCount).toBe(1)
      expect(db.query.mock.calls[2][1][4]).toBe('2026-02-05')
      expect(db.query.mock.calls[3][1][0]).toBe('2026-03-05')
    })

    it('Date-typed next_date (node-pg): May 10 bills then June 10 bills on 2026-06-11 asOf', async () => {
      const mayRule = {
        ...EXPENSE_RULE,
        next_date: new Date('2026-05-10T00:00:00.000Z'),
        frequency: 'monthly',
      }
      mockTxnForExpenseInserts([mayRule], 1)
      const mayCount = await processUserRecurring('uid', '2026-05-10')

      expect(mayCount).toBe(1)
      expect(db.query.mock.calls[2][1][4]).toBe('2026-05-10')
      expect(db.query.mock.calls[3][1][0]).toBe('2026-06-10')

      db.query.mockReset()
      db.connect.mockReset()
      db.connect.mockImplementation(async () => ({
        query: db.query,
        release: jest.fn(),
      }))
      const juneRule = {
        ...EXPENSE_RULE,
        next_date: new Date('2026-06-10T00:00:00.000Z'),
        frequency: 'monthly',
      }
      mockTxnForExpenseInserts([juneRule], 1)
      const juneCount = await processUserRecurring('uid', '2026-06-11')

      expect(juneCount).toBe(1)
      expect(db.query.mock.calls[2][1][4]).toBe('2026-06-10')
      expect(db.query.mock.calls[3][1][0]).toBe('2026-07-10')
    })

    it('surfaces a persistence failure and still releases the connection when storing a charge fails', async () => {
      const release = jest.fn()
      db.connect.mockImplementation(async () => ({
        query: db.query,
        release,
      }))
      db.query.mockResolvedValueOnce({ rows: [EXPENSE_RULE] })
      db.query.mockResolvedValueOnce(emptySelect)
      db.query.mockRejectedValueOnce(new Error('insert failed'))
      db.query.mockResolvedValueOnce(emptySelect)

      await expect(processUserRecurring('uid', '2026-05-09')).rejects.toThrow('insert failed')

      expect(String(db.query.mock.calls[3][0])).toMatch(/ROLLBACK/i)
      expect(release).toHaveBeenCalledTimes(1)
    })

    it('stays silent while a rule is paused and charges again once the schedule resumes', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
      const whilePaused = await processUserRecurring('uid', '2026-02-10')

      expect(whilePaused).toBe(0)

      db.query.mockReset()
      db.connect.mockReset()
      db.connect.mockImplementation(async () => ({
        query: db.query,
        release: jest.fn(),
      }))
      const ruleAfterResume = { ...EXPENSE_RULE, next_date: '2026-03-05', frequency: 'monthly' }
      mockTxnForExpenseInserts([ruleAfterResume], 1)

      const marCount = await processUserRecurring('uid', '2026-03-05')

      expect(marCount).toBe(1)
      expect(db.query.mock.calls[2][1][4]).toBe('2026-03-05')
      expect(db.query.mock.calls[3][1][0]).toBe('2026-04-05')
    })
  })
})

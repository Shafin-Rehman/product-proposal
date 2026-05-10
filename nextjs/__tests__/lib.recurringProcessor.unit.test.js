jest.mock('@/lib/db', () => {
  const query = jest.fn()
  return {
    query,
    connect: jest.fn(),
  }
})

const db = require('@/lib/db')

let processUserRecurring

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

/** Per-date path: EXISTS (no row) + INSERT; then UPDATE + COMMIT after all dates */
function mockTxnForExpenseInserts(ruleRows, datesCount) {
  db.query.mockResolvedValueOnce({ rows: ruleRows })
  mockTxnBody(datesCount)
}

function mockTxnBody(datesCount) {
  db.query.mockResolvedValueOnce(emptySelect) // BEGIN
  for (let i = 0; i < datesCount; i++) {
    db.query.mockResolvedValueOnce(emptySelect) // EXISTS
    db.query.mockResolvedValueOnce(emptySelect) // INSERT
  }
  db.query.mockResolvedValueOnce(emptySelect) // UPDATE rule
  db.query.mockResolvedValueOnce(emptySelect) // COMMIT
}

describe('processUserRecurring', () => {
  it('returns 0 and makes only SELECT when no rules are due', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(0)
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(db.connect).not.toHaveBeenCalled()
    const [sql] = db.query.mock.calls[0]
    expect(sql.toUpperCase()).toContain('SELECT')
    expect(sql.toUpperCase()).toContain('RECURRING_RULES')
  })

  it('inserts expense row and updates next_date for a due rule', async () => {
    mockTxnForExpenseInserts([EXPENSE_RULE], 1)

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(1)
    expect(db.connect).toHaveBeenCalledTimes(1)

    const [insertSql, insertParams] = db.query.mock.calls[3]
    expect(insertSql.toUpperCase()).toContain('INSERT INTO PUBLIC.EXPENSES')
    expect(insertParams[0]).toBe('uid')
    expect(insertParams[1]).toBe('cat1')
    expect(insertParams[2]).toBe('50.00')
    expect(insertParams[4]).toBe('2026-05-01')
    expect(insertParams[5]).toBe('r1')

    const [updateSql, updateParams] = db.query.mock.calls[4]
    expect(updateSql.toUpperCase()).toContain('UPDATE PUBLIC.RECURRING_RULES')
    expect(updateParams[0]).toBe('2026-06-01')
    expect(updateParams[1]).toBe('r1')
  })

  it('skips INSERT when expense already exists for rule and date but still advances next_date', async () => {
    db.query.mockResolvedValueOnce({ rows: [EXPENSE_RULE] })
    db.query.mockResolvedValueOnce(emptySelect) // BEGIN
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 }) // EXISTS hit
    db.query.mockResolvedValueOnce(emptySelect) // UPDATE
    db.query.mockResolvedValueOnce(emptySelect) // COMMIT

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(0)
    const insertCalls = db.query.mock.calls.filter(([s]) => String(s).toUpperCase().includes('INSERT INTO PUBLIC.EXPENSES'))
    expect(insertCalls).toHaveLength(0)
    const [updateSql, updateParams] = db.query.mock.calls[3]
    expect(updateSql.toUpperCase()).toContain('UPDATE PUBLIC.RECURRING_RULES')
    expect(updateParams[0]).toBe('2026-06-01')
  })

  it('inserts income row with notes copied from rule.description', async () => {
    const incomeRuleWithNotes = { ...INCOME_RULE, description: 'Social Security payment' }
    db.query.mockResolvedValueOnce({ rows: [incomeRuleWithNotes] })
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(1)

    const [insertSql, insertParams] = db.query.mock.calls[3]
    expect(insertSql.toUpperCase()).toContain('INSERT INTO PUBLIC.INCOME')
    expect(insertSql.toUpperCase()).toContain('NOTES')
    expect(insertParams[1]).toBe('src1')
    expect(insertParams[2]).toBe('2000.00')
    expect(insertParams[3]).toBe('Social Security payment')
    expect(insertParams[4]).toBe('2026-05-01')
    expect(insertParams[5]).toBe('r2')
  })

  it('inserts income row with null notes when rule.description is null', async () => {
    db.query.mockResolvedValueOnce({ rows: [INCOME_RULE] })
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)
    db.query.mockResolvedValueOnce(emptySelect)

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(1)

    const [insertSql, insertParams] = db.query.mock.calls[3]
    expect(insertSql.toUpperCase()).toContain('INSERT INTO PUBLIC.INCOME')
    expect(insertParams[3]).toBeNull()
    expect(insertParams[4]).toBe('2026-05-01')
    expect(insertParams[5]).toBe('r2')
  })

  it('inserts 4 expenses for a weekly rule added 3 weeks retroactively', async () => {
    const rule = { ...EXPENSE_RULE, frequency: 'weekly', next_date: '2026-04-18' }
    mockTxnForExpenseInserts([rule], 4)

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(4)

    const insertCallIndexes = [3, 5, 7, 9]
    const dates = insertCallIndexes.map((i) => db.query.mock.calls[i][1][4])
    expect(dates).toEqual(['2026-04-18', '2026-04-25', '2026-05-02', '2026-05-09'])

    const [, updateParams] = db.query.mock.calls[10]
    expect(updateParams[0]).toBe('2026-05-16')
  })

  it('processes two rules independently: each gets its own INSERT and UPDATE', async () => {
    const rule1 = { ...EXPENSE_RULE, id: 'r1', next_date: '2026-05-01' }
    const rule2 = { ...EXPENSE_RULE, id: 'r2', next_date: '2026-05-05', category_id: 'cat2' }

    db.query.mockResolvedValueOnce({ rows: [rule1, rule2] })
    mockTxnBody(1)
    mockTxnBody(1)

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(2)
    expect(db.connect).toHaveBeenCalledTimes(2)

    const r1UpdateParams = db.query.mock.calls[4][1]
    expect(r1UpdateParams[1]).toBe('r1')
    expect(r1UpdateParams[0]).toBe('2026-06-01')

    const r2UpdateParams = db.query.mock.calls[9][1]
    expect(r2UpdateParams[1]).toBe('r2')
    expect(r2UpdateParams[0]).toBe('2026-06-05')
  })

  it('cancelling one rule does not affect processing of the other', async () => {
    const activeRule = { ...EXPENSE_RULE, id: 'r-active', next_date: '2026-05-01' }
    mockTxnForExpenseInserts([activeRule], 1)

    const count = await processUserRecurring('uid', '2026-05-09')
    expect(count).toBe(1)

    const [selectSql, selectParams] = db.query.mock.calls[0]
    expect(selectSql.toUpperCase()).toContain('CANCELLED_AT IS NULL')
    expect(selectParams[0]).toBe('uid')
  })

  it('SELECT query filters by user_id and excludes paused and cancelled rules', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await processUserRecurring('uid', '2026-05-09')
    const [sql, params] = db.query.mock.calls[0]
    expect(sql.toUpperCase()).toContain('PAUSED = FALSE')
    expect(sql.toUpperCase()).toContain('CANCELLED_AT IS NULL')
    expect(params[0]).toBe('uid')
  })

  it('charges the next monthly cycle when the due date arrives', async () => {
    const rule = { ...EXPENSE_RULE, next_date: '2026-05-10', amount: '88.25' }
    mockTxnForExpenseInserts([rule], 1)
    const count = await processUserRecurring('uid', '2026-05-10')
    expect(count).toBe(1)
    const [, insertParams] = db.query.mock.calls[3]
    expect(insertParams[2]).toBe('88.25')
    expect(insertParams[4]).toBe('2026-05-10')
  })

  it('passes asOf as the SQL date bound so the query is consistent with getMissedOccurrences', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await processUserRecurring('uid', '2026-06-02')
    const [sql, params] = db.query.mock.calls[0]
    expect(params[0]).toBe('uid')
    expect(params[1]).toBe('2026-06-02')
    expect(sql).toMatch(/next_date\s*<=\s*\$2/i)
  })

  it('backfills all 6 monthly charges when user returns after 5 months away (Jan 1 → Jun 2)', async () => {
    const rule = { ...EXPENSE_RULE, next_date: '2026-01-01', frequency: 'monthly', amount: '99.00' }
    mockTxnForExpenseInserts([rule], 6)

    const count = await processUserRecurring('uid', '2026-06-02')
    expect(count).toBe(6)

    const insertCallIndexes = [3, 5, 7, 9, 11, 13]
    const insertDates = insertCallIndexes.map((i) => db.query.mock.calls[i][1][4])
    expect(insertDates).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01',
      '2026-04-01', '2026-05-01', '2026-06-01',
    ])

    const [, updateParams] = db.query.mock.calls[14]
    expect(updateParams[0]).toBe('2026-07-01')
  })

  it('paused rule is excluded by the query: 0 inserts even if months have passed', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const count = await processUserRecurring('uid', '2026-02-25')
    expect(count).toBe(0)
    expect(db.query).toHaveBeenCalledTimes(1)
    const [sql] = db.query.mock.calls[0]
    expect(sql.toUpperCase()).toContain('PAUSED = FALSE')
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

    const [, insertParams] = db.query.mock.calls[3]
    expect(insertParams[4]).toBe('2026-03-02')

    const [, updateParams] = db.query.mock.calls[4]
    expect(updateParams[0]).toBe('2026-04-02')
  })

  it('cancelled rule is excluded by the query: 0 inserts and query contains cancelled_at guard', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const count = await processUserRecurring('uid', '2026-06-02')
    expect(count).toBe(0)
    expect(db.query).toHaveBeenCalledTimes(1)
    const [sql] = db.query.mock.calls[0]
    expect(sql.toUpperCase()).toContain('CANCELLED_AT IS NULL')
  })

  it('full lifecycle: Jan 5 charge fires, then Feb 5 fires when user logs in on Feb 5', async () => {
    const rule = { ...EXPENSE_RULE, next_date: '2026-01-05', frequency: 'monthly' }
    mockTxnForExpenseInserts([rule], 1)

    const janCount = await processUserRecurring('uid', '2026-01-05')
    expect(janCount).toBe(1)
    expect(db.query.mock.calls[3][1][4]).toBe('2026-01-05')
    expect(db.query.mock.calls[4][1][0]).toBe('2026-02-05')

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
    expect(db.query.mock.calls[3][1][4]).toBe('2026-02-05')
    expect(db.query.mock.calls[4][1][0]).toBe('2026-03-05')
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
    expect(db.query.mock.calls[3][1][4]).toBe('2026-05-10')
    expect(db.query.mock.calls[4][1][0]).toBe('2026-06-10')

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
    expect(db.query.mock.calls[3][1][4]).toBe('2026-06-10')
    expect(db.query.mock.calls[4][1][0]).toBe('2026-07-10')
  })

  it('full lifecycle: paused rule produces 0 inserts while paused, then charges the next cycle after resume', async () => {
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
    expect(db.query.mock.calls[3][1][4]).toBe('2026-03-05')
    expect(db.query.mock.calls[4][1][0]).toBe('2026-04-05')
  })
})

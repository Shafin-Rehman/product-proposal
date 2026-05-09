jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/supabaseClient', () => ({}))
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/recurringProcessor', () => ({ processUserRecurring: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')
const { processUserRecurring } = require('@/lib/recurringProcessor')

const recurringHandler = require('@/app/api/recurring/route')
const processHandler = require('@/app/api/recurring/process/route')
const updateHandler = require('@/app/api/recurring/update/route')
const deleteHandler = require('@/app/api/recurring/delete/route')

const post = (body) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

const BASE_RULE = {
  id: 'rule-1',
  user_id: 'uid',
  type: 'expense',
  amount: '11.99',
  category_id: 'cat-1',
  source_id: null,
  description: 'Spotify',
  frequency: 'monthly',
  start_date: '2026-05-01',
  next_date: '2026-06-01',
  paused: false,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

beforeEach(() => {
  db.query.mockReset()
  authenticate.mockReset()
  processUserRecurring.mockReset()
  authenticate.mockResolvedValue({ user: { id: 'uid', email: 'a@b.com' } })
  processUserRecurring.mockResolvedValue(0)
})

describe('GET /api/recurring', () => {
  it('SQL excludes cancelled rules (WHERE cancelled_at IS NULL)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        await fetch({ method: 'GET' })
        const [sql] = db.query.mock.calls[0]
        expect(sql.toUpperCase()).toContain('CANCELLED_AT IS NULL')
      },
    })
  })

  it('200 - returns empty array when user has no rules', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual([])
      },
    })
  })

  it('200 - returns rules without user_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [BASE_RULE] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        const [rule] = await res.json()
        expect(rule.id).toBe('rule-1')
        expect(rule).not.toHaveProperty('user_id')
        expect(rule.amount).toBe('11.99')
        expect(rule.frequency).toBe('monthly')
      },
    })
  })

  it('SQL joins categories and income_sources to resolve names', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        await fetch({ method: 'GET' })
        const [sql] = db.query.mock.calls[0]
        expect(sql.toUpperCase()).toContain('LEFT JOIN')
        expect(sql.toUpperCase()).toContain('CATEGORIES')
        expect(sql.toUpperCase()).toContain('INCOME_SOURCES')
      },
    })
  })

  it('response includes category_name and source_name from the join', async () => {
    const ruleWithNames = { ...BASE_RULE, category_name: 'Bills', source_name: null }
    db.query.mockResolvedValueOnce({ rows: [ruleWithNames] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        const [rule] = await res.json()
        expect(rule).toHaveProperty('category_name', 'Bills')
        expect(rule).toHaveProperty('source_name', null)
      },
    })
  })

  it('401 - unauthenticated request is rejected', async () => {
    authenticate.mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(401)
      },
    })
  })
})

describe('POST /api/recurring', () => {
  it('201 - creates expense recurring rule', async () => {
    db.query.mockResolvedValueOnce({ rows: [BASE_RULE] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          type: 'expense',
          amount: 11.99,
          description: 'Spotify',
          frequency: 'monthly',
          start_date: '2026-05-01',
          category_id: 'cat-1',
        }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.id).toBe('rule-1')
        expect(body).not.toHaveProperty('user_id')
      },
    })
  })

  it('201 - creates income recurring rule with source_id', async () => {
    const incomeRule = { ...BASE_RULE, id: 'rule-2', type: 'income', source_id: 'src-1', category_id: null }
    db.query.mockResolvedValueOnce({ rows: [incomeRule] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          type: 'income',
          amount: 500,
          frequency: 'monthly',
          start_date: '2026-05-01',
          source_id: 'src-1',
        }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.type).toBe('income')
        expect(body.source_id).toBe('src-1')
      },
    })
  })

  it('400 - missing type', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 10, frequency: 'monthly', start_date: '2026-05-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/type/i)
      },
    })
  })

  it('400 - invalid type value', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ type: 'transfer', amount: 10, frequency: 'monthly', start_date: '2026-05-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/type/i)
      },
    })
  })

  it('400 - missing amount', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ type: 'expense', frequency: 'monthly', start_date: '2026-05-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/amount/i)
      },
    })
  })

  it('400 - zero amount is rejected', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ type: 'expense', amount: 0, frequency: 'monthly', start_date: '2026-05-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/amount/i)
      },
    })
  })

  it('400 - invalid frequency', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ type: 'expense', amount: 10, frequency: 'daily', start_date: '2026-05-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/frequency/i)
      },
    })
  })

  it('400 - missing start_date', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ type: 'expense', amount: 10, frequency: 'monthly' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/start_date/i)
      },
    })
  })

  it('400 - invalid start_date format', async () => {
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({ type: 'expense', amount: 10, frequency: 'monthly', start_date: 'not-a-date' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/start_date/i)
      },
    })
  })

  it('201 - next_date is addPeriod(start_date) and processUserRecurring is invoked', async () => {
    const rule = { ...BASE_RULE, start_date: '2026-05-09', next_date: '2026-06-09' }
    db.query.mockResolvedValueOnce({ rows: [rule] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          type: 'expense', amount: 11.99, frequency: 'monthly', start_date: '2026-05-09',
        }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body.next_date).toBe('2026-06-09')
        expect(processUserRecurring).toHaveBeenCalledWith('uid')
      },
    })
  })
})

describe('POST /api/recurring — original transaction linking', () => {
  it('expense_id causes an UPDATE on expenses to set recurring_rule_id', async () => {
    const rule = { ...BASE_RULE, id: 'rule-x' }
    db.query
      .mockResolvedValueOnce({ rows: [rule] })
      .mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          type: 'expense', amount: 11.99, frequency: 'monthly',
          start_date: '2026-05-09', expense_id: 'exp-99',
        }))
        expect(res.status).toBe(201)
        const updateCall = db.query.mock.calls[1]
        expect(updateCall[0].toUpperCase()).toContain('UPDATE')
        expect(updateCall[0].toUpperCase()).toContain('EXPENSES')
        expect(updateCall[1]).toContain('rule-x')
        expect(updateCall[1]).toContain('exp-99')
      },
    })
  })

  it('income_id causes an UPDATE on income to set recurring_rule_id', async () => {
    const rule = { ...BASE_RULE, id: 'rule-y', type: 'income' }
    db.query
      .mockResolvedValueOnce({ rows: [rule] })
      .mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        await fetch(post({
          type: 'income', amount: 500, frequency: 'monthly',
          start_date: '2026-05-09', income_id: 'inc-77',
        }))
        const updateCall = db.query.mock.calls[1]
        expect(updateCall[0].toUpperCase()).toContain('UPDATE')
        expect(updateCall[0].toUpperCase()).toContain('INCOME')
        expect(updateCall[1]).toContain('rule-y')
        expect(updateCall[1]).toContain('inc-77')
      },
    })
  })

  it('without expense_id or income_id makes exactly 1 db call (INSERT only)', async () => {
    db.query.mockResolvedValueOnce({ rows: [BASE_RULE] })
    await testApiHandler({
      appHandler: recurringHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          type: 'expense', amount: 11.99, frequency: 'monthly', start_date: '2026-05-09',
        }))
        expect(res.status).toBe(201)
        expect(db.query.mock.calls).toHaveLength(1)
      },
    })
  })
})

describe('POST /api/recurring/process', () => {
  it('200 - calls processUserRecurring with the authenticated userId', async () => {
    processUserRecurring.mockResolvedValueOnce(3)
    await testApiHandler({
      appHandler: processHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'POST' })
        expect(res.status).toBe(200)
        expect((await res.json()).generated).toBe(3)
        expect(processUserRecurring).toHaveBeenCalledTimes(1)
        expect(processUserRecurring).toHaveBeenCalledWith('uid')
      },
    })
  })

  it('200 - returns 0 when no rules are due', async () => {
    processUserRecurring.mockResolvedValueOnce(0)
    await testApiHandler({
      appHandler: processHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'POST' })
        expect(res.status).toBe(200)
        expect((await res.json()).generated).toBe(0)
      },
    })
  })

  it('401 - unauthenticated request is rejected', async () => {
    authenticate.mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })
    await testApiHandler({
      appHandler: processHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'POST' })
        expect(res.status).toBe(401)
        expect(processUserRecurring).not.toHaveBeenCalled()
      },
    })
  })
})

describe('POST /api/recurring/update', () => {
  it('200 - updates amount and description', async () => {
    const updated = { ...BASE_RULE, amount: '14.99', description: 'Spotify Premium' }
    db.query.mockResolvedValueOnce({ rows: [updated] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'rule-1', amount: 14.99, description: 'Spotify Premium' }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.amount).toBe('14.99')
        expect(body.description).toBe('Spotify Premium')
      },
    })
  })

  it('200 - pauses an active rule', async () => {
    const paused = { ...BASE_RULE, paused: true }
    db.query.mockResolvedValueOnce({ rows: [paused] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'rule-1', paused: true }))
        expect(res.status).toBe(200)
        expect((await res.json()).paused).toBe(true)
      },
    })
  })

  it('200 - resumes a paused rule', async () => {
    const paused = { ...BASE_RULE, paused: true }
    const active = { ...BASE_RULE, paused: false }
    db.query
      .mockResolvedValueOnce({ rows: [paused] })
      .mockResolvedValueOnce({ rows: [active] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'rule-1', paused: false }))
        expect(res.status).toBe(200)
        expect((await res.json()).paused).toBe(false)
      },
    })
  })

  it('resuming after missing a due date skips that cycle and advances next_date', async () => {
    jest.useFakeTimers()
    try {
      jest.setSystemTime(new Date('2026-04-10T12:00:00Z'))
      const pausedPastDue = {
        ...BASE_RULE,
        paused: true,
        frequency: 'monthly',
        next_date: '2026-04-09',
      }
      const resumed = { ...pausedPastDue, paused: false, next_date: '2026-05-09' }
      db.query
        .mockResolvedValueOnce({ rows: [pausedPastDue] })
        .mockResolvedValueOnce({ rows: [resumed] })
      await testApiHandler({
        appHandler: updateHandler,
        async test({ fetch }) {
          const res = await fetch(post({ rule_id: 'rule-1', paused: false }))
          expect(res.status).toBe(200)
          const body = await res.json()
          expect(body.paused).toBe(false)
          expect(body.next_date).toBe('2026-05-09')
          expect(db.query).toHaveBeenCalledTimes(2)
          const [, updateParams] = db.query.mock.calls[1]
          expect(updateParams).toContain('2026-05-09')
        },
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('400 - missing rule_id', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 5 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/rule_id/i)
      },
    })
  })

  it('400 - invalid amount', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'rule-1', amount: -5 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/amount/i)
      },
    })
  })

  it('400 - invalid frequency', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'rule-1', frequency: 'hourly' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/frequency/i)
      },
    })
  })

  it('404 - rule not found or not owned by user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'no-such-rule', paused: true }))
        expect(res.status).toBe(404)
      },
    })
  })
})

describe('POST /api/recurring/delete', () => {
  it('200 - soft-cancels the rule (returns the updated row with cancelled_at)', async () => {
    const cancelled = { ...BASE_RULE, cancelled_at: '2026-05-09T00:00:00Z' }
    db.query.mockResolvedValueOnce({ rows: [cancelled] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'rule-1' }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.id).toBe('rule-1')
        expect(body).toHaveProperty('cancelled_at')
        expect(body.cancelled_at).toBeTruthy()
      },
    })
  })

  it('SQL uses UPDATE SET cancelled_at, not DELETE', async () => {
    const cancelled = { ...BASE_RULE, cancelled_at: '2026-05-09T00:00:00Z' }
    db.query.mockResolvedValueOnce({ rows: [cancelled] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        await fetch(post({ rule_id: 'rule-1' }))
        const [sql] = db.query.mock.calls[0]
        expect(sql.toUpperCase()).toContain('UPDATE')
        expect(sql.toUpperCase()).toContain('CANCELLED_AT')
        expect(sql.toUpperCase()).not.toContain('DELETE')
      },
    })
  })

  it('400 - missing rule_id', async () => {
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({}))
        expect(res.status).toBe(400)
      },
    })
  })

  it('SQL WHERE clause binds the specific rule_id — cannot cancel a different rule', async () => {
    const cancelled = { ...BASE_RULE, id: 'rule-1', cancelled_at: '2026-05-09T00:00:00Z' }
    db.query.mockResolvedValueOnce({ rows: [cancelled] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        await fetch(post({ rule_id: 'rule-1' }))
        const [, params] = db.query.mock.calls[0]
        expect(params).toContain('rule-1')
        expect(params).not.toContain('rule-2')
      },
    })
  })

  it('404 - rule not found or not owned by user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ rule_id: 'ghost' }))
        expect(res.status).toBe(404)
      },
    })
  })
})


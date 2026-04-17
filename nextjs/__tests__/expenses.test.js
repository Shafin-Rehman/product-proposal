jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/budget', () => {
  const actual = jest.requireActual('@/lib/budget')
  return {
    ...actual,
    evaluateThresholdForMonth: jest.fn(),
    isPositiveMoneyValue: jest.fn(actual.isPositiveMoneyValue),
    normalizeDate: jest.fn(actual.normalizeDate),
  }
})

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')
const { evaluateThresholdForMonth, isPositiveMoneyValue, normalizeDate } = require('@/lib/budget')
const actualBudget = jest.requireActual('@/lib/budget')
const expensesHandler = require('@/app/api/expenses/route')
const getHandler = require('@/app/api/expenses/get/route')
const updateHandler = require('@/app/api/expenses/update/route')
const deleteHandler = require('@/app/api/expenses/delete/route')

const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  db.query.mockClear()
  authenticate.mockClear()
  evaluateThresholdForMonth.mockClear()
  isPositiveMoneyValue.mockClear()
  normalizeDate.mockClear()
  authenticate.mockResolvedValue({ user: { id: 'uid', email: 'a@b.com' } })
  evaluateThresholdForMonth.mockResolvedValue(null)
  isPositiveMoneyValue.mockImplementation(actualBudget.isPositiveMoneyValue)
  normalizeDate.mockImplementation(actualBudget.normalizeDate)
})

describe('POST /api/expenses', () => {
  const row = { id: 1, user_id: 'uid', category_id: null, amount: '25.00', description: 'Coffee', date: '2026-03-01', created_at: '2026-03-01T10:00:00Z' }

  it('201 - creates expense, without user_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 25, date: '2026-03-01', description: 'Coffee' }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, amount: '25.00', description: 'Coffee' })
        expect(body).not.toHaveProperty('user_id')
        expect(body.budget_alert).toBeNull()
      }
    })
  })

  it('201 - accepts category_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, category_id: 3 }] })
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 25, date: '2026-03-01', category_id: 3 }))
        expect(res.status).toBe(201)
        expect((await res.json()).category_id).toBe(3)
      }
    })
  })

  it('201 - returns a budget alert when the threshold is crossed', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    evaluateThresholdForMonth.mockResolvedValueOnce({
      threshold_exceeded: true,
      month: '2026-03-01',
      monthly_limit: '20.00',
      total_expenses: '25.00',
    })
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 25, date: '2026-03-01' }))
        expect(res.status).toBe(201)
        expect((await res.json()).budget_alert).toEqual({
          month: '2026-03-01',
          monthly_limit: '20.00',
          total_expenses: '25.00',
          threshold_exceeded: true,
        })
      }
    })
  })

  it('400 - missing amount', async () => {
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ date: '2026-03-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount and date are required')
      }
    })
  })

  it('400 - missing date', async () => {
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 25 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount and date are required')
      }
    })
  })

  it('400 - rejects a non-positive amount', async () => {
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 0, date: '2026-03-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('400 - rejects a positive amount with more than 2 decimal places', async () => {
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 0.001, date: '2026-03-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('400 - rejects an invalid date', async () => {
    normalizeDate.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 25, date: 'bad-date' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid date is required')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })
})

describe('GET /api/expenses', () => {
  it('200 - returns list, omits user_id', async () => {
    const rows = [
      { id: 1, user_id: 'uid', amount: '10.00', date: '2026-03-01', category_name: 'Food' },
      { id: 2, user_id: 'uid', amount: '20.00', date: '2026-03-02', category_name: null },
    ]
    db.query.mockResolvedValueOnce({ rows })
    await testApiHandler({
      appHandler: expensesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveLength(2)
        expect(body[0]).toMatchObject({ id: 1, amount: '10.00', date: '2026-03-01', category_name: 'Food' })
        expect(body[1]).toMatchObject({ id: 2, amount: '20.00', category_name: null })
        body.forEach(e => expect(e).not.toHaveProperty('user_id'))
      }
    })
  })
})

describe('POST /api/expenses/get', () => {
  const row = { id: 1, user_id: 'uid', amount: '15.00', date: '2026-03-01', category_name: 'Travel' }

  it('200 - returns expense, omits user_id', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1 }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, amount: '15.00', category_name: 'Travel' })
        expect(body).not.toHaveProperty('user_id')
      }
    })
  })

  it('400 - missing expense_id', async () => {
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({}))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('expense_id required')
      }
    })
  })

  it('404 - not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 999 }))
        expect(res.status).toBe(404)
        expect((await res.json()).error).toBe('Expense not found')
      }
    })
  })
})

describe('POST /api/expenses/update', () => {
  const row = { id: 1, user_id: 'uid', category_id: 2, amount: '30.00', date: '2026-03-01', description: 'Updated' }

  it('200 - updates amount, omits user_id', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ date: '2026-02-15' }] })
      .mockResolvedValueOnce({ rows: [row] })
    evaluateThresholdForMonth
      .mockResolvedValueOnce({ alertTriggered: false, budget_alert: null })
      .mockResolvedValueOnce({
        alertTriggered: true,
        budget_alert: {
          month: '2026-03-01',
          monthly_limit: '20.00',
          total_expenses: '30.00',
          threshold_exceeded: true,
        }
      })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1, amount: 30 }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, amount: '30.00' })
        expect(body).not.toHaveProperty('user_id')
        expect(body.budget_alert).toEqual({
          month: '2026-03-01',
          monthly_limit: '20.00',
          total_expenses: '30.00',
          threshold_exceeded: true,
        })
      }
    })
  })

  it('200 - normalizes a timestamp date before updating', async () => {
    normalizeDate.mockReturnValueOnce('2026-03-02')
    db.query
      .mockResolvedValueOnce({ rows: [{ date: '2026-03-01' }] })
      .mockResolvedValueOnce({ rows: [{ ...row, date: '2026-03-02' }] })
    evaluateThresholdForMonth
      .mockResolvedValueOnce({ alertTriggered: false, budget_alert: null })
      .mockResolvedValueOnce({ alertTriggered: false, budget_alert: null })

    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1, date: '2026-03-02T09:15:00Z' }))
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining('UPDATE public.expenses SET'),
          ['2026-03-02', 1, 'uid']
        )
      }
    })
  })

  it('400 - missing expense_id', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 30 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('expense_id required')
      }
    })
  })

  it('400 - rejects a non-positive update amount', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1, amount: 'abc' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('400 - rejects an update amount with more than 2 decimal places', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1, amount: '1.999' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('400 - rejects an invalid update date', async () => {
    normalizeDate.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1, date: 'bad-date' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid date is required')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })
})

describe('POST /api/expenses/delete', () => {
  it('200 - deleted with budget alert status', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ date: '2026-03-01' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
    evaluateThresholdForMonth.mockResolvedValueOnce({ budget_alert: null, alertTriggered: false })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 1 }))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ id: 1, budget_alert: null })
      }
    })
    expect(evaluateThresholdForMonth).toHaveBeenCalledWith('uid', '2026-03-01')
  })

  it('400 - missing expense_id', async () => {
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({}))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('expense_id required')
      }
    })
  })

  it('404 - not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ expense_id: 999 }))
        expect(res.status).toBe(404)
        expect((await res.json()).error).toBe('Expense not found')
      }
    })
  })
})

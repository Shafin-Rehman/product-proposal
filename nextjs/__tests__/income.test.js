jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/budget', () => {
  const actual = jest.requireActual('@/lib/budget')
  return {
    ...actual,
    isPositiveMoneyValue: jest.fn(actual.isPositiveMoneyValue),
    normalizeDate: jest.fn(actual.normalizeDate),
  }
})

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')
const { isPositiveMoneyValue, normalizeDate } = require('@/lib/budget')
const actualBudget = jest.requireActual('@/lib/budget')
const incomeHandler = require('@/app/api/income/route')
const categoriesHandler = require('@/app/api/income/categories/route')
const getHandler = require('@/app/api/income/get/route')
const updateHandler = require('@/app/api/income/update/route')
const deleteHandler = require('@/app/api/income/delete/route')
const {
  INCOME_NOTES_LENGTH_MESSAGE,
  INCOME_NOTES_MAX_LENGTH,
} = require('@/lib/transactionText')

const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  db.query.mockClear()
  authenticate.mockClear()
  normalizeDate.mockClear()
  isPositiveMoneyValue.mockClear()
  authenticate.mockResolvedValue({ user: { id: 'uid', email: 'a@b.com' } })
  normalizeDate.mockImplementation(actualBudget.normalizeDate)
  isPositiveMoneyValue.mockImplementation(actualBudget.isPositiveMoneyValue)
})

describe('POST /api/income', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', date: '2026-03-15', notes: null, created_at: '2026-03-01T10:00:00Z' }

  it('creates income entry and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, date: '2026-03-15' }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', date: '2026-03-15' })
        expect(body).not.toHaveProperty('user_id')
      }
    })
  })

  it('normalizes the stored date', async () => {
    normalizeDate.mockReturnValueOnce('2026-03-15')
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, date: '2026-03-15T08:45:00Z' }))
        expect(res.status).toBe(201)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO public.income'),
          ['uid', null, 3000, '2026-03-15', null]
        )
      }
    })
  })

  it('accepts notes at the length limit', async () => {
    const notes = 'N'.repeat(INCOME_NOTES_MAX_LENGTH)
    db.query.mockResolvedValueOnce({ rows: [{ ...row, notes }] })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, date: '2026-03-15', notes }))
        expect(res.status).toBe(201)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO public.income'),
          ['uid', null, 3000, '2026-03-15', notes]
        )
      }
    })
  })

  it('rejects request without amount', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ date: '2026-03-15' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount and date are required')
      }
    })
  })

  it('rejects request without date', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount and date are required')
      }
    })
  })

  it('rejects request with an invalid date', async () => {
    normalizeDate.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, date: 'bad' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid date is required')
      }
    })
  })

  it('rejects request with a non-positive amount', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 0, date: '2026-03-15' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects request with a positive amount that exceeds 2 decimal places', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: '0.001', date: '2026-03-15' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects over-limit notes before querying', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          amount: 3000,
          date: '2026-03-15',
          notes: 'N'.repeat(INCOME_NOTES_MAX_LENGTH + 1),
        }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe(INCOME_NOTES_LENGTH_MESSAGE)
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })
})

describe('GET /api/income', () => {
  it('returns all income entries ordered by date and strips user_id from each', async () => {
    const rows = [
      { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', date: '2026-03-15', notes: null, source_name: 'Salary', source_icon: '💼' },
      { id: 2, user_id: 'uid', source_id: 'src-2', amount: '500.00', date: '2026-02-28', notes: 'Side project', source_name: 'Freelance', source_icon: '💻' },
    ]
    db.query.mockResolvedValueOnce({ rows })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveLength(2)
        expect(body[0]).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', date: '2026-03-15', source_name: 'Salary' })
        expect(body[1]).toMatchObject({ id: 2, source_id: 'src-2', notes: 'Side project', date: '2026-02-28', source_name: 'Freelance' })
        body.forEach((income) => expect(income).not.toHaveProperty('user_id'))
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY i.date DESC, i.created_at DESC'),
          ['uid']
        )
      }
    })
  })

  it('keeps the unfiltered list behavior when no query params are provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE i.user_id = $1'),
          ['uid']
        )
        expect(db.query.mock.calls[0][0]).not.toContain('LIMIT')
      }
    })
  })

  it('can narrow income entries to a requested month', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: incomeHandler,
      url: 'http://localhost/api/income?month=2026-03',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE i.user_id = $1 AND i.date >= $2 AND i.date < $3'),
          ['uid', '2026-03-01', '2026-04-01']
        )
      }
    })
  })

  it('can narrow income entries by date range and limit', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: incomeHandler,
      url: 'http://localhost/api/income?from=2026-02-01&to=2026-02-28&limit=5',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE i.user_id = $1 AND i.date >= $2 AND i.date <= $3'),
          ['uid', '2026-02-01', '2026-02-28']
        )
        expect(db.query.mock.calls[0][0]).toContain('LIMIT 5')
      }
    })
  })

  it.each([
    ['an empty limit', 'http://localhost/api/income?limit='],
    ['a non-numeric limit', 'http://localhost/api/income?limit=ten'],
  ])('rejects %s before querying', async (_label, url) => {
    await testApiHandler({
      appHandler: incomeHandler,
      url,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid limit is required')
        expect(db.query).not.toHaveBeenCalled()
      }
    })
  })

  it('rejects ambiguous month and range filters before querying', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      url: 'http://localhost/api/income?month=2026-03-01&from=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Use either month or from/to, not both')
        expect(db.query).not.toHaveBeenCalled()
      }
    })
  })

  it.each([
    ['an empty month', 'http://localhost/api/income?month=', 'Valid month is required'],
    ['an invalid month', 'http://localhost/api/income?month=2026-13', 'Valid month is required'],
    ['an empty from date', 'http://localhost/api/income?from=', 'Valid from date is required'],
    ['an invalid from date', 'http://localhost/api/income?from=not-a-date', 'Valid from date is required'],
    ['an empty to date', 'http://localhost/api/income?to=', 'Valid to date is required'],
    ['an invalid to date', 'http://localhost/api/income?to=not-a-date', 'Valid to date is required'],
    ['a from date after the to date', 'http://localhost/api/income?from=2026-03-15&to=2026-03-01', 'from date must be on or before to date'],
  ])('rejects %s before querying', async (_label, url, expectedError) => {
    await testApiHandler({
      appHandler: incomeHandler,
      url,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe(expectedError)
        expect(db.query).not.toHaveBeenCalled()
      }
    })
  })

  it('returns 500 on db failure', async () => {
    db.query.mockRejectedValueOnce(new Error())
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(500)
        expect((await res.json()).error).toBe('Failed to fetch income')
      }
    })
  })
})

describe('GET /api/income/categories', () => {
  it('returns all income categories', async () => {
    const rows = [
      { id: 'src-1', name: 'Salary', icon: '💼' },
      { id: 'src-2', name: 'Freelance', icon: '💻' },
    ]
    db.query.mockResolvedValueOnce({ rows })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveLength(2)
        expect(body[0]).toMatchObject({ id: 'src-1', name: 'Salary', icon: '💼' })
      }
    })
  })

  it('returns 401 when not authenticated', async () => {
    const { NextResponse } = require('next/server')
    authenticate.mockResolvedValueOnce({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) })
    await testApiHandler({
      appHandler: categoriesHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(401)
      }
    })
  })
})

describe('POST /api/income/get', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', date: '2026-03-15', notes: null, source_name: 'Salary', source_icon: '💼' }

  it('returns income entry and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1 }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', date: '2026-03-15', source_name: 'Salary' })
        expect(body).not.toHaveProperty('user_id')
      }
    })
  })

  it('rejects request without income_id', async () => {
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({}))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('income_id required')
      }
    })
  })

  it('returns 404 when income entry does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 999 }))
        expect(res.status).toBe(404)
        expect((await res.json()).error).toBe('Income not found')
      }
    })
  })
})

describe('POST /api/income/update', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3500.00', date: '2026-03-22', notes: null }

  it('updates amount and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, amount: 3500 }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, amount: '3500.00', date: '2026-03-22' })
        expect(body).not.toHaveProperty('user_id')
      }
    })
  })

  it('normalizes date during update', async () => {
    normalizeDate.mockReturnValueOnce('2026-03-22')
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, date: '2026-03-22T09:15:00Z' }))
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE public.income SET'),
          ['2026-03-22', 1, 'uid']
        )
      }
    })
  })

  it('persists source_id null when the client explicitly clears the source on edit', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, source_id: null }] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, source_id: null }))
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE public.income SET'),
          [null, 1, 'uid']
        )
      }
    })
  })

  it('accepts notes at the length limit during update', async () => {
    const notes = 'N'.repeat(INCOME_NOTES_MAX_LENGTH)
    db.query.mockResolvedValueOnce({ rows: [{ ...row, notes }] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, notes }))
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE public.income SET'),
          [notes, 1, 'uid']
        )
      }
    })
  })

  it('persists notes null when the client clears the note on edit', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...row, notes: null }] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, notes: null }))
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE public.income SET'),
          [null, 1, 'uid']
        )
      }
    })
  })

  it('rejects update without income_id', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3500 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('income_id required')
      }
    })
  })

  it('rejects update when no fields are provided', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('No fields provided to update')
      }
    })
  })

  it('rejects update with an invalid date', async () => {
    normalizeDate.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, date: 'bad' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid date is required')
      }
    })
  })

  it('rejects update with a non-numeric amount', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, amount: 'abc' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects update with a positive amount that exceeds 2 decimal places', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, amount: '1.999' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount must be a valid positive money amount')
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects over-limit update notes before querying', async () => {
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({
          income_id: 1,
          notes: 'N'.repeat(INCOME_NOTES_MAX_LENGTH + 1),
        }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe(INCOME_NOTES_LENGTH_MESSAGE)
      }
    })
    expect(db.query).not.toHaveBeenCalled()
  })
})

describe('POST /api/income/delete', () => {
  it('deletes income entry and returns 204', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1 }))
        expect(res.status).toBe(204)
      }
    })
  })

  it('rejects delete without income_id', async () => {
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({}))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('income_id required')
      }
    })
  })

  it('returns 404 when income entry does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    await testApiHandler({
      appHandler: deleteHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 999 }))
        expect(res.status).toBe(404)
        expect((await res.json()).error).toBe('Income not found')
      }
    })
  })
})

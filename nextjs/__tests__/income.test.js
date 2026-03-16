jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/supabaseClient', () => ({ signUp: jest.fn(), signIn: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/budget', () => ({ normalizeMonth: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')
const { normalizeMonth } = require('@/lib/budget')
const incomeHandler = require('@/app/api/income/route')
const categoriesHandler = require('@/app/api/income/categories/route')
const getHandler = require('@/app/api/income/get/route')
const updateHandler = require('@/app/api/income/update/route')
const deleteHandler = require('@/app/api/income/delete/route')

const post = (body) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  db.query.mockClear()
  authenticate.mockClear()
  normalizeMonth.mockClear()
  authenticate.mockResolvedValue({ user: { id: 'uid', email: 'a@b.com' } })
  normalizeMonth.mockImplementation(value => value)
})

describe('POST /api/income', () => {
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', month: '2026-03-01', notes: null, created_at: '2026-03-01T10:00:00Z' }

  it('creates income entry and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, month: '2026-03-01' }))
        expect(res.status).toBe(201)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', month: '2026-03-01' })
        expect(body).not.toHaveProperty('user_id')
      }
    })
  })

  it('normalizes the stored month to month-start', async () => {
    normalizeMonth.mockReturnValueOnce('2026-03-01')
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, month: '2026-03-15' }))
        expect(res.status).toBe(201)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO public.income'),
          ['uid', null, 3000, '2026-03-01', null]
        )
      }
    })
  })

  it('rejects request without amount', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount and month are required')
      }
    })
  })

  it('rejects request without month', async () => {
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000 }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('amount and month are required')
      }
    })
  })

  it('rejects request with an invalid month', async () => {
    normalizeMonth.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch(post({ amount: 3000, month: 'bad' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid month is required')
      }
    })
  })

})

describe('GET /api/income', () => {
  it('returns all income entries and strips user_id from each', async () => {
    const rows = [
      { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', month: '2026-03-01', notes: null, source_name: 'Salary', source_icon: '💼' },
      { id: 2, user_id: 'uid', source_id: 'src-2', amount: '500.00', month: '2026-02-01', notes: 'Side project', source_name: 'Freelance', source_icon: '💻' },
    ]
    db.query.mockResolvedValueOnce({ rows })
    await testApiHandler({
      appHandler: incomeHandler,
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveLength(2)
        expect(body[0]).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', source_name: 'Salary' })
        expect(body[1]).toMatchObject({ id: 2, source_id: 'src-2', notes: 'Side project', source_name: 'Freelance' })
        body.forEach(i => expect(i).not.toHaveProperty('user_id'))
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
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3000.00', month: '2026-03-01', notes: null, source_name: 'Salary', source_icon: '💼' }

  it('returns income entry and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: getHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1 }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, source_id: 'src-1', amount: '3000.00', source_name: 'Salary' })
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
  const row = { id: 1, user_id: 'uid', source_id: 'src-1', amount: '3500.00', month: '2026-03-01', notes: null }

  it('updates amount and strips user_id from response', async () => {
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, amount: 3500 }))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toMatchObject({ id: 1, amount: '3500.00' })
        expect(body).not.toHaveProperty('user_id')
      }
    })
  })

  it('normalizes month during update', async () => {
    normalizeMonth.mockReturnValueOnce('2026-03-01')
    db.query.mockResolvedValueOnce({ rows: [row] })
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, month: '2026-03-22' }))
        expect(res.status).toBe(200)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE public.income SET'),
          ['2026-03-01', 1, 'uid']
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

  it('rejects update with an invalid month', async () => {
    normalizeMonth.mockReturnValueOnce(null)
    await testApiHandler({
      appHandler: updateHandler,
      async test({ fetch }) {
        const res = await fetch(post({ income_id: 1, month: 'bad' }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Valid month is required')
      }
    })
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

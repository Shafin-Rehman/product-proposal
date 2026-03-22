jest.mock('@/lib/db', () => ({ query: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')
const budgetHandler = require('@/app/api/budget/route')

const post = (body) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
})

describe('budget route integration', () => {
  beforeEach(() => {
    db.query.mockReset()
    authenticate.mockReset()
    authenticate.mockResolvedValue({ user: { id: 'uid', email: 'a@b.com' } })
  })

  it('saves a budget and returns the evaluated notification state', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: false }],
      })
      .mockResolvedValueOnce({
        rows: [{ month: '2026-03-01', monthly_limit: '100.00', notified: false }],
      })
      .mockResolvedValueOnce({
        rows: [{ total_expenses: '120.00' }],
      })
      .mockResolvedValueOnce({
        rows: [{ total_income: '2500.00' }],
      })
      .mockResolvedValueOnce({ rows: [] })

    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 100 }))

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
          month: '2026-03-01',
          monthly_limit: '100.00',
          notified: true,
        })
      },
    })
  })

  it('returns 500 when the db layer throws', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'))

    await testApiHandler({
      appHandler: budgetHandler,
      async test({ fetch }) {
        const res = await fetch(post({ month: '2026-03-01', monthly_limit: 100 }))

        expect(res.status).toBe(500)
        expect(await res.json()).toEqual({ error: 'Failed to save budget' })
      },
    })
  })
})

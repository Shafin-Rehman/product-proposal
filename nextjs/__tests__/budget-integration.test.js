jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/db', () => ({ query: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const { authenticate } = require('@/lib/auth')
const db = require('@/lib/db')
const budgetHandler = require('@/app/api/budget/summary/route')

const authorizedUser = { id: 'uid', email: 'a@b.com' }

beforeEach(() => {
  authenticate.mockClear()
  db.query.mockClear()
  authenticate.mockResolvedValue({ user: authorizedUser })
})

describe('GET /api/budget/summary integration', () => {
  it('correctly calculates remaining budget from DB (Integration)', async () => {
    // We mock the DB to supply raw data, but the integration between 
    // the API route and budget.js business logic is real.
    
    // getMonthlyBudget DB call
    db.query.mockResolvedValueOnce({
      rows: [{ month: '2026-03-01', monthly_limit: '1000.00', notified: false }]
    })
    
    // getMonthlyTotals DB calls (Promise.all - expenses then income, or whichever order)
    db.query.mockResolvedValueOnce({
      rows: [{ total_expenses: '450.00' }]
    })
    db.query.mockResolvedValueOnce({
      rows: [{ total_income: '3000.00' }]
    })

    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget/summary?month=2026-03-15',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(200)
        const summary = await res.json()
        
        // Asserting the logic performed by budget.js!
        expect(summary.month).toBe('2026-03-01') // Normalized month
        expect(summary.remaining_budget).toBe('550.00') // 1000 - 450
        expect(summary.total_income).toBe('3000.00')
        expect(summary.threshold_exceeded).toBe(false)
      }
    })
  })

  it('cascades DB error to the API response correctly (Integration)', async () => {
    // Simulate DB failure
    db.query.mockRejectedValueOnce(new Error('DB Connection Failed'))

    await testApiHandler({
      appHandler: budgetHandler,
      url: 'http://localhost/api/budget/summary?month=2026-03-01',
      async test({ fetch }) {
        const res = await fetch()
        expect(res.status).toBe(500)
        expect((await res.json()).error).toBe('Failed to fetch budget summary')
      }
    })
  })
})

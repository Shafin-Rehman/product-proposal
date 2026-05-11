jest.mock('@/lib/auth', () => ({ authenticate: jest.fn() }))
jest.mock('@/lib/budget', () => ({ normalizeMonth: jest.fn() }))
jest.mock('@/lib/insights', () => ({ buildInsightsSnapshot: jest.fn() }))

const { testApiHandler } = require('next-test-api-route-handler')
const { authenticate } = require('@/lib/auth')
const { normalizeMonth } = require('@/lib/budget')
const { buildInsightsSnapshot } = require('@/lib/insights')
const insightsHandler = require('@/app/api/insights/route')

beforeEach(() => {
  authenticate.mockReset()
  normalizeMonth.mockReset()
  buildInsightsSnapshot.mockReset()
})

describe('GET /api/insights', () => {
  it('returns the aggregated snapshot for a valid month', async () => {
    authenticate.mockResolvedValueOnce({ user: { id: 'uid' } })
    normalizeMonth.mockReturnValueOnce('2026-03-01')
    buildInsightsSnapshot.mockResolvedValueOnce({ month: '2026-03-01', comparisonMetrics: [] })

    await testApiHandler({
      appHandler: insightsHandler,
      url: 'http://localhost/api/insights?month=2026-03-01',
      async test({ fetch }) {
        const response = await fetch()
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ month: '2026-03-01', comparisonMetrics: [] })
      },
    })

    expect(buildInsightsSnapshot).toHaveBeenCalledWith('uid', '2026-03-01')
  })

  it('returns 400 when the month is invalid', async () => {
    authenticate.mockResolvedValueOnce({ user: { id: 'uid' } })
    normalizeMonth.mockReturnValueOnce(null)

    await testApiHandler({
      appHandler: insightsHandler,
      url: 'http://localhost/api/insights?month=bad-date',
      async test({ fetch }) {
        const response = await fetch()
        expect(response.status).toBe(400)
        expect((await response.json()).error).toBe('Valid month is required')
      },
    })
  })

  it('returns the auth error when unauthenticated', async () => {
    authenticate.mockResolvedValueOnce({
      user: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    })

    await testApiHandler({
      appHandler: insightsHandler,
      url: 'http://localhost/api/insights?month=2026-03-01',
      async test({ fetch }) {
        const response = await fetch()
        expect(response.status).toBe(401)
        expect((await response.json()).error).toBe('Unauthorized')
      },
    })
  })
})

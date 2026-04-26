jest.mock('@/lib/healthChecks', () => ({
  runHealthChecks: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { runHealthChecks } = require('@/lib/healthChecks')
const healthHandler = require('@/app/api/health/route')

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 200 with status ok when all checks pass', async () => {
    runHealthChecks.mockResolvedValue([
      { name: 'database', status: 'ok', message: undefined },
      { name: 'supabase', status: 'ok', message: undefined },
    ])
    await testApiHandler({
      appHandler: healthHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toEqual({ status: 'ok' })
      },
    })
  })

  it('returns 503 with status degraded when database check fails', async () => {
    runHealthChecks.mockResolvedValue([
      { name: 'database', status: 'error', message: 'Database unreachable' },
      { name: 'supabase', status: 'ok', message: undefined },
    ])
    await testApiHandler({
      appHandler: healthHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(503)
        const body = await res.json()
        expect(body).toEqual({ status: 'degraded' })
      },
    })
  })

  it('returns 503 with status degraded when supabase check fails', async () => {
    runHealthChecks.mockResolvedValue([
      { name: 'database', status: 'ok', message: undefined },
      { name: 'supabase', status: 'error', message: 'Supabase unreachable' },
    ])
    await testApiHandler({
      appHandler: healthHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(503)
        const body = await res.json()
        expect(body).toEqual({ status: 'degraded' })
      },
    })
  })

  it('returns 503 with status degraded when all checks fail', async () => {
    runHealthChecks.mockResolvedValue([
      { name: 'database', status: 'error', message: 'Database unreachable' },
      { name: 'supabase', status: 'error', message: 'Supabase unreachable' },
    ])
    await testApiHandler({
      appHandler: healthHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(503)
        const body = await res.json()
        expect(body).toEqual({ status: 'degraded' })
      },
    })
  })

  it('does not expose internal check details in the response body', async () => {
    runHealthChecks.mockResolvedValue([
      { name: 'database', status: 'error', message: 'connection refused at host db.internal' },
    ])
    await testApiHandler({
      appHandler: healthHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        const body = await res.json()
        expect(body).not.toHaveProperty('checks')
      },
    })
  })
})

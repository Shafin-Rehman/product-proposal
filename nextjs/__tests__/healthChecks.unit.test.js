jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}))

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: jest.fn(),
}))

const pool = require('@/lib/db')
const { getSupabaseClient } = require('@/lib/supabaseClient')
const { runHealthChecks } = require('@/lib/healthChecks')

describe('runHealthChecks - database check', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
    })
  })

  it('reports ok with no error message when the query succeeds', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'ok', message: undefined })
  })

  it('reports error with the rejection message when the query throws', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'))

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'error', message: 'connection refused' })
  })

  it('reports fallback error message when the query throws with no message', async () => {
    pool.query.mockRejectedValue(new Error())

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'error', message: 'Database unreachable' })
  })
})

describe('runHealthChecks - supabase check', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })
  })

  it('reports ok with no error message when the Supabase query succeeds', async () => {
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[1]).toEqual({ name: 'supabase', status: 'ok', message: undefined })
  })

  it('reports error with the Supabase error message when the query fails', async () => {
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: { message: 'service unavailable' } }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[1]).toEqual({ name: 'supabase', status: 'error', message: 'service unavailable' })
  })

  it('reports fallback error message when Supabase error has no message', async () => {
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: { message: '' } }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[1]).toEqual({ name: 'supabase', status: 'error', message: 'Supabase unreachable' })
  })
})

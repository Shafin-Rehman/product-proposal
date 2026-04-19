jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}))

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: jest.fn(),
}))

const pool = require('@/lib/db')
const { getSupabaseClient } = require('@/lib/supabaseClient')
const { runHealthChecks } = require('@/lib/healthChecks')

describe('runHealthChecks', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns ok for all checks when DB and Supabase are healthy', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
    })

    const results = await runHealthChecks()

    expect(results).toEqual([
      { name: 'database', status: 'ok', message: undefined },
      { name: 'supabase', status: 'ok', message: undefined },
    ])
  })

  it('returns database error with message when DB is down, Supabase still ok', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'))
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'error', message: 'connection refused' })
    expect(results[1]).toEqual({ name: 'supabase', status: 'ok', message: undefined })
  })

  it('returns supabase error with message when Supabase is down, DB still ok', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: { message: 'service unavailable' } }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'ok', message: undefined })
    expect(results[1]).toEqual({ name: 'supabase', status: 'error', message: 'service unavailable' })
  })

  it('returns errors for all checks with messages when both DB and Supabase are down', async () => {
    pool.query.mockRejectedValue(new Error('DB down'))
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: { message: 'Supabase down' } }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'error', message: 'DB down' })
    expect(results[1]).toEqual({ name: 'supabase', status: 'error', message: 'Supabase down' })
  })

  it('returns fallback messages when errors have no message', async () => {
    pool.query.mockRejectedValue(new Error())
    getSupabaseClient.mockReturnValue({
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: { message: '' } }) }) }),
    })

    const results = await runHealthChecks()

    expect(results[0]).toEqual({ name: 'database', status: 'error', message: 'Database unreachable' })
    expect(results[1]).toEqual({ name: 'supabase', status: 'error', message: 'Supabase unreachable' })
  })
})

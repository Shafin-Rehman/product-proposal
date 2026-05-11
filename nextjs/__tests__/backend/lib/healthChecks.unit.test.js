jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}))

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: jest.fn(),
}))

const pool = require('@/lib/db')
const { getSupabaseClient } = require('@/lib/supabaseClient')
const { runHealthChecks } = require('@/lib/healthChecks')

describe('healthChecks specification', () => {
  describe('runHealthChecks database probe', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      getSupabaseClient.mockReturnValue({
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
      })
    })

    it('marks the database check healthy when the pool responds', async () => {
      pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

      const results = await runHealthChecks()

      expect(results[0]).toEqual({ name: 'database', status: 'ok', message: undefined })
    })

    it.each([
      new Error('connection refused'),
      new Error(),
    ])('reports database check as error when the pool rejects (%#)', async (error) => {
      pool.query.mockRejectedValue(error)

      const results = await runHealthChecks()

      expect(results[0]).toEqual({ name: 'database', status: 'error', message: 'Database unreachable' })
    })
  })

  describe('runHealthChecks Supabase probe', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    })

    it('marks the Supabase check healthy when the client responds without an error', async () => {
      getSupabaseClient.mockReturnValue({
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: null }) }) }),
      })

      const results = await runHealthChecks()

      expect(results[1]).toEqual({ name: 'supabase', status: 'ok', message: undefined })
    })

    it.each([
      { message: 'service unavailable' },
      { message: '' },
    ])('reports supabase check as error when the client returns an error object (%#)', async ({ message }) => {
      getSupabaseClient.mockReturnValue({
        from: () => ({ select: () => ({ limit: () => Promise.resolve({ error: { message } }) }) }),
      })

      const results = await runHealthChecks()

      expect(results[1]).toEqual({ name: 'supabase', status: 'error', message: 'Supabase unreachable' })
    })
  })
})

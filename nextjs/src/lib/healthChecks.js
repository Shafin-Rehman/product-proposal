import pool from '@/lib/db'
import { getSupabaseClient } from '@/lib/supabaseClient'

const checks = [
  {
    name: 'database',
    defaultError: 'Database unreachable',
    check: async () => {
      await pool.query('SELECT 1')
    },
  },
  {
    name: 'supabase',
    defaultError: 'Supabase unreachable',
    check: async () => {
      const { error } = await getSupabaseClient().from('users').select('id').limit(1)
      if (error) throw new Error(error.message || 'Supabase unreachable')
    },
  },
]

export async function runHealthChecks() {
  const results = await Promise.allSettled(checks.map(({ check }) => check()))
  return checks.map(({ name, defaultError }, i) => ({
    name,
    status: results[i].status === 'fulfilled' ? 'ok' : 'error',
    message: results[i].status === 'rejected'
      ? (results[i].reason?.message || defaultError)
      : undefined,
  }))
}

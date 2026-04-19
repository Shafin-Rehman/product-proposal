import { NextResponse } from 'next/server'
import db from './db'
import { getSupabaseClient } from './supabaseClient'

export async function authenticate(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 }) }
  }

  const token = authHeader.slice(7)
  const { data: { user }, error } = await getSupabaseClient().auth.getUser(token)

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 }) }
  }

  await db.query(
    `INSERT INTO public.users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [user.id, user.email]
  )

  return { user }
}

import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { signIn } from '@/lib/supabaseClient'

const upsertUser = (id, email) =>
  db.query(
    `INSERT INTO public.users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [id, email]
  )

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}
  const { email, password } = body
  if (!email || !password) return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
  try {
    const { data, error } = await signIn(email, password)
    if (error) return NextResponse.json({ error: error.message }, { status: 401 })
    await upsertUser(data.user.id, data.user.email)
    return NextResponse.json({ user: data.user, access_token: data.session.access_token })
  } catch {
    return NextResponse.json({ error: 'Failed to log in user' }, { status: 500 })
  }
}

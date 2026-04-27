import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  const { access_token, refresh_token = '', password } = body

  if (!access_token || !password) {
    return NextResponse.json({ error: 'access_token and password are required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
    if (sessionError) {
      return NextResponse.json(
        { error: 'Reset link is invalid or has already been used. Please request a new one.' },
        { status: 401 },
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}

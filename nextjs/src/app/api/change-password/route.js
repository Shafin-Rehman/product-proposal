import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  const { access_token, current_password, new_password } = body

  if (!access_token || !current_password || !new_password) {
    return NextResponse.json(
      { error: 'access_token, current_password, and new_password are required' },
      { status: 400 },
    )
  }

  if (new_password.length < 6) {
    return NextResponse.json(
      { error: 'New password must be at least 6 characters' },
      { status: 400 },
    )
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(access_token)
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Your session has expired. Please log in again.' },
        { status: 401 },
      )
    }

    const verifyClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: current_password,
    })

    if (verifyError) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }

    const { error: updateError } = await verifyClient.auth.updateUser({ password: new_password })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Password changed successfully' })
  } catch {
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}

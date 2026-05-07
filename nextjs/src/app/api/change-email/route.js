import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  const { access_token, new_email } = body

  if (!access_token) {
    return NextResponse.json({ error: 'access_token is required' }, { status: 400 })
  }

  if (!new_email || typeof new_email !== 'string' || !new_email.trim()) {
    return NextResponse.json({ error: 'new_email is required' }, { status: 400 })
  }

  const emailTrimmed = new_email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  try {
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser(access_token)
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Your session has expired. Please log in again.' },
        { status: 401 },
      )
    }

    if (emailTrimmed === user.email) {
      return NextResponse.json(
        { error: 'The new email address must be different from your current one.' },
        { status: 400 },
      )
    }

    const adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      email: emailTrimmed,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await adminClient.from('users').update({ email: emailTrimmed }).eq('id', user.id)

    return NextResponse.json({ email: emailTrimmed })
  } catch {
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 })
  }
}

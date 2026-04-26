import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getOrigin(request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (host) {
    const proto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim()
      || new URL(request.url).protocol.replace(':', '')
    return `${proto}://${host}`
  }
  return new URL(request.url).origin
}

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  const email = body.email?.trim()
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  try {
    const origin = getOrigin(request)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { flowType: 'implicit', autoRefreshToken: false, persistSession: false } },
    )
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ message: 'Password reset email sent' })
  } catch {
    return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 })
  }
}
 

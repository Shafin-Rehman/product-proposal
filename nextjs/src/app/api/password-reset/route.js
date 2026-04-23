import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabaseClient'
 
export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}
 
  const { email } = body
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
 
  try {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ message: 'Password reset email sent' })
  } catch {
    return NextResponse.json({ error: 'Failed to send password reset email' }, { status: 500 })
  }
}
 

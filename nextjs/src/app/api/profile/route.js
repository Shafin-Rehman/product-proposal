import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function resolveUser(request) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return { user: null, error: 'Unauthorized' }

  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) return { user: null, error: 'Your session has expired. Please log in again.' }
  return { user, error: null }
}

export async function GET(request) {
  try {
    const { user, error } = await resolveUser(request)
    if (error) return NextResponse.json({ error }, { status: 401 })

    const supabase = getSupabase()
    const { data, error: dbError } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ name: data?.name ?? null, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(request) {
  let body = {}
  try { body = await request.json() } catch {}

  const { name } = body

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const trimmed = name.trim()
  if (trimmed.length > 60) {
    return NextResponse.json({ error: 'Name must be 60 characters or fewer' }, { status: 400 })
  }

  try {
    const { user, error } = await resolveUser(request)
    if (error) return NextResponse.json({ error }, { status: 401 })

    const supabase = getSupabase()
    const { error: dbError } = await supabase
      .from('users')
      .update({ name: trimmed })
      .eq('id', user.id)

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

    return NextResponse.json({ name: trimmed })
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

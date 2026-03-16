import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { income_id } = body
  if (!income_id) return NextResponse.json({ error: 'income_id required' }, { status: 400 })
  try {
    const { rows } = await db.query(
      `DELETE FROM public.income WHERE id = $1 AND user_id = $2 RETURNING id`,
      [income_id, user.id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Income not found' }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete income' }, { status: 500 })
  }
}

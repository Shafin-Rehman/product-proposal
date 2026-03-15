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
      `SELECT i.*, s.name AS source_name, s.icon AS source_icon
       FROM public.income i
       LEFT JOIN public.income_sources s ON i.source_id = s.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [income_id, user.id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Income not found' }, { status: 404 })
    const { user_id, ...income } = rows[0]
    return NextResponse.json(income)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch income' }, { status: 500 })
  }
}

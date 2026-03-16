import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { normalizeMonth } from '@/lib/budget'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  try {
    const { rows } = await db.query(
      `SELECT i.*, s.name AS source_name, s.icon AS source_icon
       FROM public.income i
       LEFT JOIN public.income_sources s ON i.source_id = s.id
       WHERE i.user_id = $1
       ORDER BY i.month DESC, i.created_at DESC`,
      [user.id]
    )
    return NextResponse.json(rows.map(({ user_id, ...i }) => i))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch income' }, { status: 500 })
  }
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { source_id, amount, month, notes } = body
  if (!amount || !month) return NextResponse.json({ error: 'amount and month are required' }, { status: 400 })
  const normalizedMonth = normalizeMonth(month)
  if (!normalizedMonth) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })
  try {
    const { rows } = await db.query(
      `INSERT INTO public.income (user_id, source_id, amount, month, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.id, source_id ?? null, amount, normalizedMonth, notes ?? null]
    )
    const { user_id, ...income } = rows[0]
    return NextResponse.json(income, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create income' }, { status: 500 })
  }
}

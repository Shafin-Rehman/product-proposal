import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import db from '@/lib/db'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body
  try { body = await request.json() } catch { body = {} }

  const { rule_id } = body
  if (!rule_id) {
    return NextResponse.json({ error: 'rule_id is required' }, { status: 400 })
  }

  const { rows } = await db.query(
    `UPDATE public.recurring_rules
     SET cancelled_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND id = $2 AND cancelled_at IS NULL
     RETURNING *`,
    [user.id, rule_id]
  )

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { user_id: _uid, ...rule } = rows[0]
  return NextResponse.json(rule)
}

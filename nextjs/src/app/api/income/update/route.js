import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { normalizeMonth } from '@/lib/budget'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { income_id, source_id, amount, month, notes } = body
  if (!income_id) return NextResponse.json({ error: 'income_id required' }, { status: 400 })

  const normalizedMonth = month === undefined ? undefined : normalizeMonth(month)
  if (month !== undefined && !normalizedMonth) {
    return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })
  }

  const entries = Object.entries({
    source_id,
    amount,
    month: normalizedMonth,
    notes
  }).filter(([, v]) => v !== undefined)
  if (!entries.length) return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 })

  const fields = entries.map(([k], i) => `${k} = $${i + 1}`)
  const values = [...entries.map(([, v]) => v), income_id, user.id]
  const n = entries.length

  try {
    const { rows } = await db.query(
      `UPDATE public.income SET ${fields.join(', ')} WHERE id = $${n + 1} AND user_id = $${n + 2} RETURNING *`,
      values
    )
    if (!rows.length) return NextResponse.json({ error: 'Income not found' }, { status: 404 })
    const { user_id, ...income } = rows[0]
    return NextResponse.json(income)
  } catch {
    return NextResponse.json({ error: 'Failed to update income' }, { status: 500 })
  }
}

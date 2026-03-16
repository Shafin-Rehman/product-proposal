import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { evaluateThresholdForMonth } from '@/lib/budget'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { expense_id } = body
  if (!expense_id) return NextResponse.json({ error: 'expense_id required' }, { status: 400 })
  try {
    const existingResult = await db.query(
      `SELECT date
       FROM public.expenses
       WHERE id = $1 AND user_id = $2`,
      [expense_id, user.id]
    )
    if (!existingResult.rows.length) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    const { rows } = await db.query(
      `DELETE FROM public.expenses WHERE id = $1 AND user_id = $2 RETURNING id`,
      [expense_id, user.id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    await evaluateThresholdForMonth(user.id, existingResult.rows[0].date)
    return new Response(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}

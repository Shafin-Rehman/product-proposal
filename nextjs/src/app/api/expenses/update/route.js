import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { evaluateThresholdForMonth } from '@/lib/budget'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { expense_id, category_id, amount, description, date } = body
  if (!expense_id) return NextResponse.json({ error: 'expense_id required' }, { status: 400 })

  const entries = Object.entries({ category_id, amount, description, date }).filter(([, v]) => v !== undefined)
  if (!entries.length) return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 })

  const fields = entries.map(([k], i) => `${k} = $${i + 1}`)
  const values = [...entries.map(([, v]) => v), expense_id, user.id]
  const n = entries.length

  try {
    const existingResult = await db.query(
      `SELECT date
       FROM public.expenses
       WHERE id = $1 AND user_id = $2`,
      [expense_id, user.id]
    )
    if (!existingResult.rows.length) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    const previousDate = existingResult.rows[0].date
    const { rows } = await db.query(
      `UPDATE public.expenses SET ${fields.join(', ')} WHERE id = $${n + 1} AND user_id = $${n + 2} RETURNING *`,
      values
    )
    if (!rows.length) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    const { user_id, ...expense } = rows[0]
    const monthsToCheck = [...new Set([previousDate, expense.date])]
    const thresholdResults = await Promise.all(monthsToCheck.map(month => evaluateThresholdForMonth(user.id, month)))
    const triggeredAlert = thresholdResults.find(result => result?.alertTriggered)
    return NextResponse.json({ ...expense, budget_alert: triggeredAlert?.budget_alert ?? null })
  } catch {
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

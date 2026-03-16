import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { expense_id } = body
  if (!expense_id) return NextResponse.json({ error: 'expense_id required' }, { status: 400 })
  try {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name
       FROM public.expenses e
       LEFT JOIN public.categories c ON e.category_id = c.id
       WHERE e.id = $1 AND e.user_id = $2`,
      [expense_id, user.id]
    )
    if (!rows.length) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    const { user_id, ...expense } = rows[0]
    return NextResponse.json(expense)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
  }
}

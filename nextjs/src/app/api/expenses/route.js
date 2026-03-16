import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { evaluateThresholdForMonth } from '@/lib/budget'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  try {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name
       FROM public.expenses e
       LEFT JOIN public.categories c ON e.category_id = c.id
       WHERE e.user_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [user.id]
    )
    return NextResponse.json(rows.map(({ user_id, ...e }) => e))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  let body = {}
  try { body = await request.json() } catch {}
  const { category_id, amount, description, date } = body
  if (!amount || !date) return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
  try {
    const { rows } = await db.query(
      `INSERT INTO public.expenses (user_id, category_id, amount, description, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.id, category_id ?? null, amount, description ?? null, date]
    )
    const { user_id, ...expense } = rows[0]
    const threshold = await evaluateThresholdForMonth(user.id, expense.date)
    return NextResponse.json({ ...expense, budget_alert: threshold?.budget_alert ?? null }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}

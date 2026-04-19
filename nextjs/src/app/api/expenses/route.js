import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { evaluateThresholdForMonth, isPositiveMoneyValue, normalizeDate } from '@/lib/budget'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  try {
    const { rows } = await db.query(
      `SELECT e.*, c.name AS category_name, c.icon AS category_icon
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
  const moneyValidationMessage = 'amount must be a valid positive money amount'
  if (amount == null || date == null) {
    return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
  }
  if (!isPositiveMoneyValue(amount)) {
    return NextResponse.json({ error: moneyValidationMessage }, { status: 400 })
  }
  const normalizedDate = normalizeDate(date)
  if (!normalizedDate) {
    return NextResponse.json({ error: 'Valid date is required' }, { status: 400 })
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO public.expenses (user_id, category_id, amount, description, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.id, category_id ?? null, amount, description ?? null, normalizedDate]
    )
    const { user_id, ...expense } = rows[0]
    const threshold = await evaluateThresholdForMonth(user.id, expense.date)
    const budget_alert = threshold?.threshold_exceeded
      ? { month: threshold.month, monthly_limit: threshold.monthly_limit, total_expenses: threshold.total_expenses, threshold_exceeded: true }
      : null
    return NextResponse.json({ ...expense, budget_alert }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}

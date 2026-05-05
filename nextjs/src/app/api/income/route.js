import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { isPositiveMoneyValue, normalizeDate } from '@/lib/budget'
import { buildTransactionListQuery } from '@/lib/transactionQuery'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error
  const query = buildTransactionListQuery(new URL(request.url).searchParams, {
    dateColumn: 'i.date',
    firstParameterIndex: 2,
  })
  if (query.error) return NextResponse.json({ error: query.error }, { status: 400 })

  try {
    const whereClause = ['i.user_id = $1', ...query.clauses].join(' AND ')
    const { rows } = await db.query(
      `SELECT i.*, s.name AS source_name, s.icon AS source_icon
       FROM public.income i
       LEFT JOIN public.income_sources s ON i.source_id = s.id
       WHERE ${whereClause}
       ORDER BY i.date DESC, i.created_at DESC
       ${query.limitClause}`,
      [user.id, ...query.values]
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
  const { source_id, amount, date, notes } = body
  const moneyValidationMessage = 'amount must be a valid positive money amount'
  if (amount == null || date == null) return NextResponse.json({ error: 'amount and date are required' }, { status: 400 })
  if (!isPositiveMoneyValue(amount)) {
    return NextResponse.json({ error: moneyValidationMessage }, { status: 400 })
  }
  const normalizedDate = normalizeDate(date)
  if (!normalizedDate) return NextResponse.json({ error: 'Valid date is required' }, { status: 400 })
  try {
    const { rows } = await db.query(
      `INSERT INTO public.income (user_id, source_id, amount, date, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.id, source_id ?? null, amount, normalizedDate, notes ?? null]
    )
    const { user_id, ...income } = rows[0]
    return NextResponse.json(income, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create income' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import db from '@/lib/db'
import { addPeriod } from '@/lib/recurringDates'
import { processUserRecurring } from '@/lib/recurringProcessor'

const VALID_TYPES = ['expense', 'income']
const VALID_FREQUENCIES = ['weekly', 'monthly', 'yearly']

function validateDate(value) {
  if (!value || typeof value !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

function formatRule(row) {
  const { user_id: _uid, ...rest } = row
  const dateStr = (v) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : v
  return { ...rest, start_date: dateStr(rest.start_date), next_date: dateStr(rest.next_date) }
}

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const { rows } = await db.query(
    `SELECT r.*, c.name AS category_name, s.name AS source_name
     FROM public.recurring_rules r
     LEFT JOIN public.categories c ON r.category_id = c.id
     LEFT JOIN public.income_sources s ON r.source_id = s.id
     WHERE r.user_id = $1 AND r.cancelled_at IS NULL
     ORDER BY r.created_at DESC`,
    [user.id]
  )
  return NextResponse.json(rows.map(formatRule))
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body
  try { body = await request.json() } catch { body = {} }

  const { type, amount, frequency, start_date, description, category_id, source_id, expense_id, income_id } = body

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'type must be "expense" or "income"' }, { status: 400 })
  }
  const parsedAmount = Number(amount)
  if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
    return NextResponse.json({ error: 'frequency must be weekly, monthly, or yearly' }, { status: 400 })
  }
  if (!validateDate(start_date)) {
    return NextResponse.json({ error: 'start_date must be a valid YYYY-MM-DD date' }, { status: 400 })
  }

  const next_date = addPeriod(start_date, frequency)
  const insertValues = [
    user.id, type, parsedAmount.toFixed(2), category_id ?? null, source_id ?? null,
    description ?? null, frequency, start_date, next_date,
  ]

  if (expense_id || income_id) {
    let client
    try {
      client = await db.connect()
      await client.query('BEGIN')
      const { rows } = await client.query(
        `INSERT INTO public.recurring_rules
           (user_id, type, amount, category_id, source_id, description, frequency, start_date, next_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        insertValues
      )
      const rule = rows[0]

      if (expense_id) {
        const upd = await client.query(
          `UPDATE public.expenses SET recurring_rule_id = $1 WHERE id = $2 AND user_id = $3`,
          [rule.id, expense_id, user.id]
        )
        if (!upd.rowCount) {
          await client.query('ROLLBACK')
          return NextResponse.json(
            { error: 'Expense not found or could not be linked' },
            { status: 400 }
          )
        }
      } else {
        const upd = await client.query(
          `UPDATE public.income SET recurring_rule_id = $1 WHERE id = $2 AND user_id = $3`,
          [rule.id, income_id, user.id]
        )
        if (!upd.rowCount) {
          await client.query('ROLLBACK')
          return NextResponse.json(
            { error: 'Income not found or could not be linked' },
            { status: 400 }
          )
        }
      }

      await client.query('COMMIT')
      await processUserRecurring(user.id)
      return NextResponse.json(formatRule(rule), { status: 201 })
    } catch (err) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // ignore
        }
      }
      throw err
    } finally {
      if (client) client.release()
    }
  }

  const { rows } = await db.query(
    `INSERT INTO public.recurring_rules
       (user_id, type, amount, category_id, source_id, description, frequency, start_date, next_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    insertValues
  )
  const rule = rows[0]

  await processUserRecurring(user.id)

  return NextResponse.json(formatRule(rule), { status: 201 })
}

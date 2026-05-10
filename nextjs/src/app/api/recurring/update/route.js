import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import db from '@/lib/db'
import { addPeriod } from '@/lib/recurringDates'

const VALID_FREQUENCIES = ['weekly', 'monthly', 'yearly']

function formatRule(row) {
  const { user_id: _uid, ...rest } = row
  return rest
}

function toDateStr(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}

function advanceToFutureCycle(nextDate, frequency, today) {
  let current = toDateStr(nextDate)
  if (!current) return current
  while (current < today) current = addPeriod(current, frequency)
  return current
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body
  try { body = await request.json() } catch { body = {} }

  const { rule_id, amount, frequency, description, next_date, paused } = body

  if (!rule_id) {
    return NextResponse.json({ error: 'rule_id is required' }, { status: 400 })
  }
  if (amount !== undefined) {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
  }
  if (frequency !== undefined && !VALID_FREQUENCIES.includes(frequency)) {
    return NextResponse.json({ error: 'frequency must be weekly, monthly, or yearly' }, { status: 400 })
  }

  let resolvedNextDate = next_date
  if (paused !== undefined && Boolean(paused) === false && next_date === undefined) {
    const { rows: currentRows } = await db.query(
      `SELECT paused, next_date, frequency
       FROM public.recurring_rules
       WHERE user_id = $1 AND id = $2 AND cancelled_at IS NULL
       LIMIT 1`,
      [user.id, rule_id]
    )
    if (!currentRows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const currentRule = currentRows[0]
    if (Boolean(currentRule.paused)) {
      const today = new Date().toISOString().slice(0, 10)
      const advancedNextDate = advanceToFutureCycle(currentRule.next_date, currentRule.frequency, today)
      const prior = toDateStr(currentRule.next_date)
      if (
        advancedNextDate &&
        prior &&
        advancedNextDate !== prior
      ) {
        resolvedNextDate = advancedNextDate
      }
    }
  }

  const sets = []
  const values = [user.id, rule_id]
  let idx = 3

  if (amount !== undefined) { sets.push(`amount = $${idx++}`); values.push(Number(amount).toFixed(2)) }
  if (frequency !== undefined) { sets.push(`frequency = $${idx++}`); values.push(frequency) }
  if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description) }
  if (resolvedNextDate !== undefined && resolvedNextDate !== null) {
    sets.push(`next_date = $${idx++}`)
    values.push(resolvedNextDate)
  }
  if (paused !== undefined) { sets.push(`paused = $${idx++}`); values.push(Boolean(paused)) }
  sets.push(`updated_at = NOW()`)

  const { rows } = await db.query(
    `UPDATE public.recurring_rules SET ${sets.join(', ')}
     WHERE user_id = $1 AND id = $2
     RETURNING *`,
    values
  )

  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(formatRule(rows[0]))
}

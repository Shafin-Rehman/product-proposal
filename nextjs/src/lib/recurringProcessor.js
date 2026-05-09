import db from '@/lib/db'
import { getMissedOccurrences, addPeriod } from '@/lib/recurringDates'

function toDateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

export async function processUserRecurring(userId, asOf = new Date().toISOString().slice(0, 10)) {
  const { rows: rules } = await db.query(
    `SELECT * FROM public.recurring_rules
     WHERE user_id = $1 AND paused = FALSE AND cancelled_at IS NULL AND next_date <= $2`,
    [userId, asOf]
  )

  let generated = 0

  for (const rule of rules) {
    const dates = getMissedOccurrences(toDateStr(rule.next_date), rule.frequency, asOf)
    if (dates.length === 0) continue

    for (const date of dates) {
      if (rule.type === 'expense') {
        await db.query(
          `INSERT INTO public.expenses (user_id, category_id, amount, description, date, recurring_rule_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [rule.user_id, rule.category_id, rule.amount, rule.description, date, rule.id]
        )
      } else {
        await db.query(
          `INSERT INTO public.income (user_id, source_id, amount, notes, date, recurring_rule_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [rule.user_id, rule.source_id, rule.amount, rule.description ?? null, date, rule.id]
        )
      }
      generated++
    }

    const newNextDate = addPeriod(dates[dates.length - 1], rule.frequency)
    await db.query(
      `UPDATE public.recurring_rules SET next_date = $1, updated_at = NOW() WHERE id = $2`,
      [newNextDate, rule.id]
    )
  }

  return generated
}

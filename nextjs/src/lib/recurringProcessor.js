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

    let client
    try {
      client = await db.connect()
      await client.query('BEGIN')
      let insertsThisRule = 0
      for (const date of dates) {
        if (rule.type === 'expense') {
          const ins = await client.query(
            `INSERT INTO public.expenses (user_id, category_id, amount, description, date, recurring_rule_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, recurring_rule_id, date) WHERE recurring_rule_id IS NOT NULL DO NOTHING`,
            [rule.user_id, rule.category_id, rule.amount, rule.description, date, rule.id]
          )
          insertsThisRule += ins.rowCount ?? 0
        } else {
          const ins = await client.query(
            `INSERT INTO public.income (user_id, source_id, amount, notes, date, recurring_rule_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, recurring_rule_id, date) WHERE recurring_rule_id IS NOT NULL DO NOTHING`,
            [rule.user_id, rule.source_id, rule.amount, rule.description ?? null, date, rule.id]
          )
          insertsThisRule += ins.rowCount ?? 0
        }
      }

      const newNextDate = addPeriod(dates[dates.length - 1], rule.frequency)
      await client.query(
        `UPDATE public.recurring_rules SET next_date = $1, updated_at = NOW() WHERE id = $2`,
        [newNextDate, rule.id]
      )
      await client.query('COMMIT')
      generated += insertsThisRule
    } catch (err) {
      if (client) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // ignore rollback failures
        }
      }
      throw err
    } finally {
      if (client) client.release()
    }
  }

  return generated
}

import db from '@/lib/db'
import { getMissedOccurrences, addPeriod } from '@/lib/recurringDates'

function toDateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

async function recurringExpenseExists(client, userId, ruleId, date) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM public.expenses
     WHERE user_id = $1 AND recurring_rule_id = $2 AND date = $3
     LIMIT 1`,
    [userId, ruleId, date]
  )
  return rowCount > 0
}

async function recurringIncomeExists(client, userId, ruleId, date) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM public.income
     WHERE user_id = $1 AND recurring_rule_id = $2 AND date = $3
     LIMIT 1`,
    [userId, ruleId, date]
  )
  return rowCount > 0
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

    const client = await db.connect()
    try {
      await client.query('BEGIN')
      let insertsThisRule = 0
      for (const date of dates) {
        if (rule.type === 'expense') {
          if (await recurringExpenseExists(client, rule.user_id, rule.id, date)) continue
          await client.query(
            `INSERT INTO public.expenses (user_id, category_id, amount, description, date, recurring_rule_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [rule.user_id, rule.category_id, rule.amount, rule.description, date, rule.id]
          )
        } else {
          if (await recurringIncomeExists(client, rule.user_id, rule.id, date)) continue
          await client.query(
            `INSERT INTO public.income (user_id, source_id, amount, notes, date, recurring_rule_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [rule.user_id, rule.source_id, rule.amount, rule.description ?? null, date, rule.id]
          )
        }
        insertsThisRule++
      }

      const newNextDate = addPeriod(dates[dates.length - 1], rule.frequency)
      await client.query(
        `UPDATE public.recurring_rules SET next_date = $1, updated_at = NOW() WHERE id = $2`,
        [newNextDate, rule.id]
      )
      await client.query('COMMIT')
      generated += insertsThisRule
    } catch (err) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore rollback failures
      }
      throw err
    } finally {
      client.release()
    }
  }

  return generated
}

import { normalizeDate, normalizeMonth } from './budget'

const MAX_TRANSACTION_LIST_LIMIT = 500

function shiftMonth(month, offset = 1) {
  const date = new Date(`${month}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  date.setUTCMonth(date.getUTCMonth() + offset)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function parseLimit(value) {
  if (value == null || value === '') return null
  if (!/^\d+$/.test(String(value))) return undefined

  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit <= 0) return undefined
  return Math.min(limit, MAX_TRANSACTION_LIST_LIMIT)
}

export function buildTransactionListQuery(searchParams, { dateColumn, firstParameterIndex = 1 } = {}) {
  const monthValue = searchParams.get('month')
  const fromValue = searchParams.get('from')
  const toValue = searchParams.get('to')
  const limitValue = searchParams.get('limit')

  if (monthValue && (fromValue || toValue)) {
    return { error: 'Use either month or from/to, not both' }
  }

  const clauses = []
  const values = []
  let nextIndex = firstParameterIndex

  if (monthValue) {
    const month = normalizeMonth(monthValue)
    const endMonth = month ? shiftMonth(month, 1) : null
    if (!month || !endMonth) return { error: 'Valid month is required' }

    clauses.push(`${dateColumn} >= $${nextIndex}`)
    values.push(month)
    nextIndex += 1
    clauses.push(`${dateColumn} < $${nextIndex}`)
    values.push(endMonth)
    nextIndex += 1
  } else {
    if (fromValue) {
      const from = normalizeDate(fromValue)
      if (!from) return { error: 'Valid from date is required' }
      clauses.push(`${dateColumn} >= $${nextIndex}`)
      values.push(from)
      nextIndex += 1
    }

    if (toValue) {
      const to = normalizeDate(toValue)
      if (!to) return { error: 'Valid to date is required' }
      if (values.length && fromValue && values[0] > to) {
        return { error: 'from date must be on or before to date' }
      }
      clauses.push(`${dateColumn} <= $${nextIndex}`)
      values.push(to)
      nextIndex += 1
    }
  }

  const limit = parseLimit(limitValue)
  if (limit === undefined) return { error: 'Valid limit is required' }

  return {
    clauses,
    values,
    limitClause: limit == null ? '' : `LIMIT ${limit}`,
  }
}

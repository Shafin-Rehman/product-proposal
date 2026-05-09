function toUTCDate(dateStr) {
  const s = String(dateStr).slice(0, 10)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toDateStr(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addPeriod(dateStr, frequency) {
  const d = toUTCDate(dateStr)
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else if (frequency === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1)
  return toDateStr(d)
}

export function getMissedOccurrences(nextDate, frequency, asOf) {
  const asOfMs = toUTCDate(asOf).getTime()
  const result = []
  let current = toUTCDate(nextDate)
  while (current.getTime() <= asOfMs) {
    result.push(toDateStr(current))
    current = toUTCDate(addPeriod(toDateStr(current), frequency))
  }
  return result
}

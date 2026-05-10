export function normalizeCalendarYmd(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value)
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  return s.slice(0, 10)
}

export function localCalendarYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toUTCDate(dateStr) {
  const s = normalizeCalendarYmd(dateStr)
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toDateStr(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function maxIsoDate(a, b) {
  return a >= b ? a : b
}

export function addUtcCalendarDays(dateStr, deltaDays) {
  const d = toUTCDate(dateStr)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return toDateStr(d)
}

export function addPeriod(dateStr, frequency) {
  const d = toUTCDate(dateStr)
  const f = String(frequency ?? '').toLowerCase()
  if (f === 'weekly') d.setUTCDate(d.getUTCDate() + 7)
  else if (f === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1)
  else if (f === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1)
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

export function parseIsoYmdOrNull(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  if (
    Number.isNaN(utc.getTime())
    || utc.getUTCFullYear() !== y
    || utc.getUTCMonth() !== m - 1
    || utc.getUTCDate() !== d
  ) {
    return null
  }
  return s
}

export function effectiveBillingDayFromClient(utcToday, rawClientYmd) {
  const p = parseIsoYmdOrNull(rawClientYmd)
  const cap = addUtcCalendarDays(utcToday, 1)
  const trustworthy = p && p <= cap ? p : null
  return trustworthy ? maxIsoDate(utcToday, trustworthy) : utcToday
}

export function advanceNextDateOnResume(nextDate, frequency, resumeDay) {
  let current = normalizeCalendarYmd(nextDate)
  const resume = normalizeCalendarYmd(resumeDay)
  if (!current || !resume) return current
  while (current <= resume) {
    current = addPeriod(current, frequency)
  }
  return current
}

import { getCategoryLabel } from './financeVisuals'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

export function getCurrentMonthStart(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function getMonthStartValue(value) {
  const date = parseCalendarDate(value)
  if (!date) return null

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    '01',
  ].join('-')
}

export function parseCalendarDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string') return null

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  }

  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

export function toDayKey(value) {
  const date = parseCalendarDate(value)
  if (!date) return 'unknown'

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function isInMonth(value, month) {
  const date = parseCalendarDate(value)
  const currentMonth = parseCalendarDate(month)
  if (!date || !currentMonth) return false

  return (
    date.getUTCFullYear() === currentMonth.getUTCFullYear() &&
    date.getUTCMonth() === currentMonth.getUTCMonth()
  )
}

export function shiftMonth(value, offset = 0) {
  const date = parseCalendarDate(value)
  if (!date) return null

  const nextDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12))
  nextDate.setUTCMonth(nextDate.getUTCMonth() + Number(offset || 0))
  return getMonthStartValue(nextDate)
}

export function formatCurrency(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : '--'
}

export function formatMonthLabel(value) {
  const date = parseCalendarDate(value)
  if (!date) return 'This month'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatShortDate(value) {
  const date = parseCalendarDate(value)
  if (!date) return 'Date unavailable'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatLongDate(value) {
  const date = parseCalendarDate(value)
  if (!date) return 'Date unavailable'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDayGroupLabel(value, relativeTo = new Date()) {
  const date = parseCalendarDate(value)
  if (!date) return 'Date unavailable'

  const todayKey = toDayKey(relativeTo)
  const yesterday = new Date(relativeTo)
  yesterday.setDate(relativeTo.getDate() - 1)
  const yesterdayKey = toDayKey(yesterday)
  const key = toDayKey(date)

  if (key === todayKey) return 'Today'
  if (key === yesterdayKey) return 'Yesterday'
  return formatLongDate(value)
}

export function formatMonthPeriod(value) {
  const date = parseCalendarDate(value)
  if (!date) return 'Month unavailable'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatSyncLabel(value) {
  if (!value) return 'Waiting for live data'

  return `Updated ${value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

export function formatPercentage(value) {
  return `${Math.round(Number(value) || 0)}%`
}

export function buildMonthlySpendTrend(expenses = [], month) {
  const monthDate = parseCalendarDate(month)
  if (!monthDate) return []

  const year = monthDate.getUTCFullYear()
  const monthIndex = monthDate.getUTCMonth()
  const monthLength = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const today = new Date()
  const isCurrentMonth = (
    year === today.getUTCFullYear() &&
    monthIndex === today.getUTCMonth()
  )
  const visibleDays = isCurrentMonth ? Math.min(today.getUTCDate(), monthLength) : monthLength
  const totalsByDay = Array.from({ length: visibleDays }, () => 0)

  expenses
    .filter((expense) => isInMonth(expense.date || expense.created_at, month))
    .forEach((expense) => {
      const entryDate = parseCalendarDate(expense.date || expense.created_at)
      if (!entryDate) return

      const dayIndex = entryDate.getUTCDate() - 1
      if (dayIndex < 0 || dayIndex >= totalsByDay.length) return
      totalsByDay[dayIndex] += Number(expense.amount ?? 0)
    })

  let runningTotal = 0
  const cumulative = totalsByDay.map((amount) => {
    runningTotal += amount
    return Number(runningTotal.toFixed(2))
  })

  if (cumulative.some((point) => point > 0)) {
    return cumulative
  }
  return []
}

export function buildActivityFeed(expenses = [], income = []) {
  const getCreatedSortValue = (value) => {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? 0 : value.getTime()
    }
    if (typeof value === 'string') {
      const timestamp = Date.parse(value)
      if (!Number.isNaN(timestamp)) return timestamp
    }
    return 0
  }

  const expenseEntries = expenses.map((expense) => {
    const categoryName = expense?.category_name || 'Expense'
    const description = expense?.description?.trim()
    const displayCategory = getCategoryLabel([categoryName, description].filter(Boolean).join(' '), 'expense')

    return {
      id: `expense-${expense.id}`,
      kind: 'expense',
      title: description || displayCategory,
      chip: displayCategory,
      amount: Number(expense.amount ?? 0),
      occurredOn: expense.date || expense.created_at,
      sortOn: parseCalendarDate(expense.date || expense.created_at)?.getTime() ?? 0,
      note: description ? displayCategory : 'Live expense',
      merchant: description || displayCategory,
      raw: expense,
    }
  })

  const incomeEntries = income.map((entry) => {
    const sourceName = entry?.source_name || 'Income'
    const notes = entry?.notes?.trim()
    const displayCategory = getCategoryLabel(sourceName, 'income')

    return {
      id: `income-${entry.id}`,
      kind: 'income',
      title: sourceName,
      chip: displayCategory,
      amount: Number(entry.amount ?? 0),
      occurredOn: entry.date || entry.created_at,
      sortOn: parseCalendarDate(entry.date || entry.created_at)?.getTime() ?? 0,
      note: notes || '',
      merchant: sourceName,
      raw: entry,
    }
  })

  return [...expenseEntries, ...incomeEntries].sort((left, right) => (
    (right.sortOn - left.sortOn) ||
    (getCreatedSortValue(right.raw?.created_at) - getCreatedSortValue(left.raw?.created_at))
  ))
}

export function groupActivityByDate(entries = []) {
  const groups = new Map()

  entries.forEach((entry) => {
    const key = toDayKey(entry.occurredOn)
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatDayGroupLabel(entry.occurredOn),
        entries: [],
      })
    }

    groups.get(key).entries.push(entry)
  })

  return Array.from(groups.values()).sort((left, right) => right.key.localeCompare(left.key))
}

export function buildIncomeSourceBreakdown(incomeEntries = [], month) {
  const grouped = new Map()

  incomeEntries
    .filter((entry) => isInMonth(entry.date || entry.created_at, month))
    .forEach((entry) => {
      const label = entry?.source_name || 'Income'
      grouped.set(label, (grouped.get(label) || 0) + Number(entry.amount ?? 0))
    })

  return Array.from(grouped.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount)
}

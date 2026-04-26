import { getCategoryLabel, getCategoryPresentation } from './financeVisuals'

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

/**
 * Category/source name to match against API lists when opening the transaction edit form.
 * Uses raw persisted row fields, not presentation-only chip values (e.g. keeps category_id resolution stable).
 */
export function getEditFormCategoryName(entry) {
  if (entry == null) return ''
  if (entry.kind === 'expense') {
    const n = entry.raw?.category_name
    if (n != null && String(n).trim() !== '') return String(n).trim()
    return ''
  }
  const s = entry.raw?.source_name
  if (s != null && String(s).trim() !== '') return String(s).trim()
  return ''
}

/**
 * Maps the transaction form’s selected category or source *name* (from the API list) to
 * `category_id` / `source_id` fields for create vs update.
 * - Create: omit the key when unselected (POST routes use null from missing body as needed).
 * - Update: send explicit `null` when the user selects the empty placeholder to clear a prior id.
 * Matching uses exact `name` on `options` (not display chip strings).
 * @param {{ isEdit: boolean, selectedName: string, options: { id: unknown, name: string }[], kind: 'expense' | 'income' }} p
 * @returns {Record<string, never> | { category_id: unknown } | { category_id: null } | { source_id: unknown } | { source_id: null }}
 */
export function resolveCategoryOrSourceMutation({ isEdit, selectedName, options = [], kind }) {
  const name = selectedName == null ? '' : String(selectedName)
  const id = options.find((o) => o.name === name)?.id
  if (kind === 'expense') {
    if (isEdit) {
      if (id !== undefined && id !== null) return { category_id: id }
      if (!name.trim()) return { category_id: null }
      return {}
    }
    if (id !== undefined && id !== null) return { category_id: id }
    return {}
  }
  if (kind === 'income') {
    if (isEdit) {
      if (id !== undefined && id !== null) return { source_id: id }
      if (!name.trim()) return { source_id: null }
      return {}
    }
    if (id !== undefined && id !== null) return { source_id: id }
    return {}
  }
  return {}
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
    const description = expense?.description?.trim()
    const displayCategory = getCategoryLabel(expense?.category_name ?? '', 'expense')

    return {
      id: `expense-${expense.id}`,
      kind: 'expense',
      title: description || displayCategory,
      chip: displayCategory,
      categoryIcon: expense.category_icon ?? null,
      amount: Number(expense.amount ?? 0),
      occurredOn: expense.date || expense.created_at,
      sortOn: parseCalendarDate(expense.date || expense.created_at)?.getTime() ?? 0,
      note: description ? displayCategory : 'Live expense',
      merchant: description || displayCategory,
      raw: expense,
    }
  })

  const incomeEntries = income.map((entry) => {
    const sourceName = entry?.source_name ?? ''
    const notes = entry?.notes?.trim()
    const displayCategory = getCategoryLabel(sourceName, 'income')

    return {
      id: `income-${entry.id}`,
      kind: 'income',
      title: notes || sourceName || displayCategory,
      chip: displayCategory,
      sourceIcon: entry.source_icon ?? null,
      amount: Number(entry.amount ?? 0),
      occurredOn: entry.date || entry.created_at,
      sortOn: parseCalendarDate(entry.date || entry.created_at)?.getTime() ?? 0,
      note: notes || '',
      merchant: sourceName || displayCategory,
      raw: entry,
    }
  })

  return [...expenseEntries, ...incomeEntries].sort((left, right) => (
    (right.sortOn - left.sortOn) ||
    (getCreatedSortValue(right.raw?.created_at) - getCreatedSortValue(left.raw?.created_at))
  ))
}

function toAmountDetail(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
}

function buildDailyExpenseDetailId(row, dayKey, fallbackOrdinalByKey) {
  if (row.id != null && row.id !== '') {
    return String(row.id)
  }
  const amount = toAmountDetail(row.amount)
  const title = String(row.title ?? row.description ?? '').trim()
  const category = String(row.category_name ?? '').trim()
  const dedupeKey = `${dayKey}\t${amount}\t${title}\t${category}`
  const ordinal = (fallbackOrdinalByKey.get(dedupeKey) ?? 0) + 1
  fallbackOrdinalByKey.set(dedupeKey, ordinal)
  const ordinalSuffix = ordinal > 1 ? `:${ordinal}` : ''
  return `daily-expense-fallback:${dayKey}:${amount}:${title}:${category}${ordinalSuffix}`
}

/** Maps API expense rows to the detail entries consumed by CategoryTransactionsModal (client-only; avoids importing server insights bundle). */
export function buildDailySpendDetailsFromExpenses(rows = []) {
  const grouped = new Map()
  const fallbackOrdinalByKey = new Map()

  rows.forEach((row) => {
    const dateValue = row.date || row.created_at || row.occurred_on
    const key = toDayKey(dateValue)
    if (!key || key === 'unknown') return

    const description = row.description != null ? String(row.description).trim() : ''
    const presentation = getCategoryPresentation({
      name: row.category_name,
      icon: row.category_icon,
      kind: 'expense',
    })
    const title = description || presentation.label

    const nextEntry = {
      id: buildDailyExpenseDetailId(row, key, fallbackOrdinalByKey),
      key,
      amount: toAmountDetail(row.amount),
      title,
      categoryName: presentation.label,
      occurredOn: key,
      color: presentation.color,
      soft: presentation.soft,
      symbol: presentation.symbol,
    }

    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(nextEntry)
  })

  return Array.from(grouped.entries()).flatMap(([key, entries]) =>
    entries
      .sort((left, right) => {
        const amountDifference = right.amount - left.amount
        if (amountDifference !== 0) return amountDifference
        return String(left.title || '').localeCompare(String(right.title || ''))
      })
      .map((entry) => ({ ...entry, key })),
  )
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

function getMonthShortLabel(value) {
  const date = parseCalendarDate(value)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

export function buildRecentCashFlow(expenses = [], income = [], month, monthsBack = 3) {
  const anchorMonth = getMonthStartValue(month)
  if (!anchorMonth) return []

  const safeMonthsBack = Math.max(1, Number(monthsBack) || 3)

  const monthKeys = []
  for (let offset = safeMonthsBack - 1; offset >= 0; offset -= 1) {
    const shifted = shiftMonth(anchorMonth, -offset)
    if (shifted) monthKeys.push(shifted)
  }

  const totalsByMonth = new Map(monthKeys.map((key) => [key, { incomeAmount: 0, expenseAmount: 0 }]))

  const addEntry = (entry, kind) => {
    const key = getMonthStartValue(entry?.date || entry?.created_at)
    if (!key || !totalsByMonth.has(key)) return
    const bucket = totalsByMonth.get(key)
    const amount = Number(entry?.amount ?? 0)
    if (!Number.isFinite(amount)) return
    if (kind === 'income') bucket.incomeAmount += amount
    else bucket.expenseAmount += amount
  }

  income.forEach((entry) => addEntry(entry, 'income'))
  expenses.forEach((entry) => addEntry(entry, 'expense'))

  return monthKeys.map((key) => {
    const bucket = totalsByMonth.get(key) || { incomeAmount: 0, expenseAmount: 0 }
    const incomeAmount = Number(bucket.incomeAmount.toFixed(2))
    const expenseAmount = Number(bucket.expenseAmount.toFixed(2))
    const netAmount = Number((incomeAmount - expenseAmount).toFixed(2))
    return {
      month: key,
      label: getMonthShortLabel(key),
      incomeAmount,
      expenseAmount,
      netAmount,
    }
  })
}

export function buildCumulativeDailyTotals(expenses = [], month) {
  const monthDate = parseCalendarDate(month)
  if (!monthDate) return []

  const year = monthDate.getUTCFullYear()
  const monthIndex = monthDate.getUTCMonth()
  const monthLength = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const totalsByDay = Array.from({ length: monthLength }, () => 0)

  expenses
    .filter((expense) => isInMonth(expense.date || expense.created_at, month))
    .forEach((expense) => {
      const entryDate = parseCalendarDate(expense.date || expense.created_at)
      if (!entryDate) return

      const dayIndex = entryDate.getUTCDate() - 1
      if (dayIndex < 0 || dayIndex >= totalsByDay.length) return
      const amount = Number(expense.amount ?? 0)
      if (Number.isFinite(amount)) totalsByDay[dayIndex] += amount
    })

  let running = 0
  return totalsByDay.map((amount, index) => {
    running += amount
    return {
      day: index + 1,
      amount: Number(running.toFixed(2)),
    }
  })
}

export function buildTrendChartAxes({
  budget,
  monthLength,
  activeDay,
  pointCount,
  width,
  height,
  inset,
  insetTop,
  insetBottom,
  valueCeiling,
}) {
  const safeMonthLength = Math.max(0, Number(monthLength) || 0)
  const safeActiveDay = Math.max(0, Math.min(Number(activeDay) || 0, safeMonthLength))
  const safePointCount = Math.max(0, Math.floor(Number(pointCount) || 0))
  const safeWidth = Math.max(0, Number(width) || 0)
  const safeHeight = Math.max(0, Number(height) || 0)
  const safeInset = Math.max(0, Number(inset) || 0)
  const safeBudget = Number(budget) > 0 ? Number(budget) : 0
  const top = insetTop ?? safeInset
  const bottom = insetBottom ?? safeInset

  const plotWidth = Math.max(safeWidth - safeInset * 2, 0)
  const plotHeight = Math.max(safeHeight - top - bottom, 0)
  const scaleMaxRaw = valueCeiling != null && Number(valueCeiling) > 0 ? Number(valueCeiling) : null
  const scaleMax = scaleMaxRaw != null ? scaleMaxRaw : (safeBudget > 0 ? safeBudget : 1)

  const buildPoint = (progressRatio, valueRatio) => ({
    x: safeInset + plotWidth * progressRatio,
    y: top + plotHeight * (1 - valueRatio),
  })

  const paceLine = safeBudget > 0 && safeMonthLength > 0 && safePointCount >= 2
    ? (() => {
      const start = buildPoint(0, 0)
      const finalProgress = Math.min(Math.max(safePointCount - 1, 0) / Math.max(safePointCount - 1, 1), 1)
      const finalDayIndex = Math.min(safePointCount, safeMonthLength)
      const finalPaceValue = (safeBudget * finalDayIndex) / safeMonthLength
      const paceRatio = Math.min(finalPaceValue / scaleMax, 1)
      return {
        startX: start.x,
        startY: start.y,
        endX: safeInset + plotWidth * finalProgress,
        endY: top + plotHeight * (1 - paceRatio),
      }
    })()
    : null

  const budgetLineY = safeBudget > 0
    ? top + plotHeight * (1 - Math.min(safeBudget / scaleMax, 1))
    : null

  const axisLabels = safeBudget > 0
    ? [
      { y: top + plotHeight, value: 0 },
      { y: top, value: scaleMax },
    ]
    : null

  const budgetLineLabel = safeBudget > 0 ? formatCurrency(safeBudget) : null

  return {
    paceLine,
    budgetLineY,
    budgetLineLabel,
    axisLabels,
    plotLeft: safeInset,
    plotRight: safeWidth - safeInset,
  }
}

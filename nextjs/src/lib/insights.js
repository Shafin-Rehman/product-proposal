import db from './db'
import { buildBudgetSummary } from './budget'
import { getCategoryPresentation } from './financeVisuals'

const HISTORY_MONTH_COUNT = 6
const BREAKDOWN_LIMIT = 5
const TOP_EXPENSE_LIMIT = 4
const MOVERS_LIMIT = 4
const PRESSURE_LIMIT = 3
const BUDGET_CAUTION_RATIO = 60
const BUDGET_WARNING_RATIO = 80

function parseMonthDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatMonthStart(value) {
  const date = parseMonthDate(value)
  if (!date) return null
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function formatDayKey(value) {
  const date = parseMonthDate(value)
  if (!date) return null
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function shiftMonth(value, offset = 0) {
  const date = parseMonthDate(value)
  if (!date) return null
  const nextDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12))
  nextDate.setUTCMonth(nextDate.getUTCMonth() + Number(offset || 0))
  return formatMonthStart(nextDate)
}

function nextMonth(value) {
  return shiftMonth(value, 1)
}

function buildMonthWindow(month, count = HISTORY_MONTH_COUNT) {
  return Array.from({ length: count }, (_, index) => shiftMonth(month, index - (count - 1))).filter(Boolean)
}

function toAmount(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0
}

function getDeltaPercentage(currentAmount, previousAmount) {
  const previous = Number(previousAmount ?? 0)
  if (!previous) return currentAmount > 0 ? 100 : 0
  return Number((((currentAmount - previous) / previous) * 100).toFixed(2))
}

function getBudgetTone({ limit = null, remaining = null, progress = 0 } = {}) {
  if (limit == null || limit <= 0) return 'neutral'
  const remainingRatio = remaining == null ? null : Number((remaining / limit).toFixed(4))

  if ((remaining != null && remaining < 0) || progress >= 100) return 'danger'
  if (progress >= BUDGET_WARNING_RATIO || (remainingRatio != null && remainingRatio <= 0.2)) return 'warning'
  if (progress >= BUDGET_CAUTION_RATIO || (remainingRatio != null && remainingRatio <= 0.4)) return 'caution'
  return 'positive'
}

function getBudgetStatusLabel(tone, hasBudget, fallback = 'Share') {
  if (!hasBudget) return fallback
  if (tone === 'danger') return 'Over budget'
  if (tone === 'warning') return 'Near limit'
  if (tone === 'caution') return 'Watch'
  return 'On track'
}

function getSeverityScore(tone) {
  if (tone === 'danger') return 4
  if (tone === 'warning') return 3
  if (tone === 'caution') return 2
  if (tone === 'positive') return 1
  return 0
}

function formatMonthRangeLabel(startMonth, endMonth) {
  const start = parseMonthDate(startMonth)
  const end = parseMonthDate(endMonth)
  if (!start || !end) return null
  const formatOptions = { month: 'short', year: 'numeric', timeZone: 'UTC' }
  return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`
}

function buildShareBreakdown(items = []) {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return items.map((item) => ({
    ...item,
    share: total > 0 ? Number(((item.amount / total) * 100).toFixed(2)) : 0,
  }))
}

function buildDailyExpenseEntryId(row, dayKey, fallbackOrdinalByKey) {
  if (row.id != null && row.id !== '') {
    return String(row.id)
  }
  const amount = toAmount(row.amount)
  const title = String(row.title ?? '').trim()
  const category = String(row.category_name ?? '').trim()
  const dedupeKey = `${dayKey}\t${amount}\t${title}\t${category}`
  const ordinal = (fallbackOrdinalByKey.get(dedupeKey) ?? 0) + 1
  fallbackOrdinalByKey.set(dedupeKey, ordinal)
  const ordinalSuffix = ordinal > 1 ? `:${ordinal}` : ''
  return `daily-expense-fallback:${dayKey}:${amount}:${title}:${category}${ordinalSuffix}`
}

export function buildDailySpendDetails(rows = []) {
  const grouped = new Map()
  const fallbackOrdinalByKey = new Map()

  rows.forEach((row) => {
    const key = formatDayKey(row.occurred_on)
    if (!key) return

    const presentation = getCategoryPresentation({
      name: row.category_name,
      icon: row.category_icon,
      kind: 'expense',
    })
    const nextEntry = {
      id: buildDailyExpenseEntryId(row, key, fallbackOrdinalByKey),
      key,
      amount: toAmount(row.amount),
      title: row.title,
      categoryName: presentation.label,
      categoryIcon: row.category_icon ?? null,
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
      .map((entry) => ({ ...entry, key }))
  )
}

function buildExpenseBreakdown(summary) {
  const items = (summary?.category_statuses ?? [])
    .map((item) => {
      const amount = toAmount(item.spent)
      if (amount <= 0) return null

      const limit = item.monthly_limit == null ? null : toAmount(item.monthly_limit)
      const remaining = item.remaining_budget == null ? null : toAmount(item.remaining_budget)
      const progress = limit == null ? 0 : Math.min(Number(item.progress_percentage ?? 0), 100)
      const tone = getBudgetTone({ limit, remaining, progress })
      const presentation = getCategoryPresentation({
        name: item.category_name,
        icon: item.category_icon,
        kind: 'expense',
      })

      return {
        id: item.category_id ?? item.category_name ?? `expense-${presentation.label}`,
        name: presentation.label,
        amount,
        color: presentation.color,
        soft: presentation.soft,
        symbol: presentation.symbol,
        progressValue: limit == null ? 0 : progress,
        progressLabel: limit == null ? 'Spend share' : `${Math.round(progress)}% used`,
        supportingText: limit == null
          ? 'No category budget'
          : remaining < 0
            ? `$${Math.abs(remaining).toFixed(2)} over budget`
            : `$${remaining.toFixed(2)} left of $${limit.toFixed(2)}`,
        statusLabel: getBudgetStatusLabel(tone, limit != null, 'No budget'),
        tone,
        hasBudget: limit != null,
        monthlyLimit: limit,
        remainingBudget: remaining,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, BREAKDOWN_LIMIT)

  return buildShareBreakdown(items).map((item) => ({
    ...item,
    progressValue: item.hasBudget ? item.progressValue : Math.min(item.share, 100),
    progressLabel: item.hasBudget ? item.progressLabel : `${Math.round(item.share)}% of spending`,
  }))
}

async function getIncomeBreakdown(userId, month) {
  const endMonth = nextMonth(month)
  const { rows } = await db.query(
    `SELECT
       COALESCE(s.name, 'Income') AS source_name,
       s.icon AS source_icon,
       COUNT(*)::INT AS entry_count,
       COALESCE(SUM(i.amount), 0.00)::TEXT AS amount
     FROM public.income i
     LEFT JOIN public.income_sources s ON i.source_id = s.id
     WHERE i.user_id = $1 AND i.date >= $2 AND i.date < $3
     GROUP BY COALESCE(s.name, 'Income'), s.icon
     ORDER BY amount DESC, source_name ASC`,
    [userId, month, endMonth]
  )

  const items = rows
    .map((row, index) => {
      const amount = toAmount(row.amount)
      if (amount <= 0) return null

      const presentation = getCategoryPresentation({
        name: row.source_name,
        icon: row.source_icon,
        kind: 'income',
      })
      return {
        id: `income-${row.source_name || 'Income'}-${index}`,
        name: presentation.label,
        amount,
        color: presentation.color,
        soft: presentation.soft,
        symbol: presentation.symbol,
        entryCount: Number(row.entry_count ?? 0),
        tone: 'positive',
        statusLabel: 'Income share',
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, BREAKDOWN_LIMIT)

  return buildShareBreakdown(items).map((item) => ({
    ...item,
    progressValue: Math.min(item.share, 100),
    progressLabel: `${Math.round(item.share)}% of income`,
    supportingText: `${item.entryCount || 1} deposit${item.entryCount === 1 ? '' : 's'}`,
  }))
}

function buildComparisonMetric(id, label, currentAmount, previousAmount, direction = 'higher-better') {
  const current = currentAmount == null ? null : toAmount(currentAmount)
  const previous = previousAmount == null ? null : toAmount(previousAmount)
  const hasComparison = current != null && previous != null
  const delta = hasComparison ? Number((current - previous).toFixed(2)) : null

  let deltaTone = 'neutral'
  if (delta != null && delta !== 0) {
    if (direction === 'higher-better') {
      deltaTone = delta > 0 ? 'positive' : 'warning'
    } else {
      deltaTone = delta < 0 ? 'positive' : 'warning'
    }
  }

  return {
    id,
    label,
    currentAmount: current,
    previousAmount: previous,
    deltaAmount: delta,
    deltaPercentage: hasComparison ? getDeltaPercentage(current, previous) : null,
    deltaTone,
    direction,
  }
}

function buildBudgetComparisonMetric(summary, previousSummary) {
  const currentRemaining = summary?.remaining_budget == null ? null : toAmount(summary.remaining_budget)
  const previousRemaining = previousSummary?.remaining_budget == null ? null : toAmount(previousSummary.remaining_budget)
  const currentBudget = summary?.total_budget == null ? null : toAmount(summary.total_budget)
  const previousBudget = previousSummary?.total_budget == null ? null : toAmount(previousSummary.total_budget)

  if (currentBudget == null && previousBudget == null) {
    return {
      id: 'budget-left',
      label: 'Budget left',
      currentAmount: null,
      previousAmount: null,
      deltaAmount: null,
      deltaPercentage: null,
      deltaTone: 'neutral',
      direction: 'higher-better',
      currentBudget: null,
      previousBudget: null,
    }
  }

  return {
    ...buildComparisonMetric('budget-left', 'Budget left', currentRemaining, previousRemaining, 'higher-better'),
    currentBudget,
    previousBudget,
  }
}

export function buildCategoryMovers(currentStatuses = [], previousStatuses = []) {
  const combined = new Map()

  ;[
    ...currentStatuses.map((item) => ({ ...item, monthType: 'current' })),
    ...previousStatuses.map((item) => ({ ...item, monthType: 'previous' })),
  ].forEach((item) => {
    const key = item.category_id ?? item.category_name ?? 'uncategorized'
    const current = combined.get(key) ?? {}
    combined.set(key, {
      ...current,
      [item.monthType]: item,
    })
  })

  return Array.from(combined.values())
    .map(({ current, previous }) => {
      const currentAmount = toAmount(current?.spent)
      const previousAmount = toAmount(previous?.spent)
      const deltaAmount = Number((currentAmount - previousAmount).toFixed(2))
      const presentation = getCategoryPresentation({
        name: current?.category_name || previous?.category_name,
        icon: current?.category_icon || previous?.category_icon,
        kind: 'expense',
      })
      const currentLimit = current?.monthly_limit == null ? null : toAmount(current.monthly_limit)
      const currentRemaining = current?.remaining_budget == null ? null : toAmount(current.remaining_budget)
      const currentProgress = currentLimit == null ? 0 : Math.min(Number(current?.progress_percentage ?? 0), 100)
      const currentTone = getBudgetTone({
        limit: currentLimit,
        remaining: currentRemaining,
        progress: currentProgress,
      })

      return {
        id: current?.category_id ?? previous?.category_id ?? presentation.label,
        name: presentation.label,
        amount: currentAmount,
        previousAmount,
        deltaAmount,
        deltaPercentage: getDeltaPercentage(currentAmount, previousAmount),
        deltaTone: deltaAmount > 0 ? 'danger' : deltaAmount < 0 ? 'positive' : 'neutral',
        direction: deltaAmount > 0 ? 'up' : deltaAmount < 0 ? 'down' : 'flat',
        color: presentation.color,
        soft: presentation.soft,
        symbol: presentation.symbol,
        tone: currentTone,
        progressValue: currentLimit == null ? 0 : currentProgress,
        statusLabel: getBudgetStatusLabel(currentTone, currentLimit != null, 'No budget'),
      }
    })
    .filter((item) => item.amount > 0 || item.previousAmount > 0)
    .sort((left, right) => {
      const deltaDifference = Math.abs(right.deltaAmount) - Math.abs(left.deltaAmount)
      if (deltaDifference !== 0) return deltaDifference
      return right.amount - left.amount
    })
    .slice(0, MOVERS_LIMIT)
}

export function buildBudgetHealth(summary) {
  const budgetAmount = summary?.total_budget == null ? null : toAmount(summary.total_budget)
  const spentAmount = toAmount(summary?.total_expenses)
  const remainingAmount = summary?.remaining_budget == null ? null : toAmount(summary.remaining_budget)
  const progress = budgetAmount == null || budgetAmount <= 0 ? 0 : Number(((spentAmount / budgetAmount) * 100).toFixed(2))
  const tone = getBudgetTone({
    limit: budgetAmount,
    remaining: remainingAmount,
    progress,
  })

  const pressureCategories = buildExpenseBreakdown(summary)
    .filter((item) => item.hasBudget)
    .sort((left, right) => {
      const severityDifference = getSeverityScore(right.tone) - getSeverityScore(left.tone)
      if (severityDifference !== 0) return severityDifference
      if (right.progressValue !== left.progressValue) return right.progressValue - left.progressValue
      return right.amount - left.amount
    })
    .slice(0, PRESSURE_LIMIT)

  return {
    tone,
    statusLabel: budgetAmount == null ? 'No budget' : getBudgetStatusLabel(tone, true, 'No budget'),
    budgetAmount,
    spentAmount,
    remainingAmount,
    progressValue: budgetAmount == null || budgetAmount <= 0 ? 0 : Math.min(progress, 100),
    pressureCategories,
  }
}

export function buildCashFlowSeries(months, expenseRows = [], incomeRows = []) {
  const expensesByMonth = new Map(expenseRows.map((row) => [formatMonthStart(row.month), toAmount(row.total_expenses)]))
  const incomeByMonth = new Map(incomeRows.map((row) => [formatMonthStart(row.month), toAmount(row.total_income)]))

  const series = months.map((month) => {
    const incomeAmount = incomeByMonth.get(month) ?? 0
    const expenseAmount = expensesByMonth.get(month) ?? 0
    const netAmount = Number((incomeAmount - expenseAmount).toFixed(2))
    const monthDate = parseMonthDate(month)

    return {
      month,
      label: monthDate?.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) || month,
      incomeAmount,
      expenseAmount,
      netAmount,
    }
  })

  const totalIncome = series.reduce((sum, item) => sum + item.incomeAmount, 0)
  const totalExpenses = series.reduce((sum, item) => sum + item.expenseAmount, 0)
  const totalNet = Number((totalIncome - totalExpenses).toFixed(2))

  return {
    series,
    rangeLabel: formatMonthRangeLabel(series[0]?.month, series.at(-1)?.month),
    summary: {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalNet,
      averageNet: Number((totalNet / Math.max(series.length, 1)).toFixed(2)),
    },
  }
}

export function buildDailySpendSeries(rows = [], month) {
  const monthDate = parseMonthDate(month)
  if (!monthDate) {
    return { series: [], totalAmount: 0, averageAmount: 0, activeDayAverage: 0, peakDay: null, activeDays: 0 }
  }

  const today = new Date()
  const isCurrentMonth = monthDate.getUTCFullYear() === today.getUTCFullYear() && monthDate.getUTCMonth() === today.getUTCMonth()
  const monthLength = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate()
  const visibleDays = isCurrentMonth ? Math.min(today.getUTCDate(), monthLength) : monthLength
  const totalsByDay = new Map(rows.map((row) => [formatDayKey(row.day), toAmount(row.total_spend)]))

  const series = Array.from({ length: visibleDays }, (_, index) => {
    const date = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), index + 1, 12))
    const dayKey = formatDayKey(date)
    return { day: index + 1, key: dayKey, amount: totalsByDay.get(dayKey) ?? 0 }
  })

  const totalAmount = Number(series.reduce((sum, item) => sum + item.amount, 0).toFixed(2))
  const activeDays = series.filter((item) => item.amount > 0).length
  const peakDay = [...series].sort((left, right) => right.amount - left.amount)[0]

  return {
    series,
    totalAmount,
    averageAmount: Number((totalAmount / Math.max(series.length, 1)).toFixed(2)),
    activeDayAverage: Number((totalAmount / Math.max(activeDays, 1)).toFixed(2)),
    peakDay: peakDay?.amount > 0 ? peakDay : null,
    activeDays,
  }
}

async function getEarliestMonth(userId) {
  const { rows } = await db.query(
    `WITH dated_entries AS (
       SELECT MIN(date) AS earliest_date FROM public.expenses WHERE user_id = $1
       UNION ALL
       SELECT MIN(date) AS earliest_date FROM public.income WHERE user_id = $1
     )
     SELECT MIN(earliest_date) AS earliest_date FROM dated_entries`,
    [userId]
  )
  return formatMonthStart(rows[0]?.earliest_date)
}

async function getMonthlyExpenseTotals(userId, startMonth, endMonth) {
  const { rows } = await db.query(
    `SELECT
       DATE_TRUNC('month', e.date)::DATE AS month,
       COALESCE(SUM(e.amount), 0.00)::TEXT AS total_expenses
     FROM public.expenses e
     WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3
     GROUP BY DATE_TRUNC('month', e.date)::DATE
     ORDER BY month ASC`,
    [userId, startMonth, endMonth]
  )
  return rows
}

async function getMonthlyIncomeTotals(userId, startMonth, endMonth) {
  const { rows } = await db.query(
    `SELECT
       DATE_TRUNC('month', i.date)::DATE AS month,
       COALESCE(SUM(i.amount), 0.00)::TEXT AS total_income
     FROM public.income i
     WHERE i.user_id = $1 AND i.date >= $2 AND i.date < $3
     GROUP BY DATE_TRUNC('month', i.date)::DATE
     ORDER BY month ASC`,
    [userId, startMonth, endMonth]
  )
  return rows
}

async function getDailyExpenseTotals(userId, month) {
  const endMonth = nextMonth(month)
  const { rows } = await db.query(
    `SELECT
       DATE_TRUNC('day', e.date)::DATE AS day,
       COALESCE(SUM(e.amount), 0.00)::TEXT AS total_spend
     FROM public.expenses e
     WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3
     GROUP BY DATE_TRUNC('day', e.date)::DATE
     ORDER BY day ASC`,
    [userId, month, endMonth]
  )
  return rows
}

async function getDailyExpenseEntries(userId, month) {
  const endMonth = nextMonth(month)
  const { rows } = await db.query(
    `SELECT
       e.id,
       e.amount::TEXT AS amount,
       e.date AS occurred_on,
       COALESCE(NULLIF(e.description, ''), COALESCE(c.name, 'Uncategorized')) AS title,
       COALESCE(c.name, 'Uncategorized') AS category_name,
       c.icon AS category_icon
     FROM public.expenses e
     LEFT JOIN public.categories c ON e.category_id = c.id
     WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3
     ORDER BY e.date ASC, e.amount DESC, title ASC`,
    [userId, month, endMonth]
  )

  return rows
}

async function getTopExpenses(userId, month) {
  const endMonth = nextMonth(month)
  const { rows } = await db.query(
    `SELECT
       e.id,
       e.amount::TEXT AS amount,
       e.date AS occurred_on,
       COALESCE(NULLIF(e.description, ''), COALESCE(c.name, 'Uncategorized')) AS title,
       COALESCE(c.name, 'Uncategorized') AS category_name,
       c.icon AS category_icon
     FROM public.expenses e
     LEFT JOIN public.categories c ON e.category_id = c.id
     WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3
     ORDER BY e.amount DESC, e.date DESC
     LIMIT ${TOP_EXPENSE_LIMIT}`,
    [userId, month, endMonth]
  )

  return rows.map((row, index) => {
    const presentation = getCategoryPresentation({
      name: row.category_name,
      icon: row.category_icon,
      kind: 'expense',
    })
    return {
      id: row.id ?? `expense-${index}`,
      amount: toAmount(row.amount),
      title: row.title,
      categoryName: presentation.label,
      categoryIcon: row.category_icon ?? null,
      occurredOn: formatDayKey(row.occurred_on),
      color: presentation.color,
      soft: presentation.soft,
      symbol: presentation.symbol,
    }
  })
}

export function buildComparisonMetrics(summary, previousSummary) {
  return [
    buildComparisonMetric('income', 'Income', summary?.total_income, previousSummary?.total_income, 'higher-better'),
    buildComparisonMetric('expenses', 'Expenses', summary?.total_expenses, previousSummary?.total_expenses, 'lower-better'),
    buildComparisonMetric(
      'net',
      'Net cash flow',
      toAmount(summary?.total_income) - toAmount(summary?.total_expenses),
      toAmount(previousSummary?.total_income) - toAmount(previousSummary?.total_expenses),
      'higher-better'
    ),
    buildBudgetComparisonMetric(summary, previousSummary),
  ]
}

export async function buildInsightsSnapshot(userId, month) {
  const previousMonth = shiftMonth(month, -1)
  const monthWindow = buildMonthWindow(month)
  const rangeStart = monthWindow[0]
  const rangeEnd = nextMonth(month)

  const [
    summary,
    previousSummary,
    incomeBreakdown,
    earliestMonth,
    monthlyExpenseTotals,
    monthlyIncomeTotals,
    dailyExpenseTotals,
    dailyExpenseEntries,
    topExpenses,
    previousDailyExpenseTotals,
    previousDailyExpenseEntries,
  ] = await Promise.all([
    buildBudgetSummary(userId, month),
    previousMonth ? buildBudgetSummary(userId, previousMonth) : Promise.resolve(null),
    getIncomeBreakdown(userId, month),
    getEarliestMonth(userId),
    getMonthlyExpenseTotals(userId, rangeStart, rangeEnd),
    getMonthlyIncomeTotals(userId, rangeStart, rangeEnd),
    getDailyExpenseTotals(userId, month),
    getDailyExpenseEntries(userId, month),
    getTopExpenses(userId, month),
    previousMonth ? getDailyExpenseTotals(userId, previousMonth) : Promise.resolve([]),
    previousMonth ? getDailyExpenseEntries(userId, previousMonth) : Promise.resolve([]),
  ])

  const cashFlow = buildCashFlowSeries(monthWindow, monthlyExpenseTotals, monthlyIncomeTotals)
  const dailySpend = {
    ...buildDailySpendSeries(dailyExpenseTotals, month),
    details: buildDailySpendDetails(dailyExpenseEntries),
  }
  const previousDailySpend = previousMonth
    ? {
      ...buildDailySpendSeries(previousDailyExpenseTotals, previousMonth),
      details: buildDailySpendDetails(previousDailyExpenseEntries),
    }
    : { series: [], totalAmount: 0, averageAmount: 0, activeDayAverage: 0, peakDay: null, activeDays: 0, details: [] }
  const categoryMovers = buildCategoryMovers(summary?.category_statuses, previousSummary?.category_statuses)
  const budgetHealth = buildBudgetHealth(summary)

  return {
    month,
    previousMonth,
    earliestMonth,
    comparisonMetrics: buildComparisonMetrics(summary, previousSummary),
    expenseBreakdown: buildExpenseBreakdown(summary),
    incomeBreakdown,
    cashFlowSeries: cashFlow.series,
    cashFlowRangeLabel: cashFlow.rangeLabel,
    cashFlowSummary: cashFlow.summary,
    categoryMovers,
    budgetHealth,
    dailySpend,
    previousDailySpend,
    topExpenses,
  }
}

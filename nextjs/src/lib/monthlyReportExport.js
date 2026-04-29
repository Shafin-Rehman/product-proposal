import db from './db'
import { buildBudgetSummary } from './budget'

export const MONTHLY_REPORT_COLUMNS = [
  'section',
  'month',
  'type',
  'date',
  'title',
  'category_or_source',
  'description_or_notes',
  'amount',
  'total_income',
  'total_expenses',
  'net_cash_flow',
  'total_budget',
  'remaining_budget',
  'id',
  'created_at',
]

const FORMULA_PREFIX_PATTERN = /^\s*[=+\-@]/

function nextMonth(month) {
  const date = new Date(`${month}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function normalizeDay(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  }
  const text = String(value)
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return text
}

function normalizeTimestamp(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString()
  }
  return String(value)
}

function formatMoney(value) {
  if (value == null || value === '') return ''
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toFixed(2) : ''
}

function safeText(value) {
  if (value == null) return ''
  const text = String(value)
  return FORMULA_PREFIX_PATTERN.test(text) ? `'${text}` : text
}

export function escapeCsvCell(value, { text = true } = {}) {
  const rawValue = value == null ? '' : String(value)
  const safeValue = text ? safeText(rawValue) : rawValue
  const escaped = safeValue.replaceAll('"', '""')
  return /[",\r\n]|^\s|\s$/.test(escaped) ? `"${escaped}"` : escaped
}

function buildCsvLine(row) {
  return MONTHLY_REPORT_COLUMNS.map((column) => {
    const isNumericColumn = [
      'amount',
      'total_income',
      'total_expenses',
      'net_cash_flow',
      'total_budget',
      'remaining_budget',
    ].includes(column)
    return escapeCsvCell(row[column], { text: !isNumericColumn })
  }).join(',')
}

function toAmount(value) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function buildSummaryRow(summary, month) {
  const totalIncome = formatMoney(summary?.total_income ?? 0)
  const totalExpenses = formatMoney(summary?.total_expenses ?? 0)
  const netCashFlow = (toAmount(summary?.total_income) - toAmount(summary?.total_expenses)).toFixed(2)

  return {
    section: 'summary',
    month,
    type: 'monthly_summary',
    date: '',
    title: '',
    category_or_source: '',
    description_or_notes: '',
    amount: '',
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net_cash_flow: netCashFlow,
    total_budget: formatMoney(summary?.total_budget),
    remaining_budget: formatMoney(summary?.remaining_budget),
    id: '',
    created_at: '',
  }
}

function buildTransactionRow(row) {
  const label = row.category_or_source || (row.type === 'income' ? 'No source' : 'Uncategorized')
  const notes = row.description_or_notes || ''
  const title = row.title || notes || label

  return {
    section: 'transaction',
    month: normalizeDay(row.month),
    type: row.type,
    date: normalizeDay(row.date),
    title,
    category_or_source: label,
    description_or_notes: notes,
    amount: formatMoney(row.amount),
    total_income: '',
    total_expenses: '',
    net_cash_flow: '',
    total_budget: '',
    remaining_budget: '',
    id: row.id,
    created_at: normalizeTimestamp(row.created_at),
  }
}

function compareTransactions(left, right) {
  const dateCompare = normalizeDay(right.date).localeCompare(normalizeDay(left.date))
  if (dateCompare) return dateCompare

  const createdCompare = String(right.created_at || '').localeCompare(String(left.created_at || ''))
  if (createdCompare) return createdCompare

  return String(left.type || '').localeCompare(String(right.type || ''))
}

export function buildMonthlyReportCsv({ month, summary, transactions = [] }) {
  const rows = [
    buildSummaryRow(summary, month),
    ...transactions.sort(compareTransactions).map(buildTransactionRow),
  ]

  return [
    MONTHLY_REPORT_COLUMNS.join(','),
    ...rows.map(buildCsvLine),
  ].join('\r\n')
}

export function getMonthlyReportFilename(month) {
  const safeMonth = String(month || '').slice(0, 7).replace(/[^0-9-]/g, '')
  return `budgetbuddy-${safeMonth || 'monthly'}-report.csv`
}

export async function getMonthlyReportTransactions(userId, month) {
  const endMonth = nextMonth(month)
  const [expenseResult, incomeResult] = await Promise.all([
    db.query(
      `SELECT
         e.id,
         $2::DATE AS month,
         'expense' AS type,
         e.date,
         COALESCE(NULLIF(BTRIM(e.description), ''), COALESCE(c.name, 'Uncategorized')) AS title,
         COALESCE(c.name, 'Uncategorized') AS category_or_source,
         e.description AS description_or_notes,
         e.amount::TEXT AS amount,
         e.created_at
       FROM public.expenses e
       LEFT JOIN public.categories c ON e.category_id = c.id
       WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3`,
      [userId, month, endMonth]
    ),
    db.query(
      `SELECT
         i.id,
         $2::DATE AS month,
         'income' AS type,
         i.date,
         COALESCE(NULLIF(BTRIM(i.notes), ''), COALESCE(s.name, 'No source')) AS title,
         COALESCE(s.name, 'No source') AS category_or_source,
         i.notes AS description_or_notes,
         i.amount::TEXT AS amount,
         i.created_at
       FROM public.income i
       LEFT JOIN public.income_sources s ON i.source_id = s.id
       WHERE i.user_id = $1 AND i.date >= $2 AND i.date < $3`,
      [userId, month, endMonth]
    ),
  ])

  return [...expenseResult.rows, ...incomeResult.rows].sort(compareTransactions)
}

export async function buildMonthlyReportExport(userId, month) {
  const [summary, transactions] = await Promise.all([
    buildBudgetSummary(userId, month),
    getMonthlyReportTransactions(userId, month),
  ])

  return buildMonthlyReportCsv({ month, summary, transactions })
}

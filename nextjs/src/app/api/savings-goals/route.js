import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { buildBudgetSummary, normalizeMonth } from '@/lib/budget'
import {
  buildSavingsGoalsSummary,
  createSavingsGoal,
  getSavingsGoalReferenceDate,
  listSavingsGoals,
} from '@/lib/savingsGoals'
import { getCurrentMonthStart } from '@/lib/financeUtils'

function validationError(message) {
  return NextResponse.json({ error: message }, { status: 400 })
}

async function readJsonObject(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return { error: 'Request body must be valid JSON' }
  }

  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return { error: 'Request body must be a JSON object' }
  }

  return { body }
}

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const url = new URL(request.url)
  const includeArchived = url.searchParams.get('include_archived') === 'true'
  const rawMonth = url.searchParams.get('month')
  const month = rawMonth == null ? getCurrentMonthStart() : normalizeMonth(rawMonth)
  if (!month) return validationError('Valid month is required')

  try {
    const [goals, budgetSummary] = await Promise.all([
      listSavingsGoals(user.id, { includeArchived: true }),
      buildBudgetSummary(user.id, month),
    ])

    const payload = buildSavingsGoalsSummary(goals, budgetSummary, getSavingsGoalReferenceDate(month))
    return NextResponse.json({
      ...payload,
      goals: includeArchived ? payload.goals : payload.goals.filter((goal) => !goal.archived),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch savings goals' }, { status: 500 })
  }
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const parsed = await readJsonObject(request)
  if (parsed.error) return validationError(parsed.error)

  const body = parsed.body
  const month = body.month === undefined ? getCurrentMonthStart() : normalizeMonth(body.month)
  if (!month) return validationError('Valid month is required')

  try {
    const goal = await createSavingsGoal(user.id, body)
    const budgetSummary = await buildBudgetSummary(user.id, month)
    return NextResponse.json(buildSavingsGoalsSummary([goal], budgetSummary, getSavingsGoalReferenceDate(month)).goals[0])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create savings goal'
    if (
      message.includes('must be')
      || message.includes('required')
      || message.includes('Valid')
    ) {
      return validationError(message)
    }
    return NextResponse.json({ error: 'Failed to create savings goal' }, { status: 500 })
  }
}

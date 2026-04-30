import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { buildBudgetSummary, normalizeMonth } from '@/lib/budget'
import { getCurrentMonthStart } from '@/lib/financeUtils'
import { buildSavingsGoalsSummary, getSavingsGoalReferenceDate, updateSavingsGoal } from '@/lib/savingsGoals'

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

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const parsed = await readJsonObject(request)
  if (parsed.error) return validationError(parsed.error)

  const body = parsed.body
  const { goal_id: goalId, ...updates } = body
  if (!goalId) return validationError('goal_id required')
  const month = updates.month === undefined ? getCurrentMonthStart() : normalizeMonth(updates.month)
  if (!month) return validationError('Valid month is required')
  delete updates.month

  try {
    const goal = await updateSavingsGoal(user.id, goalId, updates)
    if (!goal) return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 })
    const budgetSummary = await buildBudgetSummary(user.id, month)
    return NextResponse.json(buildSavingsGoalsSummary([goal], budgetSummary, getSavingsGoalReferenceDate(month)).goals[0])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update savings goal'
    if (
      message.includes('must be')
      || message.includes('required')
      || message.includes('Valid')
      || message.includes('No fields')
    ) {
      return validationError(message)
    }
    return NextResponse.json({ error: 'Failed to update savings goal' }, { status: 500 })
  }
}

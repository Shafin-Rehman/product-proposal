import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { archiveSavingsGoal, SavingsGoalValidationError } from '@/lib/savingsGoals'

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
  if (!body.goal_id) {
    return validationError('goal_id required')
  }

  try {
    const goal = await archiveSavingsGoal(user.id, body.goal_id)
    if (!goal) return NextResponse.json({ error: 'Savings goal not found' }, { status: 404 })
    return NextResponse.json(goal)
  } catch (err) {
    if (err instanceof SavingsGoalValidationError) {
      return validationError(err.message)
    }
    return NextResponse.json({ error: 'Failed to archive savings goal' }, { status: 500 })
  }
}

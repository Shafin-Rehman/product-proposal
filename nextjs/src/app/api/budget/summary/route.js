import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { buildBudgetSummary, normalizeMonth } from '@/lib/budget'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const month = normalizeMonth(new URL(request.url).searchParams.get('month'))
  if (!month) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })

  try {
    const summary = await buildBudgetSummary(user.id, month)

    return NextResponse.json({
      month: summary.month,
      monthly_limit: summary.monthly_limit,
      total_income: summary.total_income,
      total_expenses: summary.total_expenses,
      remaining_budget: summary.remaining_budget,
      threshold_exceeded: summary.threshold_exceeded,
      notified: summary.notified,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch budget summary' }, { status: 500 })
  }
}

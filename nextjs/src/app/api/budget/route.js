import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { evaluateThresholdForMonth, getMonthlyBudget, normalizeMonth, upsertMonthlyBudget } from '@/lib/budget'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const month = normalizeMonth(new URL(request.url).searchParams.get('month'))
  if (!month) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })

  try {
    const budget = await getMonthlyBudget(user.id, month)
    return NextResponse.json(budget ?? null)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 })
  }
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body = {}
  try { body = await request.json() } catch {}

  const month = normalizeMonth(body.month)
  const monthlyLimit = body.monthly_limit

  if (!month) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })
  if (monthlyLimit == null || Number.isNaN(Number(monthlyLimit)) || Number(monthlyLimit) <= 0) {
    return NextResponse.json({ error: 'monthly_limit must be greater than 0' }, { status: 400 })
  }

  try {
    const savedBudget = await upsertMonthlyBudget(user.id, month, monthlyLimit)
    const updatedBudget = await evaluateThresholdForMonth(user.id, month)

    return NextResponse.json({
      month: savedBudget.month,
      monthly_limit: savedBudget.monthly_limit,
      notified: updatedBudget?.notified ?? false,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

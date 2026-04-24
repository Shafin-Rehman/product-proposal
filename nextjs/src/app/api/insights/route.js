import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { normalizeMonth } from '@/lib/budget'
import { buildInsightsSnapshot } from '@/lib/insights'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const month = normalizeMonth(new URL(request.url).searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await buildInsightsSnapshot(user.id, month))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch insights snapshot' }, { status: 500 })
  }
}

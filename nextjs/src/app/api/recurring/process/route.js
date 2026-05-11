import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { effectiveBillingDayFromClient } from '@/lib/recurringDates'
import { processUserRecurring } from '@/lib/recurringProcessor'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body
  try {
    body = await request.json()
  } catch {
    body = {}
  }
  const utcToday = new Date().toISOString().slice(0, 10)
  const asOf = effectiveBillingDayFromClient(utcToday, body?.as_of)

  const generated = await processUserRecurring(user.id, asOf)
  return NextResponse.json({ generated })
}

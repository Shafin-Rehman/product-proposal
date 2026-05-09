import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { processUserRecurring } from '@/lib/recurringProcessor'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const generated = await processUserRecurring(user.id)
  return NextResponse.json({ generated })
}

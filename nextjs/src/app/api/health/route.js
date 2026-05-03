import { NextResponse } from 'next/server'
import { runHealthChecks } from '@/lib/healthChecks'

export async function GET() {
  const results = await runHealthChecks()
  const allOk = results.every((r) => r.status === 'ok')
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded' },
    { status: allOk ? 200 : 503 }
  )
}

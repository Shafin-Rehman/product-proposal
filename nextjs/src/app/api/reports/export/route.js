import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import { normalizeMonth } from '@/lib/budget'
import { buildMonthlyReportExport, getMonthlyReportFilename } from '@/lib/monthlyReportExport'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const month = normalizeMonth(new URL(request.url).searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'Valid month is required in YYYY-MM or YYYY-MM-DD format.' }, { status: 400 })
  }

  try {
    const csv = await buildMonthlyReportExport(user.id, month)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${getMonthlyReportFilename(month)}"`,
        'cache-control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to export monthly report' }, { status: 500 })
  }
}

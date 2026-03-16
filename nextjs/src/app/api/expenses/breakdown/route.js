import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { normalizeMonth } from '@/lib/budget'

function getNextMonth(month) {
  const date = new Date(`${month}T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + 1)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const month = normalizeMonth(new URL(request.url).searchParams.get('month'))
  if (!month) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })

  try {
    const { rows } = await db.query(
      `SELECT
         e.category_id,
         COALESCE(c.name, 'Uncategorized') AS category_name,
         COALESCE(SUM(e.amount), 0)::TEXT AS total_amount
       FROM public.expenses e
       LEFT JOIN public.categories c ON e.category_id = c.id
       WHERE e.user_id = $1 AND e.date >= $2 AND e.date < $3
       GROUP BY e.category_id, COALESCE(c.name, 'Uncategorized')
       ORDER BY category_name ASC`,
      [user.id, month, getNextMonth(month)]
    )

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch expense breakdown' }, { status: 500 })
  }
}

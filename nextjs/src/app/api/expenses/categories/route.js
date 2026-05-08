import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const url = new URL(request.url)
  const includeArchived = url.searchParams.get('include_archived') === 'true'

  try {
    const archivedFilter = includeArchived ? '' : 'AND archived = FALSE'

    const { rows } = await db.query(
      `SELECT id, name, icon, archived, user_id
       FROM public.categories
       WHERE (user_id IS NULL OR user_id = $1)
       ${archivedFilter}
       ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END, name ASC`,
      [user.id]
    )

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch expense categories' }, { status: 500 })
  }
}

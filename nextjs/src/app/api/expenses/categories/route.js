import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  try {
    const { rows } = await db.query(
      `SELECT id, name, icon
       FROM public.categories
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY name ASC`,
      [user.id]
    )

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch expense categories' }, { status: 500 })
  }
}

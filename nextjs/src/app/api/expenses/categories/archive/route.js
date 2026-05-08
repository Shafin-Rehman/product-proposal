import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body = {}
  try { body = await request.json() } catch {}

  const { category_id, archived } = body

  if (!category_id) {
    return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
  }

  if (typeof archived !== 'boolean') {
    return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 })
  }

  try {
    const existingResult = await db.query(
      `SELECT id, archived FROM public.categories WHERE id = $1 AND user_id = $2`,
      [category_id, user.id]
    )

    if (!existingResult.rows.length) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const currentArchived = existingResult.rows[0].archived
    if (currentArchived === archived) {
      return NextResponse.json({ error: `Category is already ${archived ? 'archived' : 'active'}` }, { status: 400 })
    }

    const { rows } = await db.query(
      `UPDATE public.categories
       SET archived = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name, icon, archived, created_at, updated_at`,
      [archived, category_id, user.id]
    )

    const { user_id, ...category } = rows[0]
    return NextResponse.json(category, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}
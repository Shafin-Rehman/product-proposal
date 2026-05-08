import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

function validateCategoryName(name) {
  if (!name || typeof name !== 'string') return false
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= 100
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body = {}
  try { body = await request.json() } catch {}

  const { category_id, new_name } = body

  if (!category_id) {
    return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
  }

  if (!validateCategoryName(new_name)) {
    return NextResponse.json({ error: 'Category name is required and must be 1-100 characters' }, { status: 400 })
  }

  try {
    const existingResult = await db.query(
      `SELECT id FROM public.categories WHERE id = $1 AND user_id = $2`,
      [category_id, user.id]
    )

    if (!existingResult.rows.length) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const { rows } = await db.query(
      `UPDATE public.categories
       SET name = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name, icon, archived, created_at, updated_at`,
      [new_name.trim(), category_id, user.id]
    )

    const { user_id, ...category } = rows[0]
    return NextResponse.json(category, { status: 200 })
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: `Category "${new_name}" already exists for your account` }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to rename category' }, { status: 500 })
  }
}
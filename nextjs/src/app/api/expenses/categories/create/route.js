import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body = {}
  try { body = await request.json() } catch {}

  const { name, icon } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return NextResponse.json({ error: 'Name must be between 1 and 100 characters' }, { status: 400 })
  }

  const EMOJI_REGEX = /^(\p{Emoji}|\p{Emoji_Component})+$/u
  if (icon && (typeof icon !== 'string' || !EMOJI_REGEX.test(icon) || icon.length > 2)) {
    return NextResponse.json({ error: 'Icon must be a single emoji character' }, { status: 400 })
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO public.categories (user_id, name, icon)
       VALUES ($1, $2, $3)
       RETURNING id, name, icon, created_at`,
      [user.id, name.trim(), icon || null]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
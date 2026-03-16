import { NextResponse } from 'next/server'
import db from '@/lib/db'
import { authenticate } from '@/lib/auth'

export async function GET(request) {
  const { error } = await authenticate(request)
  if (error) return error
  try {
    const { rows } = await db.query(`SELECT id, name, icon FROM public.income_sources ORDER BY name ASC`)
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch income categories' }, { status: 500 })
  }
}

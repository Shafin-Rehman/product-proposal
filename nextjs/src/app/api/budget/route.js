import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/auth'
import {
  evaluateThresholdForMonth,
  getMonthlyBudgetConfig,
  getOwnedOrGlobalCategoriesByIds,
  normalizeMonth,
  upsertCategoryBudgets,
  upsertMonthlyBudget,
} from '@/lib/budget'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  const month = normalizeMonth(new URL(request.url).searchParams.get('month'))
  if (!month) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })

  try {
    const budget = await getMonthlyBudgetConfig(user.id, month)
    return NextResponse.json(budget ?? null)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 })
  }
}

export async function POST(request) {
  const { user, error } = await authenticate(request)
  if (error) return error

  let body = {}
  try { body = await request.json() } catch {}

  const month = normalizeMonth(body.month)
  const monthlyLimit = body.monthly_limit
  const categoryBudgets = body.category_budgets

  if (!month) return NextResponse.json({ error: 'Valid month is required' }, { status: 400 })

  if (monthlyLimit !== undefined && (monthlyLimit == null || Number.isNaN(Number(monthlyLimit)) || Number(monthlyLimit) <= 0)) {
    return NextResponse.json({ error: 'monthly_limit must be greater than 0' }, { status: 400 })
  }

  if (categoryBudgets !== undefined && !Array.isArray(categoryBudgets)) {
    return NextResponse.json({ error: 'category_budgets must be an array' }, { status: 400 })
  }

  const normalizedCategoryBudgets = (categoryBudgets ?? []).map((item) => ({
    category_id: item?.category_id,
    monthly_limit: item?.monthly_limit,
  }))

  if (monthlyLimit === undefined && !normalizedCategoryBudgets.length) {
    return NextResponse.json({ error: 'monthly_limit or category_budgets is required' }, { status: 400 })
  }

  if (normalizedCategoryBudgets.some((item) => !item.category_id)) {
    return NextResponse.json({ error: 'Each category budget requires a category_id' }, { status: 400 })
  }

  if (normalizedCategoryBudgets.some((item) => typeof item.category_id !== 'string' || !UUID_PATTERN.test(item.category_id))) {
    return NextResponse.json({ error: 'Each category budget requires a valid UUID category_id' }, { status: 400 })
  }

  if (normalizedCategoryBudgets.some((item) => item.monthly_limit == null || Number.isNaN(Number(item.monthly_limit)) || Number(item.monthly_limit) <= 0)) {
    return NextResponse.json({ error: 'Each category budget monthly_limit must be greater than 0' }, { status: 400 })
  }

  const categoryIds = normalizedCategoryBudgets.map((item) => item.category_id)
  if (new Set(categoryIds).size !== categoryIds.length) {
    return NextResponse.json({ error: 'category_budgets cannot contain duplicate category_id values' }, { status: 400 })
  }

  try {
    if (categoryIds.length) {
      const validCategories = await getOwnedOrGlobalCategoriesByIds(user.id, categoryIds)
      if (validCategories.length !== categoryIds.length) {
        return NextResponse.json({ error: 'category_budgets contain invalid categories' }, { status: 400 })
      }
    }

    if (monthlyLimit !== undefined) {
      await upsertMonthlyBudget(user.id, month, monthlyLimit)
    }

    if (normalizedCategoryBudgets.length) {
      await upsertCategoryBudgets(
        user.id,
        month,
        normalizedCategoryBudgets.map((item) => ({
          category_id: item.category_id,
          monthly_limit: Number(item.monthly_limit),
        }))
      )
    }

    const updatedBudget = monthlyLimit !== undefined
      ? await evaluateThresholdForMonth(user.id, month)
      : null
    const savedBudget = await getMonthlyBudgetConfig(user.id, month)

    return NextResponse.json({
      month: savedBudget?.month ?? month,
      monthly_limit: savedBudget?.monthly_limit ?? null,
      notified: updatedBudget?.notified ?? savedBudget?.notified ?? false,
      budget_alert: updatedBudget?.budget_alert ?? null,
      category_budgets: savedBudget?.category_budgets ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

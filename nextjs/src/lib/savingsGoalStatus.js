import { formatCurrency } from '@/lib/financeUtils'

export function getSavingsGoalStatusLabel(status) {
  if (status === 'complete') return 'Complete'
  if (status === 'overdue') return 'Overdue'
  if (status === 'over_budget') return 'Over budget'
  if (status === 'tight') return 'Watch'
  if (status === 'no_budget') return 'No budget'
  return 'On track'
}

export function getSavingsGoalStatusTone(status) {
  if (status === 'complete' || status === 'ready') return 'positive'
  if (status === 'tight' || status === 'no_budget') return 'warning'
  if (status === 'over_budget' || status === 'overdue') return 'danger'
  return 'neutral'
}

export function getSavingsGoalAvatar(goal, { semanticFallbacks = false } = {}) {
  if (goal?.icon) return goal.icon

  if (semanticFallbacks) {
    const name = String(goal?.name ?? '').toLowerCase()
    if (name.includes('emergency')) return 'EF'
    if (name.includes('trip') || name.includes('travel')) return 'TR'
    if (name.includes('car')) return 'CA'
    if (name.includes('home') || name.includes('rent')) return 'HM'
    if (name.includes('laptop') || name.includes('computer')) return 'LT'
  }

  const words = String(goal?.name ?? '').trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || 'SG').toUpperCase()
}

export function getSavingsGoalStatusReason(goal) {
  const status = goal?.budget_context?.status ?? 'ready'
  const remaining = Number(goal?.remaining_amount ?? 0)
  const monthlyRequired = Number(goal?.monthly_required ?? 0)
  const rawRemainingBudget = goal?.budget_context?.remaining_budget
  const hasRemainingBudget = rawRemainingBudget != null && String(rawRemainingBudget).trim() !== ''
  const remainingBudget = Number(rawRemainingBudget)

  if (status === 'complete') return 'Saved amount reached the target.'
  if (status === 'overdue') return `Target date passed with ${formatCurrency(remaining)} left.`
  if (status === 'over_budget') {
    if (hasRemainingBudget && Number.isFinite(remainingBudget)) {
      return `Needs ${formatCurrency(monthlyRequired)}/month but only ${formatCurrency(remainingBudget)} remains.`
    }
    return `Needs ${formatCurrency(monthlyRequired)}/month without a clear remaining budget.`
  }
  if (status === 'tight') return `Needs ${formatCurrency(monthlyRequired)}/month, leaving little room in budget.`
  if (status === 'no_budget') return 'No monthly budget is set yet.'
  return monthlyRequired > 0
    ? 'Monthly need fits your remaining budget.'
    : 'No monthly contribution needed right now.'
}

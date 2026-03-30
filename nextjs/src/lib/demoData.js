export const DEMO_MONTH = '2026-03-01'

export const demoBudgetSummary = {
  month: DEMO_MONTH,
  monthly_limit: '2600.00',
  total_income: '3229.00',
  total_expenses: '1011.36',
  remaining_budget: '1588.64',
  threshold_exceeded: false,
  notified: false,
}

export const demoBudgetTrend = [
  118, 164, 214, 278, 332, 401, 458, 533, 594, 668, 731, 812, 901, 963, 1011.36,
]

export const demoCategoryBudgets = [
  { id: 'shopping', name: 'Shopping', shortLabel: 'SH', spent: 347, budget: 500, color: '#cc8da4' },
  { id: 'groceries', name: 'Groceries', shortLabel: 'GR', spent: 289, budget: 360, color: '#7ab592' },
  { id: 'dining', name: 'Dining', shortLabel: 'DN', spent: 193.53, budget: 300, color: '#d29e4a' },
  { id: 'fun', name: 'Fun', shortLabel: 'FN', spent: 94.56, budget: 180, color: '#8a85ca' },
  { id: 'travel', name: 'Travel', shortLabel: 'TR', spent: 87.27, budget: 140, color: '#79b5c7' },
]

export const demoActivity = [
  {
    id: 'demo-exp-1',
    kind: 'expense',
    title: 'Target run',
    chip: 'Shopping',
    amount: 80,
    occurredOn: '2026-03-29',
    note: 'Dorm essentials',
    merchant: 'Target',
    accent: '#cc8da4',
  },
  {
    id: 'demo-exp-2',
    kind: 'expense',
    title: 'Whole Foods',
    chip: 'Groceries',
    amount: 145.32,
    occurredOn: '2026-03-29',
    note: 'Weekly groceries',
    merchant: 'Whole Foods',
    accent: '#7ab592',
  },
  {
    id: 'demo-inc-1',
    kind: 'income',
    title: 'Campus job deposit',
    chip: 'Income',
    amount: 3200,
    occurredOn: '2026-03-28',
    note: 'Student assistant stipend',
    merchant: 'Campus payroll',
    accent: '#7ab592',
  },
  {
    id: 'demo-exp-3',
    kind: 'expense',
    title: 'Juice Press',
    chip: 'Dining',
    amount: 16,
    occurredOn: '2026-03-28',
    note: 'Quick lunch',
    merchant: 'Juice Press',
    accent: '#d9a15b',
  },
  {
    id: 'demo-exp-4',
    kind: 'expense',
    title: 'Movie night',
    chip: 'Fun',
    amount: 14.56,
    occurredOn: '2026-03-28',
    note: 'Streaming add-on',
    merchant: 'Friday rental',
    accent: '#8a85ca',
  },
  {
    id: 'demo-exp-5',
    kind: 'expense',
    title: 'Weekend subway',
    chip: 'Travel',
    amount: 23.45,
    occurredOn: '2026-03-24',
    note: 'Late-night ride',
    merchant: 'MetroCard',
    accent: '#79b5c7',
  },
  {
    id: 'demo-exp-6',
    kind: 'expense',
    title: "Trader Joe's",
    chip: 'Groceries',
    amount: 89.5,
    occurredOn: '2026-03-21',
    note: 'Produce refill',
    merchant: 'Trader Joe\'s',
    accent: '#7ab592',
  },
  {
    id: 'demo-exp-7',
    kind: 'expense',
    title: 'Amazon restock',
    chip: 'Shopping',
    amount: 147,
    occurredOn: '2026-03-22',
    note: 'Desk and study gear',
    merchant: 'Amazon',
    accent: '#cc8da4',
  },
  {
    id: 'demo-exp-8',
    kind: 'expense',
    title: 'Five Guys',
    chip: 'Dining',
    amount: 18.5,
    occurredOn: '2026-03-18',
    note: 'Dinner after class',
    merchant: 'Five Guys',
    accent: '#d9a15b',
  },
  {
    id: 'demo-inc-2',
    kind: 'income',
    title: 'Monica sent rent share',
    chip: 'Transfer',
    amount: 29,
    occurredOn: '2026-03-26',
    note: 'Shared utilities',
    merchant: 'Zelle transfer',
    accent: '#79b5c7',
  },
]

export const demoRecurringCharges = [
  { id: 'recur-1', title: 'Spotify', amount: 11.99, dueLabel: 'Apr 2' },
  { id: 'recur-2', title: 'Phone plan', amount: 36.0, dueLabel: 'Apr 7' },
  { id: 'recur-3', title: 'Cloud storage', amount: 2.99, dueLabel: 'Apr 11' },
]

export const demoIncomeSources = [
  { id: 'demo-source-1', name: 'Campus job', amount: 3200, color: '#7ab592' },
  { id: 'demo-source-2', name: 'Transfers', amount: 29, color: '#79b5c7' },
]

export const demoComparisons = {
  previousMonthExpenses: 934.18,
  currentMonthExpenses: 1011.36,
  projectedMonthEnd: 1498.42,
}

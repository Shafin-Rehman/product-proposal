/**
 * Category and income-source presentation. Built-in names match DB seed
 * (see supabase/migrations). Visuals (icon/color) are stable per name; server
 * `icon` still overrides the symbol when present.
 *
 * Food vs Groceries/Dining: the DB still ships a single "Food" category. We keep
 * that identity (no relabeling persisted names) but reserve distinct built-in
 * keys so Groceries/Dining can be added later without reworking this module.
 */
const VISUAL_MATCHERS = [
  {
    kind: 'expense',
    label: 'Groceries',
    keywords: ['grocer', 'grocery', 'groceries', 'whole foods', "trader joe", 'supermarket', 'produce', 'pantry', 'costco', 'aldi'],
    symbol: '\u{1F6D2}',
    color: '#4d9a6a',
  },
  {
    kind: 'expense',
    label: 'Dining',
    // Intentionally omit the bare word "food" so the built-in "Food" category
    // does not match Dining heuristics (Issue #58).
    keywords: ['dining', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'meal', 'takeout', 'ubereats', 'doordash', 'chipotle', 'sweetgreen', 'five guys', 'juice press', 'starbucks'],
    symbol: '\u{1F37D}\uFE0F',
    color: '#c97d2e',
  },
  {
    kind: 'expense',
    label: 'Shopping',
    keywords: ['shop', 'shopping', 'retail', 'target', 'amazon', 'apple', 'store', 'mall', 'boutique', 'order'],
    symbol: '\u{1F6CD}\uFE0F',
    color: '#c45d7a',
  },
  {
    kind: 'expense',
    label: 'Travel',
    keywords: ['uber', 'lyft', 'taxi', 'rideshare', 'ride share', 'parking', 'gas'],
    symbol: '\u{1F697}',
    color: '#3a8ba8',
  },
  {
    kind: 'expense',
    label: 'Travel',
    keywords: ['train', 'metro', 'subway', 'rail', 'amtrak', 'transit', 'commute'],
    symbol: '\u{1F687}',
    color: '#3a8ba8',
  },
  {
    kind: 'expense',
    label: 'Travel',
    keywords: ['travel', 'trip', 'flight', 'airline', 'hotel', 'airbnb', 'vacation'],
    symbol: '\u2708\uFE0F',
    color: '#3a8ba8',
  },
  {
    label: 'Transfer',
    keywords: ['transfer', 'zelle', 'venmo', 'cash app', 'paypal'],
    symbol: '\u{1F501}',
    color: '#4a8fbf',
  },
  {
    kind: 'income',
    label: 'Income',
    keywords: ['salary', 'income', 'payroll', 'deposit', 'stipend', 'job', 'paycheck', 'pay day', 'payday'],
    symbol: '\u{1F4B8}',
    color: '#2f8f55',
  },
  {
    kind: 'expense',
    label: 'Housing',
    keywords: ['rent', 'housing', 'home', 'apartment', 'mortgage'],
    symbol: '\u{1F3E0}',
    color: '#b87555',
  },
  {
    kind: 'expense',
    label: 'Fun',
    keywords: ['fun', 'entertain', 'movie', 'cinema', 'stream', 'spotify', 'netflix', 'hulu', 'game', 'gaming', 'concert', 'ticket', 'music', 'arcade'],
    symbol: '\u{1F3AE}',
    color: '#7a63c9',
  },
  {
    kind: 'expense',
    label: 'Health',
    keywords: ['gym', 'health', 'wellness', 'medical', 'doctor', 'pharmacy', 'fitness'],
    symbol: '\u2695\uFE0F',
    color: '#2e8a9a',
  },
  {
    kind: 'expense',
    label: 'Bills',
    keywords: ['bill', 'utility', 'subscription', 'phone', 'cloud', 'internet', 'electric', 'water'],
    symbol: '\u26A1',
    color: '#5c7eb8',
  },
]

/**
 * Shipped built-in expense categories (public.categories). Each has a unique primary color.
 * Icons align with the seed; when c.icon is null, these apply.
 * @type {Record<string, { symbol: string, color: string }>}
 */
export const BUILT_IN_EXPENSE_VISUALS = {
  Food: { symbol: '\u{1F354}', color: '#d4932f' },
  Transit: { symbol: '\u{1F68C}', color: '#008f9c' },
  Entertainment: { symbol: '\u{1F389}', color: '#8a4fd3' },
  Shopping: { symbol: '\u{1F6CD}\uFE0F', color: '#c94f7c' },
  Utilities: { symbol: '\u{1F4A1}', color: '#c7a018' },
  Health: { symbol: '\u{1F48A}', color: '#d94f45' },
  Education: { symbol: '\u{1F4DA}', color: '#3f6ed8' },
  Other: { symbol: '\u{1F4E6}', color: '#6d5a4a' },
}

/**
 * Shipped built-in income sources. Each has a unique primary color (not all the same green).
 * @type {Record<string, { symbol: string, color: string }>}
 */
export const BUILT_IN_INCOME_VISUALS = {
  Salary: { symbol: '\u{1F4BC}', color: '#2563eb' },
  Freelance: { symbol: '\u{1F4BB}', color: '#7c3aed' },
  'Part-time': { symbol: '\u23F1\uFE0F', color: '#d97706' },
  Business: { symbol: '\u{1F3E2}', color: '#0f766e' },
  Investment: { symbol: '\u{1F4C8}', color: '#16a34a' },
  Rental: { symbol: '\u{1F3E0}', color: '#be123c' },
  Gift: { symbol: '\u{1F381}', color: '#c026d3' },
  Refund: { symbol: '\u{1F9FE}', color: '#0891b2' },
  Transfer: { symbol: '\u{1F501}', color: '#475569' },
  Other: { symbol: '\u{1F4B0}', color: '#5f6b7a' },
}

/** @deprecated Use UNCATEGORIZED_EXPENSE_DB_LABEL — kept for tests referencing SQL COALESCE. */
export const UNCATEGORIZED_EXPENSE_LABEL = 'Uncategorized'

/** Matches SQL: COALESCE(c.name, 'Uncategorized') — internal/aggregation only. */
export const UNCATEGORIZED_EXPENSE_DB_LABEL = 'Uncategorized'

/** User-facing label for missing expense category. */
export const UNCATEGORIZED_EXPENSE_DISPLAY = 'Uncategorized'

export const UNKNOWN_INCOME_DISPLAY = 'No source'

export const UNCATEGORIZED_EXPENSE_SYMBOL = '\u{1F3F7}\uFE0F'
export const UNKNOWN_INCOME_SYMBOL = '\u{1F4CB}'

const UNCATEGORIZED_NEUTRAL_COLOR = '#8f9b95'
const UNKNOWN_INCOME_NEUTRAL_COLOR = '#5e7568'

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toSoftColor(color, opacity = 0.18) {
  const safe = color.replace('#', '')
  const chunks = safe.length === 3
    ? safe.split('').map((part) => `${part}${part}`)
    : safe.match(/.{1,2}/g)

  if (!chunks || chunks.length !== 3) return `rgba(122, 181, 146, ${opacity})`

  const [red, green, blue] = chunks.map((chunk) => parseInt(chunk, 16))
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

function nameKey(name) {
  return String(name || '').trim()
}

/**
 * True when the raw value is an uncategorized expense (empty, whitespace, or SQL/legacy label).
 */
export function isUncategorizedExpenseName(value) {
  const t = nameKey(value)
  if (!t) return true
  const l = t.toLowerCase()
  if (l === 'uncategorized') return true
  if (l === 'no cat') return true
  if (t === UNCATEGORIZED_EXPENSE_DISPLAY) return true
  return false
}

/**
 * No income source: empty/whitespace, or the explicit display chip "No source"
 * (persisted or legacy).
 */
export function isUnknownIncomeName(value) {
  const t = nameKey(value)
  if (!t) return true
  if (t === UNKNOWN_INCOME_DISPLAY) return true
  return false
}

function findVisualMatch(value, kind = 'expense') {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  return VISUAL_MATCHERS.find((item) => (!item.kind || item.kind === kind) && item.keywords.some((keyword) => normalized.includes(keyword)))
}

function builtinVisualForName(value, kind) {
  const key = nameKey(value)
  if (!key) return null
  if (kind === 'income') {
    return BUILT_IN_INCOME_VISUALS[key] ?? null
  }
  return BUILT_IN_EXPENSE_VISUALS[key] ?? null
}

export function getInitialsLabel(value, fallback = 'BB') {
  const parts = String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return fallback

  return parts.map((part) => part[0]?.toUpperCase() || '').join('')
}

/**
 * User-facing display label for a persisted category/source name (API / DB).
 * Does not apply keyword heuristics. Empty/unknown → short placeholders.
 * SQL may still return "Uncategorized" string — treated like missing.
 */
export function getCategoryLabel(value, kind = 'expense') {
  if (kind === 'expense') {
    if (isUncategorizedExpenseName(value)) return UNCATEGORIZED_EXPENSE_DISPLAY
    return nameKey(value)
  }
  if (isUnknownIncomeName(value)) return UNKNOWN_INCOME_DISPLAY
  return nameKey(value)
}

/**
 * @param value Persisted name for heuristics. Display `label` always comes from getCategoryLabel.
 */
export function getCategoryVisual(value, kind = 'expense') {
  const raw = value == null ? '' : String(value)
  const label = getCategoryLabel(raw, kind)
  const trimmed = nameKey(raw)

  if (kind === 'expense' && isUncategorizedExpenseName(raw)) {
    return {
      label,
      symbol: UNCATEGORIZED_EXPENSE_SYMBOL,
      color: UNCATEGORIZED_NEUTRAL_COLOR,
      soft: toSoftColor(UNCATEGORIZED_NEUTRAL_COLOR),
      initials: '–',
    }
  }

  if (kind === 'income' && isUnknownIncomeName(raw)) {
    return {
      label,
      symbol: UNKNOWN_INCOME_SYMBOL,
      color: UNKNOWN_INCOME_NEUTRAL_COLOR,
      soft: toSoftColor(UNKNOWN_INCOME_NEUTRAL_COLOR),
      initials: '–',
    }
  }

  const builtin = builtinVisualForName(raw, kind)
  if (builtin) {
    return {
      label,
      symbol: builtin.symbol,
      color: builtin.color,
      soft: toSoftColor(builtin.color),
      initials: getInitialsLabel(trimmed, kind === 'income' ? 'IN' : 'TX'),
    }
  }

  const match = findVisualMatch(trimmed || label, kind)
  if (match) {
    return {
      label,
      symbol: match.symbol,
      color: match.color,
      soft: toSoftColor(match.color),
      initials: getInitialsLabel(trimmed, kind === 'income' ? 'IN' : 'TX'),
    }
  }

  const fallbackColor = kind === 'income' ? '#1f7a45' : '#7d8c84'
  return {
    label,
    symbol: getInitialsLabel(trimmed, kind === 'income' ? 'IN' : 'TX'),
    color: fallbackColor,
    soft: toSoftColor(fallbackColor),
    initials: getInitialsLabel(trimmed, kind === 'income' ? 'IN' : 'TX'),
  }
}

/**
 * Heuristic keyword map applies to visuals (color/symbol) only, not to renaming persisted names.
 * Server `icon` overrides built-in or heuristic `symbol` when present.
 */
export function getCategoryPresentation({ name, icon, kind = 'expense' } = {}) {
  const raw = name == null ? '' : String(name)
  const base = getCategoryVisual(raw, kind)
  return {
    label: base.label,
    symbol: icon || base.symbol,
    color: base.color,
    soft: base.soft,
    initials: base.initials,
  }
}

export function getEntryVisual(entry) {
  const kind = entry?.kind
  if (entry?.chip) {
    const serverIcon = kind === 'income' ? entry?.sourceIcon : entry?.categoryIcon
    return getCategoryPresentation({ name: entry.chip, icon: serverIcon, kind })
  }

  if (entry?.categoryName) {
    return getCategoryPresentation({
      name: entry.categoryName,
      icon: kind === 'income' ? entry?.sourceIcon : entry?.categoryIcon,
      kind,
    })
  }

  return getCategoryVisual(
    [entry?.chip, entry?.merchant, entry?.title, entry?.note].filter(Boolean).join(' '),
    kind,
  )
}

/**
 * Jest: every built-in expense key must have a unique primary color.
 * @returns {{ expense: string[], income: string[] }}
 */
export function getBuiltInColorCollisions() {
  const ex = Object.values(BUILT_IN_EXPENSE_VISUALS).map((v) => v.color)
  const inc = Object.values(BUILT_IN_INCOME_VISUALS).map((v) => v.color)
  const dup = (arr) => {
    const seen = new Set()
    const d = []
    arr.forEach((c) => {
      if (seen.has(c)) d.push(c)
      seen.add(c)
    })
    return d
  }
  return { expense: dup(ex), income: dup(inc) }
}

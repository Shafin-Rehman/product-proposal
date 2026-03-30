const VISUAL_MATCHERS = [
  {
    kind: 'expense',
    label: 'Groceries',
    keywords: ['grocer', 'grocery', 'groceries', 'whole foods', "trader joe", 'supermarket', 'produce', 'pantry', 'costco', 'aldi'],
    symbol: '\u{1F6D2}',
    color: '#6faa80',
  },
  {
    kind: 'expense',
    label: 'Dining',
    keywords: ['dining', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'meal', 'takeout', 'ubereats', 'doordash', 'chipotle', 'sweetgreen', 'five guys', 'juice press', 'starbucks', 'food'],
    symbol: '\u{1F37D}\uFE0F',
    color: '#d29e4a',
  },
  {
    kind: 'expense',
    label: 'Shopping',
    keywords: ['shop', 'shopping', 'retail', 'target', 'amazon', 'apple', 'store', 'mall', 'boutique', 'order'],
    symbol: '\u{1F6CD}\uFE0F',
    color: '#c9869e',
  },
  {
    kind: 'expense',
    label: 'Travel',
    keywords: ['uber', 'lyft', 'taxi', 'rideshare', 'ride share', 'parking', 'gas'],
    symbol: '\u{1F697}',
    color: '#62a9b7',
  },
  {
    kind: 'expense',
    label: 'Travel',
    keywords: ['train', 'metro', 'subway', 'rail', 'amtrak', 'transit', 'commute'],
    symbol: '\u{1F687}',
    color: '#62a9b7',
  },
  {
    kind: 'expense',
    label: 'Travel',
    keywords: ['travel', 'trip', 'flight', 'airline', 'hotel', 'airbnb', 'vacation'],
    symbol: '\u2708\uFE0F',
    color: '#62a9b7',
  },
  {
    label: 'Transfer',
    keywords: ['transfer', 'zelle', 'venmo', 'cash app', 'paypal'],
    symbol: '\u{1F501}',
    color: '#63a6cf',
  },
  {
    kind: 'income',
    label: 'Income',
    keywords: ['salary', 'income', 'payroll', 'deposit', 'stipend', 'job', 'paycheck', 'pay day', 'payday'],
    symbol: '\u{1F4B8}',
    color: '#77b68d',
  },
  {
    kind: 'expense',
    label: 'Housing',
    keywords: ['rent', 'housing', 'home', 'apartment', 'mortgage'],
    symbol: '\u{1F3E0}',
    color: '#cb8c67',
  },
  {
    kind: 'expense',
    label: 'Fun',
    keywords: ['fun', 'entertain', 'movie', 'cinema', 'stream', 'spotify', 'netflix', 'hulu', 'game', 'gaming', 'concert', 'ticket', 'music', 'arcade'],
    symbol: '\u{1F3AE}',
    color: '#8d7fd1',
  },
  {
    kind: 'expense',
    label: 'Health',
    keywords: ['gym', 'health', 'wellness', 'medical', 'doctor', 'pharmacy', 'fitness'],
    symbol: '\u2695\uFE0F',
    color: '#63a6cf',
  },
  {
    kind: 'expense',
    label: 'Bills',
    keywords: ['bill', 'utility', 'subscription', 'phone', 'cloud', 'internet', 'electric', 'water'],
    symbol: '\u26A1',
    color: '#7f93bf',
  },
]

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

function toDisplayLabel(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (!cleaned) return fallback

  return cleaned.replace(/\b([a-z])/gi, (match) => match.toUpperCase())
}

function findVisualMatch(value, kind = 'expense') {
  const normalized = normalizeValue(value)
  if (!normalized) return null

  return VISUAL_MATCHERS.find((item) => (!item.kind || item.kind === kind) && item.keywords.some((keyword) => normalized.includes(keyword)))
}

export function getInitialsLabel(value, fallback = 'BB') {
  const parts = String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return fallback

  return parts.map((part) => part[0]?.toUpperCase() || '').join('')
}

export function getCategoryLabel(value, kind = 'expense') {
  const match = findVisualMatch(value, kind)
  if (match?.label) return match.label

  return toDisplayLabel(value, kind === 'income' ? 'Income' : 'Uncategorized')
}

export function getCategoryVisual(value, kind = 'expense') {
  const label = getCategoryLabel(value, kind)
  const match = findVisualMatch(value || label, kind)

  if (match) {
    return {
      ...match,
      label,
      soft: toSoftColor(match.color),
      initials: getInitialsLabel(label, kind === 'income' ? 'IN' : 'TX'),
    }
  }

  const fallbackColor = kind === 'income' ? '#77b68d' : '#9ba7a0'
  return {
    label,
    symbol: getInitialsLabel(label, kind === 'income' ? 'IN' : 'TX'),
    color: fallbackColor,
    soft: toSoftColor(fallbackColor),
    initials: getInitialsLabel(label, kind === 'income' ? 'IN' : 'TX'),
  }
}

export function getEntryVisual(entry) {
  return getCategoryVisual(
    [entry?.chip, entry?.merchant, entry?.title, entry?.note].filter(Boolean).join(' '),
    entry?.kind
  )
}

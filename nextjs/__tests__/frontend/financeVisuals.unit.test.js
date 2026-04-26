const {
  BUILT_IN_EXPENSE_VISUALS,
  BUILT_IN_INCOME_VISUALS,
  getInitialsLabel,
  getCategoryLabel,
  getCategoryVisual,
  getCategoryPresentation,
  isUncategorizedExpenseName,
  UNCATEGORIZED_EXPENSE_DISPLAY,
  UNCATEGORIZED_EXPENSE_SYMBOL,
  UNKNOWN_INCOME_DISPLAY,
  getBuiltInColorCollisions,
  getEntryVisual,
} = require('@/lib/financeVisuals')

describe('getInitialsLabel', () => {
  it('returns up to two uppercase initials from a name', () => {
    expect(getInitialsLabel('john doe')).toBe('JD')
    expect(getInitialsLabel('alice')).toBe('A')
  })
})

describe('getCategoryLabel', () => {
  it('preserves persisted category names and does not apply keyword renames (e.g. Food → Dining)', () => {
    expect(getCategoryLabel('Food', 'expense')).toBe('Food')
    expect(getCategoryLabel('Dining', 'expense')).toBe('Dining')
  })

  it('uses a clear uncategorized display label for empty expense strings', () => {
    expect(getCategoryLabel('', 'expense')).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    expect(getCategoryLabel('   ', 'expense')).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    expect(getCategoryLabel('', 'expense')).toBe('Uncategorized')
  })

  it('treats null, SQL labels, and old compact fallback values as uncategorized', () => {
    expect(isUncategorizedExpenseName(null)).toBe(true)
    expect(isUncategorizedExpenseName('')).toBe(true)
    expect(isUncategorizedExpenseName('Uncategorized')).toBe(true)
    expect(isUncategorizedExpenseName('No cat')).toBe(true)
  })

  it('uses no-source display for empty income, not a fake source name', () => {
    expect(getCategoryLabel('', 'income')).toBe(UNKNOWN_INCOME_DISPLAY)
  })
})

describe('getCategoryVisual', () => {
  it('returns an object with the expected shape', () => {
    const visual = getCategoryVisual('grocery store', 'expense')
    expect(visual).toHaveProperty('label')
    expect(visual).toHaveProperty('symbol')
    expect(visual).toHaveProperty('color')
    expect(visual).toHaveProperty('soft')
  })

  it('keeps the persisted label on the name while heuristics still affect color for keyword matches', () => {
    const visual = getCategoryVisual('grocery store', 'expense')
    expect(visual.label).toBe('grocery store')
    expect(visual.color).toBe('#4d9a6a')
  })
})

describe('getCategoryPresentation', () => {
  it('returns label "Food" for the Food / Dining heuristic collision regression', () => {
    const presentation = getCategoryPresentation({ name: 'Food', kind: 'expense' })
    expect(presentation.label).toBe('Food')
    expect(presentation.color).toBe(BUILT_IN_EXPENSE_VISUALS.Food.color)
    expect(presentation.symbol).toBe(BUILT_IN_EXPENSE_VISUALS.Food.symbol)
  })

  it('matches the uncategorized display label for a missing expense name', () => {
    const presentation = getCategoryPresentation({ name: null, kind: 'expense' })
    expect(presentation.label).toBe(UNCATEGORIZED_EXPENSE_DISPLAY)
    expect(presentation.symbol).toBe(UNCATEGORIZED_EXPENSE_SYMBOL)
  })

  it('uses the server icon when provided (overrides built-in or heuristic symbol, not id)', () => {
    const presentation = getCategoryPresentation({ name: 'Dining', icon: '🧾', kind: 'expense' })
    expect(presentation.symbol).toBe('🧾')
  })

  it('aligns display label with getCategoryLabel and does not rename "grocery run"', () => {
    const presentation = getCategoryPresentation({ name: 'grocery run', kind: 'expense' })
    expect(presentation.label).toBe('grocery run')
    expect(presentation.label).toBe(getCategoryLabel('grocery run', 'expense'))
  })

  it('gives built-in seed categories a stable icon+color (Utilities vs merchant initials)', () => {
    const p = getCategoryPresentation({ name: 'Utilities', icon: '💡', kind: 'expense' })
    expect(p.label).toBe('Utilities')
    expect(p.symbol).toBe('💡')
    expect(p.color).toBe(BUILT_IN_EXPENSE_VISUALS.Utilities.color)
  })

  it('uses one Transit bus icon for the Transit category, not a mixed train default', () => {
    const p = getCategoryPresentation({ name: 'Transit', kind: 'expense' })
    expect(p.symbol).toBe(BUILT_IN_EXPENSE_VISUALS.Transit.symbol)
  })
})

describe('built-in color uniqueness (Issue #58)', () => {
  function hexDistance(left, right) {
    const parse = (hex) => {
      const value = hex.replace('#', '')
      return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16))
    }
    const [lr, lg, lb] = parse(left)
    const [rr, rg, rb] = parse(right)
    return Math.sqrt(((lr - rr) ** 2) + ((lg - rg) ** 2) + ((lb - rb) ** 2))
  }

  it('has no duplicate primary colors among shipped expense and income built-ins', () => {
    const { expense, income } = getBuiltInColorCollisions()
    expect(expense).toEqual([])
    expect(income).toEqual([])
  })

  it('keeps a unique hex for every built-in expense and income name', () => {
    const ex = Object.values(BUILT_IN_EXPENSE_VISUALS)
    const inc = Object.values(BUILT_IN_INCOME_VISUALS)
    expect(new Set(ex.map((v) => v.color)).size).toBe(ex.length)
    expect(new Set(inc.map((v) => v.color)).size).toBe(inc.length)
  })

  it('keeps manually flagged color families visibly distinct', () => {
    expect(hexDistance(BUILT_IN_EXPENSE_VISUALS.Education.color, BUILT_IN_EXPENSE_VISUALS.Transit.color)).toBeGreaterThan(90)

    const incomeColors = BUILT_IN_INCOME_VISUALS
    expect(hexDistance(incomeColors.Salary.color, incomeColors.Rental.color)).toBeGreaterThan(100)
    expect(hexDistance(incomeColors.Salary.color, incomeColors['Part-time'].color)).toBeGreaterThan(100)
    expect(hexDistance(incomeColors.Rental.color, incomeColors['Part-time'].color)).toBeGreaterThan(100)
    expect(hexDistance(incomeColors.Freelance.color, incomeColors.Salary.color)).toBeGreaterThan(80)
  })
})

describe('getEntryVisual', () => {
  it('derives a visual from a standard entry', () => {
    const entry = { chip: 'Dining', merchant: 'Starbucks', title: 'Coffee', kind: 'expense' }
    const visual = getEntryVisual(entry)
    expect(visual.label).toBe('Dining')
    expect(visual).toHaveProperty('color')
  })

  it('uses categoryIcon for expenses and sourceIcon for income', () => {
    const expenseV = getEntryVisual({
      chip: 'Food',
      kind: 'expense',
      categoryIcon: '🥘',
    })
    expect(expenseV.label).toBe('Food')
    expect(expenseV.symbol).toBe('🥘')

    const incomeV = getEntryVisual({
      chip: 'Payroll',
      kind: 'income',
      sourceIcon: '💵',
    })
    expect(incomeV.symbol).toBe('💵')
  })
})

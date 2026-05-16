const demo = require('@/lib/demoData')

describe('demoData specification', () => {
  describe('demoData fixtures', () => {
    it('pins the demo month to a stable ISO month start', () => {
      expect(demo.DEMO_MONTH).toBe('2026-03-01')
    })

    it('ships a budget summary aligned with the demo month', () => {
      expect(demo.demoBudgetSummary.month).toBe(demo.DEMO_MONTH)
      expect(Array.isArray(demo.demoBudgetSummary.category_statuses)).toBe(true)
      expect(demo.demoBudgetSummary.category_statuses.length).toBeGreaterThan(0)
    })

    it('exposes activity rows for the demo shell', () => {
      expect(Array.isArray(demo.demoActivity)).toBe(true)
      expect(demo.demoActivity[0]).toEqual(expect.objectContaining({ kind: expect.any(String) }))
    })

    it('keeps category card fixtures in sync with ids and labels', () => {
      expect(demo.demoCategoryBudgets.every((row) => row.id && row.name)).toBe(true)
    })
  })
})

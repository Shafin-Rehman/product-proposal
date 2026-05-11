/** @jest-environment jsdom */

const React = require('react')
const { render, screen, cleanup } = require('@testing-library/react')
const { default: BudgetHudMetrics } = require('@/components/ui/BudgetHudMetrics')

afterEach(() => {
  cleanup()
})

describe('BudgetHudMetrics', () => {
  it('renders nothing when no metrics are provided', () => {
    const { container } = render(React.createElement(BudgetHudMetrics, { metrics: [] }))
    expect(container.firstChild).toBeNull()
  })

  it('renders each metric with its label, value, and hint in order', () => {
    const metrics = [
      { label: 'Spent', value: '$450', hint: 'Current month' },
      { label: 'Days left', value: '11', hint: 'Including today' },
      { label: 'Daily allowance', value: '$50', hint: 'Left per day' },
      { label: 'Net this month', value: '$750', hint: 'Income minus spend' },
    ]

    render(React.createElement(BudgetHudMetrics, { metrics }))

    const items = screen.getAllByRole('term')
    expect(items.map((node) => node.textContent)).toEqual(['Spent', 'Days left', 'Daily allowance', 'Net this month'])
    expect(screen.getByText('$450')).toBeTruthy()
    expect(screen.getByText('Current month')).toBeTruthy()
    expect(screen.getByText('Income minus spend')).toBeTruthy()
  })

  it('omits the hint row when hint is not provided', () => {
    render(React.createElement(BudgetHudMetrics, {
      metrics: [{ label: 'Spent', value: '--' }],
    }))

    expect(screen.getByText('Spent')).toBeTruthy()
    expect(screen.getByText('--')).toBeTruthy()
    expect(document.querySelector('.budget-hud-metrics__hint')).toBeNull()
  })
})

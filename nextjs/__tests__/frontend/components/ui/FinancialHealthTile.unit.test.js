/** @jest-environment jsdom */

jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return '--'
    return `$${amount.toFixed(2)}`
  }),
}))

const React = require('react')
const { render, screen, cleanup } = require('@testing-library/react')
const { default: FinancialHealthTile } = require('@/components/ui/FinancialHealthTile')

afterEach(() => {
  cleanup()
})

describe('FinancialHealthTile', () => {
  it('renders nothing when no health is provided', () => {
    const { container } = render(React.createElement(FinancialHealthTile, { health: null }))
    expect(container.firstChild).toBeNull()
  })

  it('renders the stacked bar, legend, and net value for a positive month', () => {
    render(React.createElement(FinancialHealthTile, {
      health: {
        key: 'positive_cash_flow',
        label: 'Positive cash flow',
        tone: 'positive',
        valueText: '$750 ahead',
        detailText: 'Income exceeds expenses this month.',
      },
      income: 2400,
      expenses: 820,
    }))

    expect(screen.getByText('Positive cash flow')).toBeTruthy()
    expect(screen.getByText('$2400.00')).toBeTruthy()
    expect(screen.getByText('$820.00')).toBeTruthy()
    expect(screen.getByText('$750 ahead')).toBeTruthy()
    expect(document.querySelector('.health-tile__segment--income')).toBeTruthy()
    expect(document.querySelector('.health-tile__segment--expense')).toBeTruthy()
  })

  it('shows the detail-text placeholder when the month has no income or expenses yet', () => {
    render(React.createElement(FinancialHealthTile, {
      health: {
        key: 'break_even',
        label: 'Break even',
        tone: 'neutral',
        valueText: '$0.00',
        detailText: 'Income matches expenses this month.',
      },
      income: 0,
      expenses: 0,
    }))

    expect(screen.getByText('Income matches expenses this month.')).toBeTruthy()
    expect(document.querySelector('.health-tile__segment--income')).toBeNull()
  })

  it('renders a placeholder when the health is loading or unavailable', () => {
    render(React.createElement(FinancialHealthTile, {
      health: {
        key: 'unavailable',
        label: 'Unavailable',
        tone: 'neutral',
        valueText: 'Health unavailable',
        detailText: 'Financial health is unavailable until the live summary returns.',
      },
      income: 1000,
      expenses: 500,
    }))

    expect(screen.getByText('Financial health is unavailable until the live summary returns.')).toBeTruthy()
    expect(document.querySelector('.health-tile__segment--income')).toBeNull()
  })
})

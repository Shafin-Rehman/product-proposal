/** @jest-environment jsdom */

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }) => require('react').createElement('a', { href, ...props }, children),
}))
jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return '--'
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''
    return `${sign}$${abs.toFixed(2)}`
  }),
  formatPercentage: jest.fn((value) => `${Math.round(Number(value) || 0)}%`),
}))

const React = require('react')
const { render, screen, fireEvent, cleanup } = require('@testing-library/react')
const { default: CashFlowSnapshot } = require('@/components/ui/CashFlowSnapshot')

afterEach(() => {
  cleanup()
})

describe('CashFlowSnapshot', () => {
  it('renders income, expense, and net for a positive month', () => {
    render(React.createElement(CashFlowSnapshot, {
      income: 2400,
      expenses: 820,
      trend: [],
      monthLabel: 'March 2026',
    }))

    expect(screen.getByText('March 2026')).toBeTruthy()
    expect(screen.getByText('$2400.00')).toBeTruthy()
    expect(screen.getByText('$820.00')).toBeTruthy()
    expect(screen.getByText('+$1580.00')).toBeTruthy()
    expect(document.querySelector('.cashflow-snapshot--positive')).toBeTruthy()
  })

  it('shows a negative net tone and no plus sign when expenses exceed income', () => {
    render(React.createElement(CashFlowSnapshot, {
      income: 400,
      expenses: 600,
    }))

    expect(document.querySelector('.cashflow-snapshot--danger')).toBeTruthy()
    expect(screen.getByText('-$200.00')).toBeTruthy()
  })

  it('renders an empty placeholder when there is no month data', () => {
    render(React.createElement(CashFlowSnapshot, {
      income: 0,
      expenses: 0,
    }))

    expect(screen.getByText(/income vs expense shape will appear/i)).toBeTruthy()
  })

  it('renders one focusable trend button per month and shows the focused readout', () => {
    render(React.createElement(CashFlowSnapshot, {
      income: 3000,
      expenses: 1500,
      trend: [
        { month: '2026-01-01', label: 'Jan', netAmount: 500 },
        { month: '2026-02-01', label: 'Feb', netAmount: -200 },
        { month: '2026-03-01', label: 'Mar', netAmount: 1500 },
      ],
    }))

    const buttons = document.querySelectorAll('.cashflow-snapshot__trend-col')
    expect(buttons.length).toBe(3)
    expect(screen.getByText(/Mar latest/)).toBeTruthy()

    fireEvent.focus(buttons[0])
    expect(screen.getByText('Jan selected')).toBeTruthy()
  })

  it('shows "--" for savings rate when there is no income', () => {
    render(React.createElement(CashFlowSnapshot, {
      income: 0,
      expenses: 300,
    }))

    expect(screen.getByText('--')).toBeTruthy()
  })

  it('renders a "View more" link to Insights when viewMoreHref is provided', () => {
    render(React.createElement(CashFlowSnapshot, {
      income: 1000,
      expenses: 400,
      viewMoreHref: '/insights',
    }))

    const link = screen.getByRole('link', { name: /View more/ })
    expect(link.getAttribute('href')).toBe('/insights')
  })
})

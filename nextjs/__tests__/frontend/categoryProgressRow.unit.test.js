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
const { default: CategoryProgressRow } = require('@/components/ui/CategoryProgressRow')

afterEach(() => {
  cleanup()
})

describe('CategoryProgressRow', () => {
  it('renders name, icon, and spent/budget text when a budget is provided', () => {
    render(React.createElement(CategoryProgressRow, {
      name: 'Groceries',
      symbol: 'G',
      amount: 120,
      monthlyLimit: 300,
      progressPercentage: 40,
      remainingAmount: 180,
      tone: 'positive',
      statusLabel: 'On track',
    }))

    expect(screen.getByText('Groceries')).toBeTruthy()
    expect(screen.getByText('G')).toBeTruthy()
    expect(screen.getByText('$120.00 / $300.00')).toBeTruthy()
    const bar = screen.getByRole('progressbar', { name: /Groceries budget progress/ })
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
  })

  it('hides the status chip on positive tones but shows it when tone is warning or danger', () => {
    const { rerender } = render(React.createElement(CategoryProgressRow, {
      name: 'Dining',
      symbol: 'D',
      amount: 240,
      monthlyLimit: 300,
      progressPercentage: 80,
      remainingAmount: 60,
      tone: 'positive',
      statusLabel: 'On track',
    }))

    expect(screen.queryByText('On track')).toBeNull()

    rerender(React.createElement(CategoryProgressRow, {
      name: 'Dining',
      symbol: 'D',
      amount: 260,
      monthlyLimit: 300,
      progressPercentage: 87,
      remainingAmount: 40,
      tone: 'warning',
      statusLabel: 'Near limit',
    }))

    expect(screen.getByText('Near limit')).toBeTruthy()

    rerender(React.createElement(CategoryProgressRow, {
      name: 'Dining',
      symbol: 'D',
      amount: 400,
      monthlyLimit: 300,
      progressPercentage: 100,
      remainingAmount: -100,
      tone: 'danger',
      statusLabel: 'Over budget',
    }))

    expect(screen.getByText('Over budget')).toBeTruthy()
  })

  it('applies the over-budget class when remainingAmount is negative', () => {
    const { container } = render(React.createElement(CategoryProgressRow, {
      name: 'Fun',
      symbol: 'F',
      amount: 420,
      monthlyLimit: 300,
      progressPercentage: 100,
      remainingAmount: -120,
      tone: 'danger',
      statusLabel: 'Over budget',
    }))

    expect(container.querySelector('.category-progress-row--over')).toBeTruthy()
  })

  it('falls back to spent-only text and share label when no budget is set', () => {
    render(React.createElement(CategoryProgressRow, {
      name: 'Transfers',
      symbol: 'T',
      amount: 50,
      monthlyLimit: null,
      progressPercentage: 35,
      tone: 'neutral',
      fallbackShareText: '35% of spend',
    }))

    expect(screen.getByText('Transfers')).toBeTruthy()
    expect(screen.getByText('$50.00')).toBeTruthy()
    expect(screen.getByText('35% of spend')).toBeTruthy()
    const bar = screen.getByRole('progressbar', { name: /Transfers share of spend/ })
    expect(bar.getAttribute('aria-valuenow')).toBe('35')
  })

  it('clamps progressPercentage to the 0-100 range', () => {
    render(React.createElement(CategoryProgressRow, {
      name: 'Shopping',
      symbol: 'S',
      amount: 999,
      monthlyLimit: 500,
      progressPercentage: 250,
      remainingAmount: -499,
      tone: 'danger',
    }))

    const bar = screen.getByRole('progressbar', { name: /Shopping budget progress/ })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
  })

  it('forces the chip to render when showStatusChip is always', () => {
    render(React.createElement(CategoryProgressRow, {
      name: 'Groceries',
      symbol: 'G',
      amount: 100,
      monthlyLimit: 400,
      progressPercentage: 25,
      remainingAmount: 300,
      tone: 'positive',
      statusLabel: 'On track',
      showStatusChip: 'always',
    }))

    expect(screen.getByText('On track')).toBeTruthy()
  })

  it('never renders the chip when showStatusChip is never', () => {
    render(React.createElement(CategoryProgressRow, {
      name: 'Groceries',
      symbol: 'G',
      amount: 400,
      monthlyLimit: 300,
      progressPercentage: 100,
      remainingAmount: -100,
      tone: 'danger',
      statusLabel: 'Over budget',
      showStatusChip: 'never',
    }))

    expect(screen.queryByText('Over budget')).toBeNull()
  })
})

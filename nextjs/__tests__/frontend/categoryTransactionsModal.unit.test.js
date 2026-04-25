/** @jest-environment jsdom */

jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return '--'
    return `$${amount.toFixed(2)}`
  }),
  formatShortDate: jest.fn((value) => `Short ${value}`),
}))

const React = require('react')
const { render, screen, fireEvent, cleanup } = require('@testing-library/react')
const { default: CategoryTransactionsModal } = require('@/components/ui/CategoryTransactionsModal')

const SAMPLE_CATEGORY = {
  id: 'shopping',
  name: 'Shopping',
  color: '#c9869e',
  soft: 'rgba(201,134,158,0.18)',
  symbol: 'S',
}

const CURRENT_DETAILS = [
  { id: 'tx-1', amount: 50, title: 'Target', categoryName: 'Shopping', occurredOn: '2026-03-12', color: '#c9869e', soft: 'rgba(201,134,158,0.18)', symbol: 'S' },
  { id: 'tx-2', amount: 130, title: 'Amazon', categoryName: 'Shopping', occurredOn: '2026-03-22', color: '#c9869e', soft: 'rgba(201,134,158,0.18)', symbol: 'S' },
  { id: 'tx-3', amount: 20, title: 'Whole Foods', categoryName: 'Groceries', occurredOn: '2026-03-15', color: '#6faa80', soft: 'rgba(111,170,128,0.18)', symbol: 'G' },
]

const PREVIOUS_DETAILS = [
  { id: 'prev-1', amount: 80, title: 'Amazon (Feb)', categoryName: 'Shopping', occurredOn: '2026-02-10', color: '#c9869e', soft: 'rgba(201,134,158,0.18)', symbol: 'S' },
]

afterEach(() => {
  cleanup()
})

describe('CategoryTransactionsModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(React.createElement(CategoryTransactionsModal, {
      isOpen: false,
      onClose: jest.fn(),
      category: SAMPLE_CATEGORY,
      currentMonthDetails: CURRENT_DETAILS,
    }))
    expect(container.querySelector('.category-modal')).toBeNull()
  })

  it('renders only this month transactions sorted largest first when previousMonthDetails is null', () => {
    render(React.createElement(CategoryTransactionsModal, {
      isOpen: true,
      onClose: jest.fn(),
      category: SAMPLE_CATEGORY,
      currentMonthDetails: CURRENT_DETAILS,
      currentMonthLabel: 'March 2026',
    }))

    const titles = Array.from(document.querySelectorAll('.category-modal__row strong'))
      .filter((node) => node.classList.contains('category-modal__row-amount') === false)
      .map((node) => node.textContent)
    expect(titles[0]).toBe('Amazon')
    expect(titles[1]).toBe('Target')
    expect(screen.queryByText('Whole Foods')).toBeNull()
    expect(screen.getAllByText('March 2026').length).toBeGreaterThan(0)
  })

  it('renders compare mode with both columns and a change tone when previousMonthDetails is provided', () => {
    render(React.createElement(CategoryTransactionsModal, {
      isOpen: true,
      onClose: jest.fn(),
      category: SAMPLE_CATEGORY,
      currentMonthDetails: CURRENT_DETAILS,
      previousMonthDetails: PREVIOUS_DETAILS,
      currentMonthLabel: 'March 2026',
      previousMonthLabel: 'February 2026',
    }))

    expect(screen.getAllByText('March 2026').length).toBeGreaterThan(0)
    expect(screen.getAllByText('February 2026').length).toBeGreaterThan(0)
    expect(screen.getByText('Amazon (Feb)')).toBeTruthy()
    expect(document.querySelector('.category-modal__totals-delta--danger')).toBeTruthy()
  })

  it('invokes onClose when backdrop or close button is clicked', () => {
    const onClose = jest.fn()
    render(React.createElement(CategoryTransactionsModal, {
      isOpen: true,
      onClose,
      category: SAMPLE_CATEGORY,
      currentMonthDetails: CURRENT_DETAILS,
      currentMonthLabel: 'March 2026',
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Close Shopping transactions/ }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

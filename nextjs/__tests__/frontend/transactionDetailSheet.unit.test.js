/** @jest-environment jsdom */

jest.mock('@/lib/financeVisuals', () => ({
  getEntryVisual: jest.fn((entry) => ({
    label: entry?.chip,
    color: '#102030',
    soft: '#aabbcc',
    symbol: '$',
  })),
}))

jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((value) => {
    const n = Number(value)
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00'
  }),
  formatLongDate: jest.fn((value) => `Long date ${value}`),
}))

const React = require('react')
const { render, screen, fireEvent, cleanup } = require('@testing-library/react')
const { default: TransactionDetailSheet } = require('@/components/ui/TransactionDetailSheet')

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
})

describe('TransactionDetailSheet', () => {
  it('renders nothing when entry is missing', () => {
    const { container } = render(React.createElement(TransactionDetailSheet, { onClose: jest.fn() }))
    expect(container.querySelector('.detail-overlay')).toBeNull()
  })

  it('invokes onClose from the header close button and the backdrop', () => {
    const onClose = jest.fn()
    render(React.createElement(TransactionDetailSheet, {
      onClose,
      entry: {
        kind: 'expense',
        title: 'Cafe',
        merchant: 'Cafe',
        occurredOn: '2026-03-12',
        amount: 4,
        chip: 'Dining',
        note: '',
      },
    }))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close transaction details' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('shows the merchant in the subtitle when it differs from the title', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'expense',
        title: 'Dining out',
        merchant: 'Cafe on Main',
        occurredOn: '2026-03-12',
        amount: 12.5,
        chip: 'Dining',
        note: 'Team lunch',
      },
    }))

    expect(screen.getByText('Cafe on Main')).toBeTruthy()
  })

  it('labels the chip as Category for an expense entry', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'expense',
        title: 'Cafe',
        merchant: 'Cafe',
        occurredOn: '2026-03-12',
        amount: 4,
        chip: 'Dining',
        note: '',
      },
    }))

    const categoryCell = screen.getByText('Category').parentElement
    expect(categoryCell.querySelector('strong').textContent).toBe('Dining')
  })

  it('shows the actual expense category in the prominent header pill', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'expense',
        title: 'Education',
        merchant: 'Education',
        occurredOn: '2026-03-12',
        amount: 4,
        chip: 'Education',
        note: '',
      },
    }))

    expect(document.querySelector('.detail-sheet__copy .entry-chip').textContent).toBe('Education')
    expect(screen.queryByText('Live expense')).toBeNull()
  })

  it('labels the chip as Source for an income entry', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'income',
        title: 'Payday',
        merchant: 'Acme',
        occurredOn: '2026-03-01',
        amount: 2500,
        chip: 'No source',
        note: '',
      },
    }))

    const sourceCell = screen.getByText('Source').parentElement
    expect(sourceCell.querySelector('strong').textContent).toBe('No source')
    expect(screen.queryByText('Category')).toBeNull()
  })

  it('shows the actual income source in the prominent header pill', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'income',
        title: 'Payday',
        merchant: 'Acme',
        occurredOn: '2026-03-01',
        amount: 2500,
        chip: 'Salary',
        note: '',
      },
    }))

    expect(document.querySelector('.detail-sheet__copy .entry-chip').textContent).toBe('Salary')
  })

  it('uses a long-form date in the subtitle when the merchant is not a separate display name', () => {
    const { formatLongDate } = require('@/lib/financeUtils')
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'expense',
        title: 'Small shop',
        merchant: 'Small shop',
        occurredOn: '2026-04-15',
        amount: 8,
        chip: 'Dining',
        note: 'Dining',
      },
    }))

    expect(formatLongDate).toHaveBeenCalled()
    expect(document.querySelector('.detail-sheet__subtitle').textContent).toBe('Long date 2026-04-15')
  })

  it('displays a distinct body note for expenses when the note is not the category chip', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'expense',
        title: 'Store',
        merchant: 'Store',
        occurredOn: '2026-01-20',
        amount: 19.99,
        chip: 'Shopping',
        note: 'Gift card for Alex',
      },
    }))

    const noteCell = screen.getByText('Note').parentElement
    expect(noteCell.querySelector('strong').textContent).toBe('Gift card for Alex')
  })

  it('shows a neutral income note and plus formatting for income', () => {
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'income',
        title: 'Payday',
        merchant: 'Acme',
        occurredOn: '2026-03-01',
        amount: 2500,
        chip: 'Salary',
        note: 'Salary',
      },
    }))

    expect(screen.getByText('No note added').closest('strong')).toBeTruthy()
    expect(screen.getByText(/\+.*2500/)).toBeTruthy()
  })

  it('passes through extra detail content in children', () => {
    render(React.createElement(
      TransactionDetailSheet,
      {
        onClose: jest.fn(),
        entry: {
          kind: 'expense',
          title: 'A',
          merchant: 'A',
          occurredOn: '2026-01-01',
          amount: 1,
          chip: 'C',
        },
        children: React.createElement('p', { 'data-testid': 'extra' }, 'Extra copy'),
      },
    ))

    expect(screen.getByTestId('extra').textContent).toBe('Extra copy')
  })

  it('uses the default "Expense" title when both title and visual label are empty', () => {
    const { getEntryVisual } = require('@/lib/financeVisuals')
    getEntryVisual.mockReturnValueOnce({
      label: undefined,
      color: '#111',
      soft: '#222',
      symbol: '•',
    })
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'expense',
        title: '',
        merchant: 'Only merchant',
        occurredOn: '2026-01-10',
        amount: 2,
        note: '',
      },
    }))
    expect(screen.getByRole('heading', { name: 'Expense' })).toBeTruthy()
  })

  it('uses the default "Income" title when the transaction is income and title and label are empty', () => {
    const { getEntryVisual } = require('@/lib/financeVisuals')
    getEntryVisual.mockReturnValueOnce({
      label: undefined,
      color: '#111',
      soft: '#222',
      symbol: '•',
    })
    render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'income',
        title: '',
        merchant: 'Bank',
        occurredOn: '2026-01-10',
        amount: 1,
        note: '',
      },
    }))
    expect(screen.getByRole('heading', { name: 'Income' })).toBeTruthy()
  })

  it('shows a blank entry chip when the visual label and entry chip are both missing', () => {
    const { getEntryVisual } = require('@/lib/financeVisuals')
    getEntryVisual.mockReturnValueOnce({
      label: '',
      color: '#111',
      soft: '#222',
      symbol: '•',
    })
    const { container } = render(React.createElement(TransactionDetailSheet, {
      onClose: jest.fn(),
      entry: {
        kind: 'income',
        title: 'Bank drop',
        merchant: 'Bank',
        occurredOn: '2026-01-10',
        amount: 5,
        note: 'memo',
      },
    }))
    const chip = container.querySelector('.detail-sheet__copy .entry-chip')
    expect(chip && chip.textContent).toBe('')
  })
})

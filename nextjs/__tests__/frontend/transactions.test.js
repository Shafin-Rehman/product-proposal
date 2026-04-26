/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({
  useAuth: jest.fn(),
  useDataMode: jest.fn(),
  useDataChanged: jest.fn(),
}))
jest.mock('@/lib/apiClient', () => ({
  ApiError: class ApiError extends Error {
    constructor(message = 'API error', status) {
      super(message)
      this.status = status
    }
  },
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}))
jest.mock('@/lib/demoData', () => ({
  demoActivity: [
    {
      id: 'mock-expense-lab-coffee',
      kind: 'expense',
      merchant: 'Lab Coffee House',
      title: 'Lab Coffee House',
      chip: 'Dining',
      occurredOn: '2026-03-15',
      amount: 12.4,
      note: 'Breakfast before class',
    },
    {
      id: 'mock-expense-market',
      kind: 'expense',
      merchant: 'Mockville Market',
      title: 'Mockville Market',
      chip: 'Groceries',
      occurredOn: '2026-03-16',
      amount: 61.47,
      note: 'Produce and snacks',
    },
    {
      id: 'mock-income-payroll',
      kind: 'income',
      merchant: 'Mockville Payroll',
      title: 'Mockville Payroll',
      chip: 'Income',
      occurredOn: '2026-03-01',
      amount: 2400,
      note: '',
    },
  ],
}))
jest.mock('@/lib/financeVisuals', () => ({
  getCategoryVisual: jest.fn((value) => ({
    label: value,
    color: '#123456',
    soft: '#abcdef',
    symbol: value?.[0] || '?',
  })),
  getEntryVisual: jest.fn((entry) => ({
    color: entry.kind === 'income' ? '#0f9d58' : '#123456',
    soft: '#abcdef',
    symbol: entry.kind === 'income' ? '+' : '$',
  })),
}))
jest.mock('@/lib/financeUtils', () => ({
  buildActivityFeed: jest.fn(),
  formatCurrency: jest.fn((value) => `$${value}`),
  formatLongDate: jest.fn((value) => `Long ${value}`),
  formatShortDate: jest.fn((value) => value),
  groupActivityByDate: jest.fn((entries) => {
    const grouped = new Map()
    entries.forEach((entry) => {
      const key = entry.occurredOn
      if (!grouped.has(key)) grouped.set(key, { key, label: `On ${key}`, entries: [] })
      grouped.get(key).entries.push(entry)
    })
    return Array.from(grouped.values()).sort((left, right) => right.key.localeCompare(left.key))
  }),
}))

const React = require('react')
const { render, screen, fireEvent, cleanup, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useDataChanged } = require('@/components/providers')
const { default: TransactionsView } = require('@/components/transactions-view')

beforeEach(() => {
  jest.clearAllMocks()
  useRouter.mockReturnValue({ replace: jest.fn() })
  useAuth.mockReturnValue({
    isReady: true,
    logout: jest.fn(),
    session: {
      accessToken: 'token',
      user: { email: 'sam@example.com' },
    },
  })
  useDataMode.mockReturnValue({ isSampleMode: true })
  useDataChanged.mockReturnValue({ dataChangedToken: 0, notifyDataChanged: jest.fn() })
})

afterEach(() => {
  cleanup()
})

describe('TransactionsView (sample data)', () => {
  it('renders the grouped activity feed with expenses and income rows', () => {
    render(React.createElement(TransactionsView))
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeTruthy()
    expect(screen.getByText('Lab Coffee House')).toBeTruthy()
    expect(screen.getByText('Mockville Market')).toBeTruthy()
    expect(screen.getByText('Mockville Payroll')).toBeTruthy()
  })

  it('filters to expenses only when the Expenses segment is selected', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Expenses' }))
    })
    expect(screen.queryByText('Mockville Payroll')).toBeNull()
    expect(screen.getByText('Lab Coffee House')).toBeTruthy()
  })

  it('filters to income only when the Income segment is selected', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Income' }))
    })
    expect(screen.queryByText('Lab Coffee House')).toBeNull()
    expect(screen.getByText('Mockville Payroll')).toBeTruthy()
  })

  it('filters the list when searching for mockville market', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.change(screen.getByPlaceholderText(/Search merchant/i), { target: { value: 'mockville market' } })
    })
    expect(screen.getByText('Mockville Market')).toBeTruthy()
    expect(screen.queryByText('Lab Coffee House')).toBeNull()
  })

  it('opens a detail sheet when a row is clicked and closes it on close button', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.click(screen.getByText('Lab Coffee House'))
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Lab Coffee House' })).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the detail sheet when the backdrop control is activated', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.click(screen.getByText('Lab Coffee House'))
    })
    expect(screen.getByRole('dialog')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close transaction details' }))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not repeat the chip text inside the detail sheet subtitle when merchant matches title', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.click(screen.getByText('Mockville Payroll'))
    })
    const subtitle = document.querySelector('.detail-sheet__subtitle')
    expect(subtitle).toBeTruthy()
    expect(subtitle.textContent).not.toBe('Income')
  })

  it('shows a kind-specific empty message when filters produce no results', () => {
    render(React.createElement(TransactionsView))
    act(() => {
      fireEvent.change(screen.getByPlaceholderText(/Search merchant/i), { target: { value: 'zzzzz' } })
    })
    expect(screen.getByText('No matching transactions')).toBeTruthy()
  })
})

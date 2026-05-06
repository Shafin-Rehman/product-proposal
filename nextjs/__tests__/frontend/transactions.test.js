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
      chip: 'Salary',
      occurredOn: '2026-03-01',
      amount: 2400,
      note: '',
    },
  ],
}))
jest.mock('@/lib/financeVisuals', () => {
  const actual = jest.requireActual('@/lib/financeVisuals')
  return {
    ...actual,
    getEntryVisual: jest.fn((entry) => {
      if (entry?.chip) {
        const serverIcon = entry.kind === 'income' ? entry?.sourceIcon : entry?.categoryIcon
        return actual.getCategoryPresentation({ name: entry.chip, icon: serverIcon, kind: entry?.kind })
      }
      if (entry?.categoryName) {
        return actual.getCategoryPresentation({
          name: entry.categoryName,
          icon: entry.kind === 'income' ? entry?.sourceIcon : entry?.categoryIcon,
          kind: entry?.kind,
        })
      }
      return actual.getEntryVisual(entry)
    }),
  }
})
jest.mock('@/lib/financeUtils', () => {
  const actual = jest.requireActual('@/lib/financeUtils')
  return {
    ...actual,
    buildActivityFeed: jest.fn(() => []),
    formatCurrency: jest.fn((value) => `$${value}`),
    formatLongDate: jest.fn((value) => `Long ${value}`),
    formatShortDate: jest.fn((value) => value),
  }
})

const React = require('react')
const { render, screen, fireEvent, cleanup, act, waitFor, within } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useDataChanged } = require('@/components/providers')
const { apiGet, apiPost } = require('@/lib/apiClient')
const financeUtils = require('@/lib/financeUtils')
const actualFinanceUtils = jest.requireActual('@/lib/financeUtils')
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

describe('TransactionsView (live) entry form (Issue #58)', () => {
  afterEach(() => {
    financeUtils.buildActivityFeed.mockImplementation(() => [])
  })

  beforeEach(() => {
    useDataMode.mockReturnValue({ isSampleMode: false })
    apiGet.mockImplementation((url) => {
      if (url === '/api/expenses' || url === '/api/income') return Promise.resolve([])
      if (url === '/api/expenses/categories') {
        return Promise.resolve([
          { id: 'c-edu', name: 'Education', icon: '\u{1F4DA}' },
          { id: 'c-food', name: 'Food', icon: '\u{1F354}' },
        ])
      }
      if (url === '/api/income/categories') {
        return Promise.resolve([{ id: 'i-bus', name: 'Business', icon: '\u{1F3E2}' }])
      }
      return Promise.resolve([])
    })
    apiPost.mockResolvedValue({})
  })

  it('opens add sheet with the first category pre-selected and a matching preview', async () => {
    render(React.createElement(TransactionsView))
    await waitFor(() => {
      expect(screen.queryByText('Loading activity')).toBeNull()
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }))
    })
    const dialog = screen.getByRole('dialog')
    const select = within(dialog).getByRole('combobox')
    expect(select.value).toBe('Education')
    const previewAvatar = dialog.querySelector('.entry-avatar--large span')
    expect(previewAvatar.textContent).toBe('\u{1F4DA}')
  })

  it('posts a new expense with the pre-selected first category', async () => {
    render(React.createElement(TransactionsView))
    await waitFor(() => { expect(screen.queryByText('Loading activity')).toBeNull() })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Add transaction' })) })
    const dialog = screen.getByRole('dialog')
    const amountInput = dialog.querySelector('input[inputmode="decimal"]')
    act(() => { fireEvent.change(amountInput, { target: { value: '12.5' } }) })
    act(() => { fireEvent.click(within(dialog).getByRole('button', { name: 'Add transaction' })) })
    await waitFor(() => { expect(apiPost).toHaveBeenCalled() })
    const expensePost = apiPost.mock.calls.find((c) => c[0] === '/api/expenses')
    expect(expensePost).toBeTruthy()
    expect(expensePost[1].category_id).toBe('c-edu')
  })

  it('switches to income with the first source pre-selected', async () => {
    render(React.createElement(TransactionsView))
    await waitFor(() => { expect(screen.queryByText('Loading activity')).toBeNull() })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Add transaction' })) })
    const dialog = screen.getByRole('dialog')
    act(() => { fireEvent.click(within(dialog).getByRole('button', { name: 'Income' })) })
    const select = within(dialog).getByRole('combobox')
    expect(select.value).toBe('Business')
  })

  it('posts a new income row with the pre-selected first source', async () => {
    render(React.createElement(TransactionsView))
    await waitFor(() => { expect(screen.queryByText('Loading activity')).toBeNull() })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Add transaction' })) })
    const dialog = screen.getByRole('dialog')
    act(() => { fireEvent.click(within(dialog).getByRole('button', { name: 'Income' })) })
    const amountInput = dialog.querySelector('input.input-field[inputmode="decimal"]')
    act(() => { fireEvent.change(amountInput, { target: { value: '100' } }) })
    act(() => { fireEvent.click(within(dialog).getByRole('button', { name: 'Add transaction' })) })
    await waitFor(() => { expect(apiPost).toHaveBeenCalled() })
    const incPost = apiPost.mock.calls.find((c) => c[0] === '/api/income')
    expect(incPost).toBeTruthy()
    expect(incPost[1].source_id).toBe('i-bus')
  })

  it('sends category_id: null on update when editing an expense and clearing the category', async () => {
    financeUtils.buildActivityFeed.mockImplementation((expenses, income) =>
      actualFinanceUtils.buildActivityFeed(expenses, income))
    apiGet.mockImplementation((url) => {
      if (url === '/api/expenses') {
        return Promise.resolve([{
          id: 55,
          amount: '8.00',
          date: '2026-03-12',
          description: 'Snack',
          category_name: 'Food',
          category_id: 'c-food-uuid',
        }])
      }
      if (url === '/api/income') return Promise.resolve([])
      if (url === '/api/expenses/categories') {
        return Promise.resolve([{ id: 'c-food-uuid', name: 'Food', icon: null }])
      }
      if (url === '/api/income/categories') return Promise.resolve([{ id: 'i-1', name: 'Business', icon: null }])
      return Promise.resolve([])
    })
    render(React.createElement(TransactionsView))
    await waitFor(() => { expect(screen.queryByText('Loading activity')).toBeNull() })
    act(() => { fireEvent.click(screen.getByText('Snack')) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })) })
    const formDialog = screen.getByRole('dialog')
    const select = within(formDialog).getByRole('combobox')
    act(() => { fireEvent.change(select, { target: { value: '' } }) })
    act(() => { fireEvent.click(within(formDialog).getByRole('button', { name: 'Save changes' })) })
    await waitFor(() => {
      const updateCall = apiPost.mock.calls.find((c) => c[0] === '/api/expenses/update')
      expect(updateCall[1].category_id).toBeNull()
    })
  })

  it('sends source_id: null on update when editing income and clearing the source', async () => {
    financeUtils.buildActivityFeed.mockImplementation((expenses, income) =>
      actualFinanceUtils.buildActivityFeed(expenses, income))
    apiGet.mockImplementation((url) => {
      if (url === '/api/expenses') return Promise.resolve([])
      if (url === '/api/income') {
        return Promise.resolve([{
          id: 90,
          amount: '200.00',
          date: '2026-03-05',
          notes: 'Pay',
          source_name: 'Freelance',
          source_id: 'src-f',
        }])
      }
      if (url === '/api/expenses/categories') {
        return Promise.resolve([{ id: 'c1', name: 'Food', icon: null }])
      }
      if (url === '/api/income/categories') {
        return Promise.resolve([{ id: 'src-f', name: 'Freelance', icon: null }])
      }
      return Promise.resolve([])
    })
    render(React.createElement(TransactionsView))
    await waitFor(() => { expect(screen.queryByText('Loading activity')).toBeNull() })
    act(() => { fireEvent.click(screen.getAllByText('Freelance')[0]) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })) })
    const formDialog = screen.getByRole('dialog')
    const select = within(formDialog).getByRole('combobox')
    act(() => { fireEvent.change(select, { target: { value: '' } }) })
    act(() => { fireEvent.click(within(formDialog).getByRole('button', { name: 'Save changes' })) })
    await waitFor(() => {
      const updateCall = apiPost.mock.calls.find((c) => c[0] === '/api/income/update')
      expect(updateCall[1].source_id).toBeNull()
    })
  })

  it('sends a stable category_id on update when editing and keeping Food selected', async () => {
    financeUtils.buildActivityFeed.mockImplementation((expenses, income) =>
      actualFinanceUtils.buildActivityFeed(expenses, income))
    apiGet.mockImplementation((url) => {
      if (url === '/api/expenses') {
        return Promise.resolve([{
          id: 60,
          amount: '3.00',
          date: '2026-03-14',
          description: 'Tea',
          category_name: 'Food',
          category_id: 'c-food-uuid-2',
        }])
      }
      if (url === '/api/income') return Promise.resolve([])
      if (url === '/api/expenses/categories') {
        return Promise.resolve([{ id: 'c-food-uuid-2', name: 'Food', icon: null }])
      }
      if (url === '/api/income/categories') return Promise.resolve([])
      return Promise.resolve([])
    })
    render(React.createElement(TransactionsView))
    await waitFor(() => { expect(screen.queryByText('Loading activity')).toBeNull() })
    act(() => { fireEvent.click(screen.getByText('Tea')) })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Edit' })) })
    const formDialog = screen.getByRole('dialog')
    act(() => { fireEvent.click(within(formDialog).getByRole('button', { name: 'Save changes' })) })
    await waitFor(() => {
      const updateCall = apiPost.mock.calls.find((c) => c[0] === '/api/expenses/update')
      expect(updateCall[1].category_id).toBe('c-food-uuid-2')
    })
  })
})

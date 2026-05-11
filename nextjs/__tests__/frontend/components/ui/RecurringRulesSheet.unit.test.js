/** @jest-environment jsdom */

jest.mock('@/lib/apiClient', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}))
jest.mock('@/lib/financeUtils', () => ({
  formatCurrency: jest.fn((v) => `$${Number(v).toFixed(2)}`),
}))
jest.mock('@/lib/recurringDates', () => ({
  localCalendarYmd: jest.fn(() => '2026-05-11'),
}))

const React = require('react')
const { render, screen, fireEvent, act, waitFor } = require('@testing-library/react')
const { apiGet, apiPost } = require('@/lib/apiClient')
const RecurringRulesSheet = require('@/components/ui/RecurringRulesSheet').default

const DEMO_RULES = [
  {
    id: 'r-demo',
    type: 'expense',
    description: 'Coffee',
    amount: '5.00',
    frequency: 'weekly',
    paused: false,
    category_name: 'Food',
    next_date: '2026-06-01',
  },
]

beforeEach(() => {
  jest.clearAllMocks()
})

it('renders demo rules without fetching and closes from the backdrop', async () => {
  const onClose = jest.fn()
  await act(async () => {
    render(React.createElement(RecurringRulesSheet, {
      session: { accessToken: 'tok' },
      onClose,
      demoRules: DEMO_RULES,
    }))
  })
  expect(screen.getByRole('dialog', { name: /recurring transactions/i })).toBeTruthy()
  expect(screen.getByText('Coffee')).toBeTruthy()
  expect(screen.getByText(/Next 2026-06-01/)).toBeTruthy()
  expect(apiGet).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /close recurring transactions/i }))
  expect(onClose).toHaveBeenCalled()
})

it('loads live rules then saves an edit', async () => {
  apiGet.mockResolvedValueOnce([
    {
      id: 'r-live',
      type: 'expense',
      description: 'Gym',
      amount: '45.00',
      frequency: 'monthly',
      paused: false,
      category_name: 'Health',
      next_date: '2026-07-01',
    },
  ])
  apiPost.mockResolvedValueOnce({})

  await act(async () => {
    render(React.createElement(RecurringRulesSheet, {
      session: { accessToken: 'tok' },
      onClose: jest.fn(),
    }))
  })

  await waitFor(() => expect(screen.getByText('Gym')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  await waitFor(() => {
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/update',
      expect.objectContaining({
        rule_id: 'r-live',
        amount: 50,
        frequency: 'monthly',
      }),
      { accessToken: 'tok' }
    )
  })
})

it('sends updated frequency and description when editing a live rule', async () => {
  apiGet.mockResolvedValueOnce([
    {
      id: 'r-live',
      type: 'expense',
      description: 'Gym',
      amount: '45.00',
      frequency: 'monthly',
      paused: false,
      category_name: 'Health',
      next_date: '2026-07-01',
    },
  ])
  apiPost.mockResolvedValueOnce({})

  await act(async () => {
    render(React.createElement(RecurringRulesSheet, {
      session: { accessToken: 'tok' },
      onClose: jest.fn(),
    }))
  })

  await waitFor(() => expect(screen.getByText('Gym')).toBeTruthy())

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

  fireEvent.change(screen.getByLabelText('Frequency'), { target: { value: 'yearly' } })
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Annual membership' } })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })

  await waitFor(() => {
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/update',
      expect.objectContaining({
        rule_id: 'r-live',
        amount: 45,
        frequency: 'yearly',
        description: 'Annual membership',
      }),
      { accessToken: 'tok' }
    )
  })
})

it('shows the empty state when the live API returns no rules', async () => {
  apiGet.mockResolvedValueOnce([])
  await act(async () => {
    render(React.createElement(RecurringRulesSheet, {
      session: { accessToken: 'tok' },
      onClose: jest.fn(),
    }))
  })
  await waitFor(() => {
    expect(screen.getByText('No recurring transactions')).toBeTruthy()
  })
})

it('discards an in-progress edit without saving', async () => {
  apiGet.mockResolvedValueOnce([
    { id: 'r1', type: 'expense', description: 'Gym', amount: '45.00', frequency: 'monthly', paused: false, category_name: 'Health', next_date: '2026-07-01' },
  ])

  await act(async () => {
    render(React.createElement(RecurringRulesSheet, { session: { accessToken: 'tok' }, onClose: jest.fn() }))
  })
  await waitFor(() => expect(screen.getByText('Gym')).toBeTruthy())

  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '99' } })
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

  expect(apiPost).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
})

it('pauses an active rule via the Pause button', async () => {
  apiGet.mockResolvedValueOnce([
    { id: 'r1', type: 'expense', description: 'Gym', amount: '45.00', frequency: 'monthly', paused: false, category_name: 'Health', next_date: '2026-07-01' },
  ])
  apiPost.mockResolvedValueOnce({ id: 'r1', paused: true })

  await act(async () => {
    render(React.createElement(RecurringRulesSheet, { session: { accessToken: 'tok' }, onClose: jest.fn() }))
  })
  await waitFor(() => expect(screen.getByText('Gym')).toBeTruthy())

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
  })
  await waitFor(() => {
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/update',
      expect.objectContaining({ rule_id: 'r1', paused: true }),
      { accessToken: 'tok' }
    )
  })
})

it('cancels (deletes) a rule via the Cancel button', async () => {
  apiGet.mockResolvedValueOnce([
    { id: 'r1', type: 'expense', description: 'Gym', amount: '45.00', frequency: 'monthly', paused: false, category_name: 'Health', next_date: '2026-07-01' },
  ])
  apiPost.mockResolvedValueOnce({})

  await act(async () => {
    render(React.createElement(RecurringRulesSheet, { session: { accessToken: 'tok' }, onClose: jest.fn() }))
  })
  await waitFor(() => expect(screen.getByText('Gym')).toBeTruthy())

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  })
  await waitFor(() => {
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/delete',
      { rule_id: 'r1' },
      { accessToken: 'tok' }
    )
  })
  expect(screen.queryByText('Gym')).toBeNull()
})

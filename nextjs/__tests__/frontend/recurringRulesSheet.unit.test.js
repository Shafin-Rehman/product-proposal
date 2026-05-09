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
  demoActivity: [],
  demoRulesForSheet: [
    { id: 'demo-rule-1', description: 'Spotify', amount: '11.99', frequency: 'monthly', next_date: '2026-04-02', paused: false },
    { id: 'demo-rule-2', description: 'Phone plan', amount: '36.00', frequency: 'monthly', next_date: '2026-04-07', paused: false },
  ],
}))
jest.mock('@/lib/financeVisuals', () => {
  const actual = jest.requireActual('@/lib/financeVisuals')
  return {
    ...actual,
    getEntryVisual: jest.fn((entry) =>
      actual.getCategoryPresentation({ name: entry?.chip ?? '', icon: null, kind: entry?.kind }),
    ),
  }
})
jest.mock('@/lib/financeUtils', () => {
  const actual = jest.requireActual('@/lib/financeUtils')
  return {
    ...actual,
    buildActivityFeed: jest.fn(() => []),
    formatCurrency: jest.fn((v) => `$${v}`),
    formatLongDate: jest.fn((v) => `Long ${v}`),
    formatShortDate: jest.fn((v) => v),
  }
})

const React = require('react')
const { render, screen, fireEvent, cleanup, act, waitFor, within } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useAuth, useDataMode, useDataChanged } = require('@/components/providers')
const { apiGet, apiPost } = require('@/lib/apiClient')
const { default: TransactionsView } = require('@/components/transactions-view')

const MOCK_RULES = [
  {
    id: 'rule-1',
    type: 'expense',
    description: 'Spotify',
    amount: '11.99',
    frequency: 'monthly',
    start_date: '2026-05-01',
    next_date: '2026-06-01',
    paused: false,
    category_name: 'Entertainment',
    category_icon: null,
  },
  {
    id: 'rule-2',
    type: 'expense',
    description: 'Gym',
    amount: '45.00',
    frequency: 'monthly',
    start_date: '2026-04-01',
    next_date: '2026-06-01',
    paused: true,
    category_name: 'Health',
    category_icon: null,
  },
]

function setupLiveMode() {
  useRouter.mockReturnValue({ replace: jest.fn() })
  useAuth.mockReturnValue({
    isReady: true,
    logout: jest.fn(),
    session: { accessToken: 'token', user: { email: 'test@example.com' } },
  })
  useDataMode.mockReturnValue({ isSampleMode: false })
  useDataChanged.mockReturnValue({ dataChangedToken: 0, notifyDataChanged: jest.fn() })
  apiGet.mockImplementation((url) => {
    if (url === '/api/expenses') return Promise.resolve([])
    if (url === '/api/income') return Promise.resolve([])
    if (url === '/api/expenses/categories') return Promise.resolve([])
    if (url === '/api/income/categories') return Promise.resolve([])
    if (url === '/api/recurring') return Promise.resolve(MOCK_RULES)
    return Promise.resolve([])
  })
  apiPost.mockResolvedValue({})
}

function setupSampleMode() {
  useRouter.mockReturnValue({ replace: jest.fn() })
  useAuth.mockReturnValue({
    isReady: true,
    logout: jest.fn(),
    session: { accessToken: 'token', user: { email: 'test@example.com' } },
  })
  useDataMode.mockReturnValue({ isSampleMode: true })
  useDataChanged.mockReturnValue({ dataChangedToken: 0, notifyDataChanged: jest.fn() })
}

async function openRecurringSheet() {
  render(React.createElement(TransactionsView))
  const btn = await screen.findByRole('button', { name: /manage recurring/i })
  await act(async () => { fireEvent.click(btn) })
  return screen.getByRole('dialog', { name: /recurring/i })
}

beforeEach(() => {
  jest.clearAllMocks()
  setupLiveMode()
})

afterEach(() => {
  cleanup()
})

describe('Recurring button on TransactionsView', () => {
  it('shows a "Manage recurring" button in live mode', async () => {
    render(React.createElement(TransactionsView))
    expect(await screen.findByRole('button', { name: /manage recurring/i })).toBeTruthy()
  })

  it('shows the recurring button in sample mode too', async () => {
    setupSampleMode()
    render(React.createElement(TransactionsView))
    expect(await screen.findByRole('button', { name: /manage recurring/i })).toBeTruthy()
  })

  it('sample mode opens a read-only sheet with demo rules (no action buttons)', async () => {
    setupSampleMode()
    render(React.createElement(TransactionsView))
    const btn = await screen.findByRole('button', { name: /manage recurring/i })
    await act(async () => { fireEvent.click(btn) })
    const sheet = screen.getByRole('dialog', { name: /recurring/i })
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())
    expect(within(sheet).queryByRole('button', { name: /edit/i })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: /pause/i })).toBeNull()
    expect(within(sheet).queryByRole('button', { name: /cancel/i })).toBeNull()
  })

  it('clicking the button opens a recurring sheet dialog', async () => {
    render(React.createElement(TransactionsView))
    const btn = await screen.findByRole('button', { name: /manage recurring/i })
    await act(async () => { fireEvent.click(btn) })
    expect(screen.getByRole('dialog', { name: /recurring/i })).toBeTruthy()
  })
})

describe('RecurringRulesSheet content', () => {
  it('lists the rules fetched from /api/recurring', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).getByText('Spotify')).toBeTruthy()
      expect(within(sheet).getByText('Gym')).toBeTruthy()
    })
  })

  it('shows empty state when there are no rules', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/api/recurring') return Promise.resolve([])
      return Promise.resolve([])
    })
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).getByText(/no recurring/i)).toBeTruthy()
    })
  })

  it('has a Pause button for active rules', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).getByText('Spotify')).toBeTruthy()
    })
    const spotifyRow = within(sheet).getByText('Spotify').closest('[data-rule-id]') ??
      within(sheet).getByText('Spotify').closest('.recurring-rule-row')
    expect(spotifyRow || within(sheet).getAllByRole('button', { name: /pause/i })[0]).toBeTruthy()
  })

  it('has a Resume button for paused rules', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).getByText('Gym')).toBeTruthy()
    })
    expect(within(sheet).getByRole('button', { name: /resume/i })).toBeTruthy()
  })

  it('Pause calls /api/recurring/update with paused: true', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())

    const pauseBtn = within(sheet).getAllByRole('button', { name: /pause/i })[0]
    await act(async () => { fireEvent.click(pauseBtn) })

    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/update',
      expect.objectContaining({ rule_id: 'rule-1', paused: true }),
      expect.objectContaining({ accessToken: 'token' }),
    )
  })

  it('Resume calls /api/recurring/update with paused: false', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Gym')).toBeTruthy())

    const resumeBtn = within(sheet).getByRole('button', { name: /resume/i })
    await act(async () => { fireEvent.click(resumeBtn) })

    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/update',
      expect.objectContaining({ rule_id: 'rule-2', paused: false }),
      expect.objectContaining({ accessToken: 'token' }),
    )
  })

  it('Cancel sends the correct rule_id to the API', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())
    const cancelBtns = within(sheet).getAllByRole('button', { name: /cancel/i })
    await act(async () => { fireEvent.click(cancelBtns[0]) })
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/delete',
      { rule_id: 'rule-1' },
      expect.objectContaining({ accessToken: 'token' }),
    )
  })

  it('cancelling one rule removes only that rule — the other rule remains', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).getByText('Spotify')).toBeTruthy()
      expect(within(sheet).getByText('Gym')).toBeTruthy()
    })
    const cancelBtns = within(sheet).getAllByRole('button', { name: /cancel/i })
    await act(async () => { fireEvent.click(cancelBtns[0]) })
    await waitFor(() => expect(within(sheet).queryByText('Spotify')).toBeNull())
    expect(within(sheet).getByText('Gym')).toBeTruthy()
  })

  it('cancelling the second rule removes only that rule — the first remains', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).getByText('Spotify')).toBeTruthy()
      expect(within(sheet).getByText('Gym')).toBeTruthy()
    })
    const cancelBtns = within(sheet).getAllByRole('button', { name: /cancel/i })
    await act(async () => { fireEvent.click(cancelBtns[1]) })
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/delete',
      { rule_id: 'rule-2' },
      expect.objectContaining({ accessToken: 'token' }),
    )
    await waitFor(() => expect(within(sheet).queryByText('Gym')).toBeNull())
    expect(within(sheet).getByText('Spotify')).toBeTruthy()
  })

  it('each rule has an Edit button', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())
    const editBtns = within(sheet).getAllByRole('button', { name: /edit/i })
    expect(editBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking Edit reveals an amount input', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())
    const editBtns = within(sheet).getAllByRole('button', { name: /edit/i })
    await act(async () => { fireEvent.click(editBtns[0]) })
    expect(within(sheet).getByRole('spinbutton', { name: /amount/i })).toBeTruthy()
  })

  it('Save calls /api/recurring/update with updated amount', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())
    const editBtns = within(sheet).getAllByRole('button', { name: /edit/i })
    await act(async () => { fireEvent.click(editBtns[0]) })
    const amountInput = within(sheet).getByRole('spinbutton', { name: /amount/i })
    fireEvent.change(amountInput, { target: { value: '14.99' } })
    const saveBtn = within(sheet).getByRole('button', { name: /save/i })
    await act(async () => { fireEvent.click(saveBtn) })
    expect(apiPost).toHaveBeenCalledWith(
      '/api/recurring/update',
      expect.objectContaining({ rule_id: 'rule-1', amount: 14.99 }),
      expect.objectContaining({ accessToken: 'token' }),
    )
  })

  it('Discard reverts edit mode without calling the API', async () => {
    const sheet = await openRecurringSheet()
    await waitFor(() => expect(within(sheet).getByText('Spotify')).toBeTruthy())
    const editBtns = within(sheet).getAllByRole('button', { name: /edit/i })
    await act(async () => { fireEvent.click(editBtns[0]) })
    expect(within(sheet).getByRole('spinbutton', { name: /amount/i })).toBeTruthy()
    const discardBtn = within(sheet).getByRole('button', { name: /discard/i })
    act(() => { fireEvent.click(discardBtn) })
    expect(within(sheet).queryByRole('spinbutton', { name: /amount/i })).toBeNull()
    expect(apiPost).not.toHaveBeenCalledWith('/api/recurring/update', expect.anything(), expect.anything())
  })

  it('income rule without description shows "Recurring income" not "Recurring charge"', async () => {
    apiGet.mockImplementation((url) => {
      if (url === '/api/recurring') return Promise.resolve([{
        id: 'rule-income',
        type: 'income',
        description: null,
        amount: '1200.00',
        frequency: 'monthly',
        source_name: null,
        category_name: null,
        next_date: '2026-06-01',
        paused: false,
      }])
      return Promise.resolve([])
    })
    const sheet = await openRecurringSheet()
    await waitFor(() => {
      expect(within(sheet).queryByText('Recurring charge')).toBeNull()
      expect(within(sheet).getByText('Recurring income')).toBeTruthy()
    })
  })

  it('has a Close button that closes the sheet', async () => {
    const sheet = await openRecurringSheet()
    const closeBtn = within(sheet).getByRole('button', { name: /close/i })
    act(() => { fireEvent.click(closeBtn) })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /recurring/i })).toBeNull()
    })
  })
})

/** @jest-environment jsdom */

jest.mock('@/components/transactions-view', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'transactions-view-stub' }, 'transactions'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const TransactionsPage = require('@/app/(app)/transactions/page').default

it('transactions route mounts TransactionsView', () => {
  render(React.createElement(TransactionsPage))
  expect(screen.getByTestId('transactions-view-stub').textContent).toContain('transactions')
})

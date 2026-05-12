/** @jest-environment jsdom */

jest.mock('@/components/forgot-password-form', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'forgot-password-stub' }, 'forgot'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const ForgotPasswordPage = require('@/app/(auth)/forgot-password/page').default

it('forgot-password route mounts ForgotPasswordForm', () => {
  render(React.createElement(ForgotPasswordPage))
  expect(screen.getByTestId('forgot-password-stub').textContent).toContain('forgot')
})

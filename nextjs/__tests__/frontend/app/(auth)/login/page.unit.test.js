/** @jest-environment jsdom */

jest.mock('@/components/auth-form', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: (props) =>
      React.createElement('div', {
        'data-testid': 'auth-form-stub',
        'data-initial-email': props.initialEmail ?? '',
        'data-show-signup-success': props.showSignupSuccess === true ? 'true' : 'false',
      }, 'login'),
  }
})

const React = require('react')
const { render, screen } = require('@testing-library/react')
const LoginPage = require('@/app/(auth)/login/page').default

it('login route mounts AuthForm and forwards searchParams', () => {
  const { rerender } = render(React.createElement(LoginPage, { searchParams: {} }))
  let stub = screen.getByTestId('auth-form-stub')
  expect(stub.getAttribute('data-initial-email')).toBe('')
  expect(stub.getAttribute('data-show-signup-success')).toBe('false')

  rerender(
    React.createElement(LoginPage, { searchParams: { email: 'invited@example.com', signup: 'success' } }),
  )
  stub = screen.getByTestId('auth-form-stub')
  expect(stub.getAttribute('data-initial-email')).toBe('invited@example.com')
  expect(stub.getAttribute('data-show-signup-success')).toBe('true')
})

/** @jest-environment jsdom */
// Source: src/app/demo/page.js
//
// DemoPage sets budgetbuddy.data-mode=sample in localStorage then redirects
// to /dashboard — no UI is rendered.

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const React = require('react')
const { render, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const DemoPage = require('@/app/demo/page').default

let mockReplace

beforeEach(() => {
  mockReplace = jest.fn()
  useRouter.mockReturnValue({ replace: mockReplace })
  window.localStorage.clear()
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('DemoPage — localStorage', () => {
  it('writes budgetbuddy.data-mode=sample to localStorage on mount', async () => {
    await act(async () => { render(React.createElement(DemoPage)) })
    expect(window.localStorage.getItem('budgetbuddy.data-mode')).toBe('sample')
  })

  it('still redirects when localStorage.setItem throws', async () => {
    const spy = jest.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await act(async () => { render(React.createElement(DemoPage)) })
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    spy.mockRestore()
  })
})

describe('DemoPage — redirect', () => {
  it('calls router.replace("/dashboard") on mount', async () => {
    await act(async () => { render(React.createElement(DemoPage)) })
    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })

  it('renders nothing (returns null)', async () => {
    const { container } = await act(async () => render(React.createElement(DemoPage)))
    expect(container.firstChild).toBeNull()
  })
})

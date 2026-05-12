/** @jest-environment jsdom */

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/components/providers', () => ({ useDataMode: jest.fn() }))

const React = require('react')
const { render, act } = require('@testing-library/react')
const { useRouter } = require('next/navigation')
const { useDataMode } = require('@/components/providers')
const DemoPage = require('@/app/demo/page').default

let mockReplace
let mockSetMode

beforeEach(() => {
  mockReplace = jest.fn()
  mockSetMode = jest.fn()
  useRouter.mockReturnValue({ replace: mockReplace })
  useDataMode.mockReturnValue({ isSampleMode: false, setMode: mockSetMode })
})

afterEach(() => {
  jest.clearAllMocks()
})

it('demo route requests sample mode and does not redirect until sample is active', async () => {
  let container
  await act(async () => {
    container = render(React.createElement(DemoPage)).container
  })
  expect(mockSetMode).toHaveBeenCalledWith('sample')
  expect(mockReplace).not.toHaveBeenCalled()
  expect(container.firstChild).toBeNull()
})

it('demo route redirects to dashboard when sample mode is already on', async () => {
  useDataMode.mockReturnValue({ isSampleMode: true, setMode: mockSetMode })
  await act(async () => {
    render(React.createElement(DemoPage))
  })
  expect(mockReplace).toHaveBeenCalledWith('/dashboard')
})

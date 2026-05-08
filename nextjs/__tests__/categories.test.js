/**
 * Tests for Category Management API endpoints
 * Covers: create, rename, archive, and list categories
 */

const BASE_URL = 'http://localhost:3000'

// Mock authentication helper
const mockAuth = (overrides = {}) => ({
  headers: {
    authorization: 'Bearer test-token',
    'content-type': 'application/json',
    ...overrides,
  },
})

// Mock db and auth modules
jest.mock('@/lib/db', () => ({
  query: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authenticate: jest.fn(),
}))

const db = require('@/lib/db')
const { authenticate } = require('@/lib/auth')

const mockUser = { id: 'user-123', email: 'test@example.com' }

// Helper to mock successful authentication
const mockAuthSuccess = () => {
  authenticate.mockResolvedValue({ user: mockUser, error: null })
}

// Helper to mock failed authentication
const mockAuthFailure = () => {
  authenticate.mockResolvedValue({
    user: null,
    error: { status: 401, json: () => ({ error: 'Unauthorized' }) },
  })
}

// ─────────────────────────────────────────────
// CREATE CATEGORY TESTS
// ─────────────────────────────────────────────
describe('POST /api/expenses/categories/create', () => {
  const { POST } = require('@/app/api/expenses/categories/create/route')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('successfully creates a category with name and icon', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Coffee', icon: '☕', created_at: new Date().toISOString() }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/create`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ name: 'Coffee', icon: '☕' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).toBe('Coffee')
    expect(data.icon).toBe('☕')
  })

  test('successfully creates a category without icon', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-2', name: 'Misc', icon: null, created_at: new Date().toISOString() }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/create`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ name: 'Misc' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.name).toBe('Misc')
    expect(data.icon).toBeNull()
  })

  test('rejects empty name', async () => {
    mockAuthSuccess()

    const request = new Request(`${BASE_URL}/api/expenses/categories/create`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ name: '' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  test('rejects name longer than 100 characters', async () => {
    mockAuthSuccess()

    const request = new Request(`${BASE_URL}/api/expenses/categories/create`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ name: 'a'.repeat(101) }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  test('rejects duplicate category name with 409', async () => {
    mockAuthSuccess()
    const duplicateError = new Error('duplicate key')
    duplicateError.code = '23505'
    db.query.mockRejectedValueOnce(duplicateError)

    const request = new Request(`${BASE_URL}/api/expenses/categories/create`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ name: 'Coffee', icon: '☕' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(409)
  })

  test('rejects unauthenticated requests', async () => {
    mockAuthFailure()

    const request = new Request(`${BASE_URL}/api/expenses/categories/create`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Coffee' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})

// ─────────────────────────────────────────────
// RENAME CATEGORY TESTS
// ─────────────────────────────────────────────
describe('POST /api/expenses/categories/rename', () => {
  const { POST } = require('@/app/api/expenses/categories/rename/route')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('successfully renames a category', async () => {
    mockAuthSuccess()
    // First query: verify ownership
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] })
    // Second query: update
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Tea', icon: '🍵', archived: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/rename`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', new_name: 'Tea' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe('Tea')
    expect(data).not.toHaveProperty('user_id')
  })

  test('updates updated_at timestamp on rename', async () => {
    mockAuthSuccess()
    const updatedAt = new Date().toISOString()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] })
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Tea', icon: null, archived: false, created_at: updatedAt, updated_at: updatedAt }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/rename`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', new_name: 'Tea' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(data.updated_at).toBeDefined()
  })

  test('returns 404 if category not found', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [] })

    const request = new Request(`${BASE_URL}/api/expenses/categories/rename`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'nonexistent', new_name: 'NewName' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  test('rejects empty new_name', async () => {
    mockAuthSuccess()

    const request = new Request(`${BASE_URL}/api/expenses/categories/rename`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', new_name: '' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  test('rejects duplicate name with 409', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] })
    const duplicateError = new Error('duplicate key')
    duplicateError.code = '23505'
    db.query.mockRejectedValueOnce(duplicateError)

    const request = new Request(`${BASE_URL}/api/expenses/categories/rename`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', new_name: 'Coffee' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(409)
  })

  test('only owner can rename their category', async () => {
    mockAuthSuccess()
    // Returns empty rows since category belongs to different user
    db.query.mockResolvedValueOnce({ rows: [] })

    const request = new Request(`${BASE_URL}/api/expenses/categories/rename`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'other-user-cat', new_name: 'Hacked' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })
})

// ─────────────────────────────────────────────
// ARCHIVE CATEGORY TESTS
// ─────────────────────────────────────────────
describe('POST /api/expenses/categories/archive', () => {
  const { POST } = require('@/app/api/expenses/categories/archive/route')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('successfully archives a category', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', archived: false }] })
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Coffee', archived: true, updated_at: new Date().toISOString() }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/archive`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', archived: true }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.archived).toBe(true)
  })

  test('successfully unarchives a category', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', archived: true }] })
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Coffee', archived: false, updated_at: new Date().toISOString() }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/archive`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', archived: false }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.archived).toBe(false)
  })

  test('rejects if category is already archived', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', archived: true }] })

    const request = new Request(`${BASE_URL}/api/expenses/categories/archive`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', archived: true }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  test('rejects if category is already active', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', archived: false }] })

    const request = new Request(`${BASE_URL}/api/expenses/categories/archive`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', archived: false }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  test('only owner can archive their category', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [] })

    const request = new Request(`${BASE_URL}/api/expenses/categories/archive`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'other-user-cat', archived: true }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  test('does not delete transactions when category is archived', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', archived: false }] })
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Coffee', archived: true, updated_at: new Date().toISOString() }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories/archive`, {
      method: 'POST',
      ...mockAuth(),
      body: JSON.stringify({ category_id: 'cat-1', archived: true }),
    })

    const response = await POST(request)

    // Only 2 queries should run: check ownership + update archived
    // No DELETE query should be called
    expect(db.query).toHaveBeenCalledTimes(2)
    const queries = db.query.mock.calls.map((call) => call[0].toLowerCase())
    expect(queries.some((q) => q.includes('delete'))).toBe(false)
  })
})

// ─────────────────────────────────────────────
// GET CATEGORIES TESTS
// ─────────────────────────────────────────────
describe('GET /api/expenses/categories', () => {
  const { GET } = require('@/app/api/expenses/categories/route')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns only active categories by default', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'cat-1', name: 'Coffee', icon: '☕', archived: false, user_id: 'user-123' },
        { id: 'cat-2', name: 'Food', icon: '🍔', archived: false, user_id: null },
      ],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories`, mockAuth())
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.every((c) => c.archived === false)).toBe(true)
  })

  test('returns archived categories when include_archived=true', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'cat-1', name: 'Coffee', icon: '☕', archived: false, user_id: 'user-123' },
        { id: 'cat-2', name: 'Old', icon: null, archived: true, user_id: 'user-123' },
      ],
    })

    const request = new Request(
      `${BASE_URL}/api/expenses/categories?include_archived=true`,
      mockAuth()
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.some((c) => c.archived === true)).toBe(true)
  })

  test('returns correct fields', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cat-1', name: 'Coffee', icon: '☕', archived: false, user_id: 'user-123' }],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories`, mockAuth())
    const response = await GET(request)
    const data = await response.json()

    expect(data[0]).toHaveProperty('id')
    expect(data[0]).toHaveProperty('name')
    expect(data[0]).toHaveProperty('icon')
    expect(data[0]).toHaveProperty('archived')
  })

  test('prioritizes personal categories over global ones', async () => {
    mockAuthSuccess()
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'cat-1', name: 'My Category', icon: '⭐', archived: false, user_id: 'user-123' },
        { id: 'cat-2', name: 'Global Category', icon: '🌍', archived: false, user_id: null },
      ],
    })

    const request = new Request(`${BASE_URL}/api/expenses/categories`, mockAuth())
    const response = await GET(request)
    const data = await response.json()

    expect(data[0].user_id).toBe('user-123')
  })
})
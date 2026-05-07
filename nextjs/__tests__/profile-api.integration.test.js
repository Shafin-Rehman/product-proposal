jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

const { testApiHandler } = require('next-test-api-route-handler')
const { createClient } = require('@supabase/supabase-js')
const profileHandler = require('@/app/api/profile/route')

const bearerHeaders = (token = 'tok') => ({ authorization: `Bearer ${token}` })

function setupClients({ userId = 'uid1', userEmail = 'test@example.com', name = null } = {}) {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { name }, error: null }),
  }
  const mockAnonClient = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId, email: userEmail } }, error: null }) } }
  const mockServiceClient = { from: jest.fn(() => mockQuery) }
  createClient.mockReset()
  createClient.mockReturnValueOnce(mockAnonClient).mockReturnValueOnce(mockServiceClient)
  return { mockAnonClient, mockServiceClient, mockQuery }
}


describe('GET /api/profile', () => {
  afterEach(() => jest.clearAllMocks())

  it('401 — missing or invalid Authorization header', async () => {
    const mockAnonClient = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }) } }
    createClient.mockReset().mockReturnValue(mockAnonClient)
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET' })
        expect(res.status).toBe(401)
      },
    })
  })

  it('200 — returns stored name and email', async () => {
    const { mockServiceClient, mockQuery } = setupClients({ name: 'Zakariacny', userEmail: 'zac@example.com' })
    void mockServiceClient
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch({ method: 'GET', headers: bearerHeaders() })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.name).toBe('Zakariacny')
        expect(body.email).toBe('zac@example.com')
      },
    })
  })
})


describe('PATCH /api/profile', () => {
  const patch = (body, token = 'tok') => ({
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })

  afterEach(() => jest.clearAllMocks())

  it('400 — rejects missing or over-length name', async () => {
    createClient.mockReset().mockReturnValue({ auth: { getUser: jest.fn() } })
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch(patch({}))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/name is required/)
      },
    })
    createClient.mockReset().mockReturnValue({ auth: { getUser: jest.fn() } })
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch(patch({ name: 'A'.repeat(61) }))
        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/60 characters/)
      },
    })
  })

  it('401 — invalid token', async () => {
    const badClient = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'bad' } }) } }
    createClient.mockReset().mockReturnValueOnce(badClient).mockReturnValueOnce({})
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch(patch({ name: 'Alice' }, 'badtok'))
        expect(res.status).toBe(401)
      },
    })
  })

  it('200 — persists trimmed name and returns it', async () => {
    const { mockQuery } = setupClients()
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch(patch({ name: '  Alice  ' }))
        expect(res.status).toBe(200)
        expect((await res.json()).name).toBe('Alice')
        expect(mockQuery.update).toHaveBeenCalledWith({ name: 'Alice' })
        expect(mockQuery.eq).toHaveBeenCalledWith('id', 'uid1')
      },
    })
  })

  it('500 — unexpected error returns 500', async () => {
    const mockAnonClient = { auth: { getUser: jest.fn().mockRejectedValue(new Error('boom')) } }
    createClient.mockReset().mockReturnValueOnce(mockAnonClient).mockReturnValueOnce({})
    await testApiHandler({
      appHandler: profileHandler,
      async test({ fetch }) {
        const res = await fetch(patch({ name: 'Alice' }))
        expect(res.status).toBe(500)
      },
    })
  })
})


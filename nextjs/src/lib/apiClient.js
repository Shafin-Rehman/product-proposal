export class ApiError extends Error {
  constructor(message, { status = 500, body = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export async function apiGet(path, { accessToken, signal } = {}) {
  if (!accessToken) {
    throw new ApiError('Missing access token', { status: 401 })
  }

  const response = await fetch(path, {
    method: 'GET',
    cache: 'no-store',
    signal,
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  })

  let body = null
  try {
    body = await response.json()
  } catch {}

  if (!response.ok) {
    throw new ApiError(body?.error || 'Request failed', {
      status: response.status,
      body,
    })
  }

  return body
}

import { clearSession } from '@/lib/session'

function handleSessionFailure() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    clearSession()
    window.location.replace('/login?expired=true')
  }
}

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
    handleSessionFailure()
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
    if (response.status === 401) handleSessionFailure()

    throw new ApiError(body?.error || 'Request failed', {
      status: response.status,
      body,
    })
  }

  return body
}

export async function apiPost(path, body, { accessToken, signal } = {}) {
  if (!accessToken) {
    handleSessionFailure()
    throw new ApiError('Missing access token', { status: 401 })
  }

  const response = await fetch(path, {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let responseBody = null
  try {
    if (response.status !== 204) {
      responseBody = await response.json()
    }
  } catch {}

  if (!response.ok) {
    if (response.status === 401) handleSessionFailure()

    throw new ApiError(responseBody?.error || 'Request failed', {
      status: response.status,
      body: responseBody,
    })
  }

  return responseBody
}

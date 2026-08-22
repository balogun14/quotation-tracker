// Minimal API client for the Quotely backend.
// - Bearer access token held in memory (not localStorage).
// - Refresh token lives in an HttpOnly cookie set by the server.
// - On 401 we try one silent refresh (also covers multi-tab staleness) then rethrow.

const API_BASE = '/api/v1'

let accessToken = ''
let refreshPromise = null

export function setAccessToken(token) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function rawFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(options.body)
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' })
  if (res.status === 204) return null
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  const body = isJson ? await res.json() : await res.text()
  if (!res.ok) {
    const err = body?.error || {}
    throw new ApiError(res.status, err.code || 'ERROR', err.message || 'Request failed', err.details)
  }
  return body
}

// Refresh rotation: one in-flight request shared by all callers.
async function refresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, 'UNAUTHORIZED', 'Session expired')
        const body = await res.json()
        accessToken = body.accessToken
        return body
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export async function api(path, options = {}) {
  try {
    return await rawFetch(path, options)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && options._retry !== false) {
      await refresh()
      return rawFetch(path, { ...options, _retry: false })
    }
    throw err
  }
}

export async function signIn(email, password) {
  const body = await rawFetch('/auth/login', { method: 'POST', body: { email, password } })
  setAccessToken(body.accessToken)
  return body
}

export async function signUp({ name, email, password, businessName }) {
  const body = await rawFetch('/auth/signup', { method: 'POST', body: { name, email, password, businessName } })
  setAccessToken(body.accessToken)
  return body
}

export async function signOut() {
  try {
    await rawFetch('/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken('')
  }
}

// Attempt a silent re-auth on app boot (cookie may still be valid).
export async function restoreSession() {
  if (accessToken) return true
  try {
    const body = await refresh()
    return Boolean(body?.accessToken)
  } catch {
    return false
  }
}

export { ApiError }

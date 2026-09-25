const API_BASE = import.meta.env.VITE_API_URL || ''

const SESSION_KEY = 'ut:session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null
  } catch {
    return null
  }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function getToken() {
  return getSession()?.access_token || null
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message || 'Something went wrong.')
    this.status = status
    this.payload = payload
  }
}

function handleUnauthorized() {
  clearSession()
  window.dispatchEvent(new CustomEvent('ut:unauthorized'))
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

async function ensureCsrf() {
  if (readCookie('XSRF-TOKEN')) return
  await refreshCsrf()
}

export async function refreshCsrf() {
  try {
    await fetch(API_BASE + '/sanctum/csrf-cookie', { method: 'GET', credentials: 'include' })
  } catch {
    /* will surface as a network error on the actual request */
  }
}

export async function request(path, { method = 'GET', data, formData, headers: extra } = {}) {
  const opts = {
    method,
    headers: {
      Accept: 'application/json',
      ...(extra || {}),
    },
    credentials: 'include',
  }

  const token = getToken()
  if (token) opts.headers.Authorization = `Bearer ${token}`

  if (formData) {
    opts.body = formData
  } else if (data !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(data)
  }

  const isMutating = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
  if (isMutating) {
    await ensureCsrf()
    const xsrf = readCookie('XSRF-TOKEN')
    if (xsrf) opts.headers['X-XSRF-TOKEN'] = xsrf
  }

  let res
  try {
    res = await fetch(API_BASE + path, opts)
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    /* non-JSON body */
  }

  if (res.status === 401) {
    handleUnauthorized()
  }

  if (!res.ok) {
    let msg = 'Request failed.'
    if (json) {
      if (typeof json.message === 'string') {
        msg = json.message
      }
      if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
        const first = Object.entries(json.data).find(([, v]) => v && v.length)
        if (first) msg = Array.isArray(first[1]) ? first[1][0] : String(first[1])
      }
    }
    throw new ApiError(msg, res.status, json)
  }

  return (json && json.data !== undefined ? json.data : json) ?? null
}

export function normalizePage(res) {
  if (!res) return { items: [], page: 1, per_page: 15, last_page: 1, total: 0, from: 0, to: 0, next_url: null }
  if (Array.isArray(res)) {
    const items = res
    return { items, page: 1, per_page: items.length, last_page: 1, total: items.length, from: 1, to: items.length, next_url: null }
  }
  const items = Array.isArray(res.data) ? res.data : []
  // Laravel resource collections wrap the paginator: { data, links, meta }
  const meta = res.meta || res
  return {
    items,
    page: meta.current_page ?? 1,
    per_page: meta.per_page ?? items.length,
    last_page: meta.last_page ?? 1,
    total: meta.total ?? items.length,
    from: meta.from ?? 1,
    to: meta.to ?? items.length,
    next_url: res.links?.next || res.next_page_url || null,
  }
}

export function buildQuery(params) {
  const q = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return q ? `?${q}` : ''
}

export const ROLE_KEYS = {
  student: 'student',
  professor: 'professor',
  admin: 'admin',
}

export const LOGIN_PATHS = {
  student: '/api/auth/login',
  professor: '/api/prof/auth/login',
  admin: '/api/admin/auth/login',
}

export const LOGOUT_PATHS = {
  student: '/api/user/logout',
  professor: '/api/professor/auth/logout',
  admin: '/api/admin/auth/logout',
}

export const APP_ROOTS = {
  student: '/app/student',
  professor: '/app/professor',
  admin: '/app/admin',
}
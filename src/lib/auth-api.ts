import type { AuthUserPayload } from '../store/appStore'
import { ACCESS_TOKEN_REFRESH_SKEW_SEC } from '../config/auth'
import { apiBase } from './api-base'
import { clearSession, getAccessToken, getRefreshToken, notifyAuthChanged, setTokens } from './session'

type ProfileRow = {
  display_name?: string | null
  username?: string | null
  avatar_url?: string | null
  bio?: string | null
  default_city_id?: string | null
  subscription_tier?: string | null
} | null

export type TasteCategorySessionRow = { label: string }

export async function fetchAuthSession(): Promise<{
  user: AuthUserPayload | null
  profile: ProfileRow
  taste_categories: TasteCategorySessionRow[]
  /** User's saved taste labels from user_taste_selections (replaces legacy profile.user_taste_categories). */
  taste_selections: string[]
}> {
  const token = getAccessToken()
  const r = await fetch(`${apiBase()}/api/auth/session`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) {
    throw new Error(`session ${r.status}`)
  }
  return r.json() as Promise<{
    user: AuthUserPayload | null
    profile: ProfileRow
    taste_categories: TasteCategorySessionRow[]
    taste_selections: string[]
  }>
}

export async function postAnonymousSession(): Promise<void> {
  const r = await fetch(`${apiBase()}/api/auth/anonymous`, { method: 'POST' })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(t || `anonymous ${r.status}`)
  }
  const body = (await r.json()) as {
    access_token: string
    refresh_token?: string
  }
  setTokens({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  })
}

export function googleOAuthRedirectUrl(returnTo: string): string {
  const q = encodeURIComponent(returnTo)
  return `${apiBase()}/api/auth/oauth/google?return_to=${q}`
}

/** Same as googleOAuthRedirectUrl but skips the account chooser (for returning users). */
export function googleOAuthRedirectUrlNoPrompt(returnTo: string, loginHint?: string): string {
  const q = encodeURIComponent(returnTo)
  const hint = loginHint ? `&login_hint=${encodeURIComponent(loginHint)}` : ''
  return `${apiBase()}/api/auth/oauth/google?return_to=${q}&skip_prompt=1${hint}`
}

export async function postProfileTastePreferences(
  tasteLabels: string[],
): Promise<void> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('Not signed in')
  }
  const r = await fetch(`${apiBase()}/api/profile/taste`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tasteLabels }),
  })
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try {
      const j = (await r.json()) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
}

export async function postProfileDefaultCity(defaultCityId: string | null): Promise<void> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('Not signed in')
  }
  const r = await fetch(`${apiBase()}/api/profile/default-city`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ defaultCityId }),
  })
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try {
      const j = (await r.json()) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
}

export async function postSignOut(): Promise<void> {
  const refresh_token = getRefreshToken()
  await fetch(`${apiBase()}/api/auth/signout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  }).catch(() => {})
  clearSession()
}

async function parseErrorMessage(r: Response, fallback: string): Promise<string> {
  let msg = fallback
  try {
    const j = (await r.json()) as { error?: string; message?: string }
    if (j.error) msg = j.error
    else if (j.message) msg = j.message
  } catch {
    /* use fallback */
  }
  return msg
}

/** JWT payload `exp` is seconds since epoch. */
function accessTokenExpiresWithin(token: string, skewSeconds: number): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return true
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4)
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp !== 'number') return true
    const now = Math.floor(Date.now() / 1000)
    return payload.exp <= now + skewSeconds
  } catch {
    return true
  }
}

/**
 * Ensures a non-expired access token when a refresh token exists.
 * Call before authenticated uploads so short-lived JWTs are renewed proactively.
 */
export async function ensureAccessTokenFresh(): Promise<boolean> {
  const access = getAccessToken()
  if (!access) return false
  if (!accessTokenExpiresWithin(access, ACCESS_TOKEN_REFRESH_SKEW_SEC)) return true
  return refreshAccessToken()
}

function sessionRenewalFailedMessage(): string {
  if (!getRefreshToken()) {
    return 'Your session has expired. Reload the page to continue.'
  }
  return 'Could not renew your session. Reload the page or sign in again.'
}

function stillUnauthorizedHint(): string {
  const base =
    'Your session could not be accepted by the server. Reload the page or sign in again.'
  if (typeof window === 'undefined') return base
  const host = window.location.hostname
  if (host !== 'localhost' && host !== '127.0.0.1') return base
  return `${base} (Local dev: set SUPABASE_JWT_SECRET in gr-backend/.dev.vars to the JWT Secret from Supabase → Project Settings → API.)`
}

/** Upload avatar; updates `profiles.avatar_url` server-side. Proactively refreshes short-lived JWTs; retries once on 401. */
export async function postProfileAvatar(file: File): Promise<string> {
  if (!getAccessToken()) {
    throw new Error('Not signed in')
  }

  const renewed = await ensureAccessTokenFresh()
  if (!renewed) {
    throw new Error(sessionRenewalFailedMessage())
  }

  const upload = async () => {
    const token = getAccessToken()
    if (!token) {
      throw new Error('Not signed in')
    }
    const form = new FormData()
    form.append('file', file, file.name || 'avatar.jpg')
    return fetch(`${apiBase()}/api/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
  }

  let r = await upload()
  if (r.status === 401) {
    const ok = await refreshAccessToken()
    if (!ok) {
      throw new Error(sessionRenewalFailedMessage())
    }
    r = await upload()
  }

  if (r.status === 401) {
    if (import.meta.env.DEV) {
      console.warn(
        '[gigradar] Avatar upload still 401 after refresh — check SUPABASE_JWT_SECRET matches Supabase Project Settings → API.',
      )
    }
    throw new Error(stillUnauthorizedHint())
  }

  if (!r.ok) {
    throw new Error(await parseErrorMessage(r, `avatar ${r.status}`))
  }
  const body = (await r.json()) as { avatarUrl: string }
  notifyAuthChanged()
  return body.avatarUrl
}

export async function postDeleteAccount(): Promise<void> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('Not signed in')
  }
  const r = await fetch(`${apiBase()}/api/auth/delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    let msg = `delete-account ${r.status}`
    try {
      const j = (await r.json()) as { error?: string; message?: string }
      if (j.error) msg = j.error
      else if (j.message) msg = j.message
    } catch {
      /* use default */
    }
    throw new Error(msg)
  }
  clearSession()
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return false
  const r = await fetch(`${apiBase()}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token }),
  })
  if (!r.ok) return false
  const body = (await r.json()) as { access_token: string; refresh_token?: string }
  setTokens({ access_token: body.access_token, refresh_token: body.refresh_token })
  return true
}

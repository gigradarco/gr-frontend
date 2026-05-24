import {
  ACCESS_TOKEN_STORAGE_KEY,
  PENDING_HOME_COMPOSER_PREFILL_SESSION_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from '../config/storage'

/** Homepage composer prompt stashed before OAuth; opens Ask Buzo after sign-in when non-empty. */
export const SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY = PENDING_HOME_COMPOSER_PREFILL_SESSION_KEY

export function peekPendingHomeComposerPrefill(): string {
  if (typeof window === 'undefined') return ''
  try {
    return (window.sessionStorage.getItem(SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

/**
 * Set when OAuth / magic-link tokens are read from the URL hash.
 * Survives React Strict Mode's remount (the hash is gone on the second mount).
 * Cleared after a successful session sync that consumes the "fresh sign-in" flag in AuthSync.
 */
let oauthReturnPendingWelcome = false

export function peekOAuthReturnPendingWelcome(): boolean {
  return oauthReturnPendingWelcome
}

export function clearOAuthReturnPendingWelcome(): void {
  oauthReturnPendingWelcome = false
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setTokens(tokens: { access_token: string; refresh_token?: string | null }) {
  try {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.access_token)
    if (tokens.refresh_token) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token)
    }
  } catch {
    /* private mode */
  }
  notifyAuthChanged()
}

export function clearSession() {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  clearOAuthReturnPendingWelcome()
  notifyAuthChanged()
}

export function notifyAuthChanged() {
  window.dispatchEvent(new Event('buzo-auth-changed'))
}

function decodeAuthParam(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

function stripUrlToPathAndSearch(): void {
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`,
  )
}

function emitAuthHashError(message: string) {
  window.dispatchEvent(new CustomEvent('buzo-auth-hash-error', { detail: { message } }))
}

/**
 * After Supabase OAuth / magic link, tokens arrive in the URL `#hash` (implicit flow).
 * Some errors also arrive in the hash or `?error=` query. Clears the fragment/query and persists tokens.
 */
export function consumeOAuthHash(): boolean {
  const path = window.location.pathname
  const search = window.location.search

  const sp = new URLSearchParams(search)
  const qErr = sp.get('error_description') ?? sp.get('error')
  if (qErr) {
    window.history.replaceState(null, '', path)
    emitAuthHashError(decodeAuthParam(qErr))
    return false
  }

  const raw = window.location.hash?.replace(/^#/, '')
  if (!raw) return false

  const params = new URLSearchParams(raw)
  const errDesc = params.get('error_description') ?? params.get('error')
  if (errDesc) {
    stripUrlToPathAndSearch()
    emitAuthHashError(decodeAuthParam(errDesc))
    return false
  }

  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token) {
    stripUrlToPathAndSearch()
    return false
  }

  setTokens({ access_token, refresh_token })
  oauthReturnPendingWelcome = true
  stripUrlToPathAndSearch()
  return true
}

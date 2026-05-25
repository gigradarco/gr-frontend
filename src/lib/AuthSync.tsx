import { useEffect, type ReactNode } from 'react'
import { useAppState } from '../store/appStore'
import { warmAvatarCacheIfEmpty } from './avatar-image-cache.ts'
import { fetchAuthSession, refreshAccessToken } from './auth-api'
import {
  clearOAuthReturnPendingWelcome,
  consumeOAuthHash,
  getAccessToken,
  getRefreshToken,
  peekOAuthReturnPendingWelcome,
  peekPendingHomeComposerPrefill,
} from './session'
import { navigateShellToTab } from './tabRoutes'

function prewarmImage(url: string | null | undefined) {
  if (!url) return
  const src = url.trim()
  if (!src) return
  const img = new Image()
  img.decoding = 'async'
  img.src = src
}

/** Check if access token is expired (JWT exp claim). */
function isAccessTokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return true
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4)
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { exp?: number }
    if (typeof payload.exp !== 'number') return true
    const now = Math.floor(Date.now() / 1000)
    return payload.exp <= now
  } catch {
    return true
  }
}

/**
 * Hydrates profile UI from `GET /api/auth/session` and reacts to token changes.
 * OAuth / magic-link redirects put tokens in `location.hash`; `consumeOAuthHash` persists them.
 * Automatically refreshes access tokens every 50 minutes to keep sessions alive.
 */
export function AuthSync({ children }: { children: ReactNode }) {
  useEffect(() => {
    const onHashError = (ev: Event) => {
      const msg = (ev as CustomEvent<{ message: string }>).detail?.message
      if (msg) {
        useAppState.setState({ showSignIn: true, signInRedirectError: msg, signInPromptMessage: null })
      }
    }
    window.addEventListener('buzo-auth-hash-error', onHashError)
    consumeOAuthHash()

    // Detect Stripe post-checkout redirect (?subscription=success) and strip it
    // before the rest of the app renders. The session sync below will pick up the
    // updated subscription_tier from the DB, then we open the success overlay.
    const searchParams = new URLSearchParams(window.location.search)
    const isStripeSuccess = searchParams.get('subscription') === 'success'
    if (isStripeSuccess) {
      const url = new URL(window.location.href)
      url.searchParams.delete('subscription')
      window.history.replaceState(null, '', url.toString())
    }

    /**
     * `peekOAuthReturnPendingWelcome`: true after hash consumed — including across Strict Mode remount
     * (hash is stripped on first mount; latch clears only after session sync succeeds).
     */
    let markNextSessionSyncAsFreshSignIn = peekOAuthReturnPendingWelcome()

    let cancelled = false
    const sync = async () => {
      const isFreshSignIn = markNextSessionSyncAsFreshSignIn
      markNextSessionSyncAsFreshSignIn = false
      try {
        const { user, profile, taste_categories, taste_selections } = await fetchAuthSession()
        if (cancelled) return
        const avatarRemote = profile?.avatar_url?.trim()
        if (avatarRemote) {
          prewarmImage(avatarRemote)
          void warmAvatarCacheIfEmpty(avatarRemote)
        }
        const openAskAfterOAuth = isFreshSignIn && peekPendingHomeComposerPrefill().length > 0
        useAppState.getState().applySupabaseSession(user, profile, {
          isFreshSignIn,
          tasteCategories: taste_categories,
          tasteSelections: taste_selections,
        })
        if (isFreshSignIn) {
          clearOAuthReturnPendingWelcome()
          if (window.location.pathname !== '/event-list') {
            queueMicrotask(() =>
              navigateShellToTab(openAskAfterOAuth ? 'ask' : 'discover', { replace: true }),
            )
          }
        }
        // After session is hydrated with the fresh tier, open the subscription
        // screen in success mode so the user sees the "Welcome to Buzo Pro" overlay.
        if (isStripeSuccess) {
          queueMicrotask(() =>
            useAppState.setState({ showSubscription: true, stripeSuccessOverlay: true }),
          )
        }
      } catch {
        if (isFreshSignIn) {
          clearOAuthReturnPendingWelcome()
        }
        if (!cancelled) {
          const state = useAppState.getState()
          // If user was on profile tab when session expired, redirect to discover
          if (state.tab === 'profile' && state.isAuthenticated) {
            queueMicrotask(() => navigateShellToTab('discover', { replace: true }))
            state.applySupabaseSession(null, null)
            // Show sign-in sheet with logout message
            setTimeout(() => {
              useAppState.setState({ 
                showSignIn: true, 
                signInRedirectError: 'Your session has expired. Please sign in again.',
                signInPromptMessage: null,
              })
            }, 300)
          } else {
            state.applySupabaseSession(null, null)
          }
        }
      } finally {
        if (!cancelled) {
          useAppState.setState({ authSessionHydrated: true })
        }
      }
    }

    // On app load: refresh token if expired (handles users returning after closing app)
    const init = async () => {
      const accessToken = getAccessToken()
      const refreshToken = getRefreshToken()
      if (accessToken && refreshToken && isAccessTokenExpired(accessToken)) {
        await refreshAccessToken()
      }
      void sync()
    }

    void init()

    const onAuth = () => void sync()
    window.addEventListener('buzo-auth-changed', onAuth)

    // Auto-refresh tokens every 50 minutes (Supabase JWTs expire after 1 hour)
    const refreshInterval = setInterval(async () => {
      if (!getRefreshToken()) return
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        void sync()
      }
    }, 50 * 60 * 1000)

    return () => {
      cancelled = true
      clearInterval(refreshInterval)
      window.removeEventListener('buzo-auth-changed', onAuth)
      window.removeEventListener('buzo-auth-hash-error', onHashError)
    }
  }, [])

  return children
}

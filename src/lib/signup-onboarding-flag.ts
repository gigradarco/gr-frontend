import { SIGNUP_ONBOARDING_DISMISSED_KEY_PREFIX } from '../config/storage'

/**
 * After signup onboarding is completed or dismissed, we don't auto-open it again
 * for the same user. The flag is keyed by user ID so a new user on the same
 * device always gets the onboarding, regardless of previous users' sessions.
 */
let _currentUserId: string | null = null

export function setOnboardingFlagUserId(userId: string | null) {
  _currentUserId = userId
}

function key(): string | null {
  return _currentUserId ? `${SIGNUP_ONBOARDING_DISMISSED_KEY_PREFIX}${_currentUserId}` : null
}

export function readSignupOnboardingDismissed(): boolean {
  if (typeof window === 'undefined') return false
  const k = key()
  if (!k) return false
  try {
    return window.localStorage.getItem(k) === '1'
  } catch {
    return false
  }
}

export function persistSignupOnboardingDismissed() {
  const k = key()
  if (!k) return
  try {
    window.localStorage.setItem(k, '1')
  } catch {
    /* ignore */
  }
}

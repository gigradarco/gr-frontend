/** Single option for now; extend when you add locales. */
export const LANGUAGE_OPTIONS = [{ id: 'en', label: 'English' }] as const

export const PRIVACY_SAFETY_LAST_UPDATED = 'April 19, 2026'

/** Demo account values — replace with session/OAuth profile values. */
export const DEMO_EMAIL_LOGIN = {
  currentEmail: 'vincenzo@example.com',
  googleEmail: 'vincenzo.k@gmail.com',
} as const

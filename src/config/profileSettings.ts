/** Single option for now; extend when you add locales. */
export const LANGUAGE_OPTIONS = [{ id: 'en', label: 'English' }] as const

export const PRIVACY_SAFETY_LAST_UPDATED = 'April 19, 2026'

export const APP_RELEASE_LABEL = 'v0.1.0'

export const APP_RELEASE_NOTES = [
  {
    id: 'v0.1.0',
    label: APP_RELEASE_LABEL,
    date: 'May 27, 2026',
    title: 'Buzo v0.1.0',
    summary: 'Sharper profile controls and a clearer path from discovery to planning.',
    highlights: [
      'Manage Buzo Pro from Settings, including subscription status and billing actions.',
      'Update your default city and category preferences without restarting onboarding.',
      'Switch between dark and light appearance from Preferences.',
      'Edit profile details, send feedback, and review privacy controls from one Settings flow.',
    ],
  },
  {
    id: 'v0.0.9',
    label: 'v0.0.9',
    date: 'May 2026',
    title: 'Planning and profile foundation',
    summary: 'Core surfaces for saving gigs, tracking intent, and building a richer taste profile.',
    highlights: [
      'Save favourite events and keep planned gigs accessible from the main tabs.',
      'View buzz points and reputation signals from Profile.',
      'Explore Singapore event recommendations with city-aware defaults.',
    ],
  },
] as const

/** Demo account values — replace with session/OAuth profile values. */
export const DEMO_EMAIL_LOGIN = {
  currentEmail: 'vincenzo@example.com',
  googleEmail: 'vincenzo.k@gmail.com',
} as const

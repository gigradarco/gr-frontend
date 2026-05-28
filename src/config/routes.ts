import type { Tab } from '../types'

/** Canonical paths for main shell tabs (mobile web). */
export const TAB_PATHS: Record<Tab, string> = {
  discover: '/discover',
  ask: '/ask-buzo',
  plan: '/plan',
  profile: '/profile',
  favorites: '/favorites',
}

/** Plan sub-routes within the Plan tab shell. */
export const PLAN_PATHS = {
  hub: '/plan',
  weather: '/plan/weather',
  scheduled: '/plan/scheduled',
} as const

export type PlanShellView = 'hub' | 'weather' | 'scheduled'

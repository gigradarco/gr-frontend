import type { Tab } from '../types'

/** Ask Buzo sub-routes within the Ask tab shell. */
export const ASK_BUZO_PATHS = {
  root: '/ask-buzo',
  chat: '/ask-buzo/chat',
  bats: '/ask-buzo/bats',
  batsSwitch: '/ask-buzo/bats/switch',
  batsMatch: '/ask-buzo/bats/match',
} as const

export type AskBuzoShellView = 'chat' | 'bats' | 'batsSwitch' | 'batsMatch'

/** Canonical paths for main shell tabs (mobile web). */
export const TAB_PATHS: Record<Tab, string> = {
  discover: '/discover',
  ask: ASK_BUZO_PATHS.chat,
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

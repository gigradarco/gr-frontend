import type { NavigateFunction } from 'react-router-dom'
import {
  ASK_BUZO_PATHS,
  PLAN_PATHS,
  TAB_PATHS,
  type AskBuzoShellView,
  type PlanShellView,
} from '../config/routes'
import type { Tab } from '../types'
export { ASK_BUZO_PATHS, TAB_PATHS, PLAN_PATHS, type AskBuzoShellView, type PlanShellView } from '../config/routes'

const PATH_TO_TAB = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
) as Record<string, Tab>

const KNOWN_PLAN_PATHS = new Set<string>([
  PLAN_PATHS.hub,
  PLAN_PATHS.weather,
  PLAN_PATHS.scheduled,
])

const KNOWN_ASK_BUZO_PATHS = new Set<string>([
  ASK_BUZO_PATHS.chat,
  ASK_BUZO_PATHS.bats,
  ASK_BUZO_PATHS.batsSwitch,
  ASK_BUZO_PATHS.batsMatch,
])

export function normalizeShellPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function pathToTab(pathname: string): Tab | null {
  const p = normalizeShellPath(pathname)
  if (p.startsWith('/discover/')) return 'discover'
  if (p === ASK_BUZO_PATHS.root || p.startsWith(`${ASK_BUZO_PATHS.root}/`)) return 'ask'
  if (p === PLAN_PATHS.hub || p.startsWith(`${PLAN_PATHS.hub}/`)) return 'plan'
  return PATH_TO_TAB[p] ?? null
}

export function isKnownAskBuzoPath(pathname: string): boolean {
  const p = normalizeShellPath(pathname)
  return KNOWN_ASK_BUZO_PATHS.has(p)
}

export function askBuzoShellViewFromPath(pathname: string): AskBuzoShellView {
  const p = normalizeShellPath(pathname)
  if (p === ASK_BUZO_PATHS.bats) return 'bats'
  if (p === ASK_BUZO_PATHS.batsSwitch) return 'batsSwitch'
  if (p === ASK_BUZO_PATHS.batsMatch) return 'batsMatch'
  return 'chat'
}

export function isKnownPlanPath(pathname: string): boolean {
  const p = normalizeShellPath(pathname)
  if (KNOWN_PLAN_PATHS.has(p)) return true
  return planScheduledEventIdFromPath(pathname) != null
}

export function planShellViewFromPath(pathname: string): PlanShellView {
  const p = normalizeShellPath(pathname)
  if (p === PLAN_PATHS.weather) return 'weather'
  if (p === PLAN_PATHS.scheduled || p.startsWith(`${PLAN_PATHS.scheduled}/`)) return 'scheduled'
  return 'hub'
}

export function planScheduledEventIdFromPath(pathname: string): string | null {
  const p = normalizeShellPath(pathname)
  const prefix = `${PLAN_PATHS.scheduled}/`
  if (!p.startsWith(prefix)) return null
  const raw = p.slice(prefix.length)
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function getPlanScheduledEventPath(eventId: string): string {
  return `${PLAN_PATHS.scheduled}/${encodeURIComponent(eventId)}`
}

export function getPlanPathForView(view: PlanShellView): string {
  if (view === 'weather') return PLAN_PATHS.weather
  if (view === 'scheduled') return PLAN_PATHS.scheduled
  return PLAN_PATHS.hub
}

export function discoverEventIdFromPath(pathname: string): string | null {
  const p = normalizeShellPath(pathname)
  const prefix = '/discover/'
  if (!p.startsWith(prefix)) return null
  const raw = p.slice(prefix.length)
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function getDiscoverEventPath(eventId: string): string {
  return `/discover/${encodeURIComponent(eventId)}`
}

export function getPathForTab(tab: Tab): string {
  return TAB_PATHS[tab]
}

let shellNavigate: NavigateFunction | null = null

export function setShellNavigate(fn: NavigateFunction | null) {
  shellNavigate = fn
}

export function navigateShellToTab(tab: Tab, opts?: { replace?: boolean }) {
  const path = getPathForTab(tab)
  shellNavigate?.(path, { replace: opts?.replace ?? false })
}

export function navigateShellToPath(path: string, opts?: { replace?: boolean }) {
  shellNavigate?.(path, { replace: opts?.replace ?? false })
}

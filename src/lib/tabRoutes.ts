import type { NavigateFunction } from 'react-router-dom'
import type { Tab } from '../types'

/** Canonical paths for main shell tabs (mobile web). */
export const TAB_PATHS: Record<Tab, string> = {
  discover: '/discover',
  ask: '/ask-buzo',
  plan: '/plan',
  profile: '/profile',
  favorites: '/favorites',
}

const PATH_TO_TAB = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]),
) as Record<string, Tab>

export function normalizeShellPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function pathToTab(pathname: string): Tab | null {
  const p = normalizeShellPath(pathname)
  if (p.startsWith('/discover/')) return 'discover'
  return PATH_TO_TAB[p] ?? null
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

import { FAVORITES_CONFIG } from '../config/favorites'
import { FAVORITES_DETAIL_CACHE_STORAGE_KEY } from '../config/storage'
import type { FavoriteEvent } from '../store/appStore'

type CachedFavoriteEvent = FavoriteEvent & {
  cachedAt: number
}

type FavoriteDetailCache = Record<string, CachedFavoriteEvent>

function readRawCache(): FavoriteDetailCache {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(FAVORITES_DETAIL_CACHE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: FavoriteDetailCache = {}
    for (const [id, row] of Object.entries(parsed as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      if (
        typeof id === 'string' &&
        typeof r.id === 'string' &&
        typeof r.title === 'string' &&
        typeof r.venueLine === 'string' &&
        typeof r.timeLabel === 'string' &&
        typeof r.image === 'string' &&
        typeof r.cachedAt === 'number' &&
        (r.variant === 'upcoming' || r.variant === 'past')
      ) {
        out[id] = {
          id: r.id,
          title: r.title,
          venueLine: r.venueLine,
          timeLabel: r.timeLabel,
          image: r.image,
          variant: r.variant,
          cachedAt: r.cachedAt,
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeRawCache(cache: FavoriteDetailCache) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITES_DETAIL_CACHE_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore quota / private mode */
  }
}

export function readFreshFavoriteDetails(ids: string[], now = Date.now()): Record<string, FavoriteEvent> {
  const cache = readRawCache()
  const out: Record<string, FavoriteEvent> = {}
  for (const id of ids) {
    const row = cache[id]
    if (!row) continue
    if (now - row.cachedAt > FAVORITES_CONFIG.cacheFreshMs) continue
    out[id] = {
      id: row.id,
      title: row.title,
      venueLine: row.venueLine,
      timeLabel: row.timeLabel,
      image: row.image,
      variant: row.variant,
    }
  }
  return out
}

export function upsertFavoriteDetailCache(events: FavoriteEvent[], now = Date.now()) {
  if (events.length === 0) return
  const cache = readRawCache()
  for (const event of events) {
    cache[event.id] = { ...event, cachedAt: now }
  }
  writeRawCache(cache)
}

export function pruneFavoriteDetailCache(allowedIds: string[]) {
  const allowed = new Set(allowedIds)
  const cache = readRawCache()
  let changed = false
  for (const id of Object.keys(cache)) {
    if (!allowed.has(id)) {
      delete cache[id]
      changed = true
    }
  }
  if (changed) writeRawCache(cache)
}

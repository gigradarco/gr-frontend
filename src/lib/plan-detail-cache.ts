import { PLAN_CONFIG } from '../config/plan'
import { PLAN_DETAIL_CACHE_STORAGE_KEY } from '../config/storage'
import type { EventItem } from '../types'

export type PlanSegment = 'upcoming' | 'past'

export type PlanCachedRow = {
  event: EventItem
  segment: PlanSegment
}

type CachedPlanEvent = EventItem & {
  cachedAt: number
  segment: PlanSegment
}

type PlanDetailCache = Record<string, CachedPlanEvent>

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseEventItem(row: Record<string, unknown>): EventItem | null {
  if (
    typeof row.id !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.venue !== 'string' ||
    typeof row.district !== 'string' ||
    typeof row.time !== 'string' ||
    typeof row.genre !== 'string' ||
    typeof row.exploreCategoryId !== 'string' ||
    typeof row.locationCityId !== 'string' ||
    typeof row.verified !== 'number' ||
    typeof row.image !== 'string' ||
    typeof row.host !== 'string' ||
    typeof row.hostPrompt !== 'string' ||
    typeof row.friendsGoing !== 'number' ||
    !isStringArray(row.vibeTags) ||
    typeof row.ticketPrice !== 'string'
  ) {
    return null
  }

  return {
    id: row.id,
    title: row.title,
    venue: row.venue,
    district: row.district,
    time: row.time,
    eventDateTime: typeof row.eventDateTime === 'string' || row.eventDateTime === null ? row.eventDateTime : undefined,
    displayDateTimeLabel: typeof row.displayDateTimeLabel === 'string' ? row.displayDateTimeLabel : undefined,
    genre: row.genre,
    exploreCategoryId: row.exploreCategoryId,
    locationCityId: row.locationCityId,
    verified: row.verified,
    image: row.image,
    host: row.host,
    hostPrompt: row.hostPrompt,
    friendsGoing: row.friendsGoing,
    vibeTags: row.vibeTags,
    ticketPrice: row.ticketPrice,
    bpReward: typeof row.bpReward === 'number' ? row.bpReward : undefined,
    buzzPct: typeof row.buzzPct === 'number' ? row.buzzPct : undefined,
    lat: typeof row.lat === 'number' ? row.lat : undefined,
    lng: typeof row.lng === 'number' ? row.lng : undefined,
    sourceUrl: typeof row.sourceUrl === 'string' || row.sourceUrl === null ? row.sourceUrl : undefined,
  }
}

function readRawCache(): PlanDetailCache {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PLAN_DETAIL_CACHE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: PlanDetailCache = {}
    for (const [id, row] of Object.entries(parsed as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const event = parseEventItem(r)
      if (
        typeof id === 'string' &&
        event &&
        typeof r.cachedAt === 'number' &&
        (r.segment === 'upcoming' || r.segment === 'past')
      ) {
        out[id] = { ...event, cachedAt: r.cachedAt, segment: r.segment }
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeRawCache(cache: PlanDetailCache) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PLAN_DETAIL_CACHE_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore quota / private mode */
  }
}

export function readFreshPlanDetails(ids: string[], now = Date.now()): Record<string, PlanCachedRow> {
  const cache = readRawCache()
  const out: Record<string, PlanCachedRow> = {}
  for (const id of ids) {
    const row = cache[id]
    if (!row) continue
    if (now - row.cachedAt > PLAN_CONFIG.cacheFreshMs) continue
    const { cachedAt: _cachedAt, segment, ...event } = row
    out[id] = { event, segment }
  }
  return out
}

export function upsertPlanDetailCache(rows: PlanCachedRow[], now = Date.now()) {
  if (rows.length === 0) return
  const cache = readRawCache()
  for (const row of rows) {
    cache[row.event.id] = { ...row.event, cachedAt: now, segment: row.segment }
  }
  writeRawCache(cache)
}

export function prunePlanDetailCache(allowedIds: string[]) {
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

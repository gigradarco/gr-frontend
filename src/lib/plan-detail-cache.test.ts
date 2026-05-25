import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAN_CONFIG } from '../config/plan'
import type { EventItem } from '../types'
import {
  prunePlanDetailCache,
  readFreshPlanDetails,
  upsertPlanDetailCache,
} from './plan-detail-cache'

function localStorageMock(): Pick<Storage, 'clear' | 'getItem' | 'removeItem' | 'setItem'> {
  const rows = new Map<string, string>()
  return {
    clear: () => rows.clear(),
    getItem: (key) => rows.get(key) ?? null,
    removeItem: (key) => rows.delete(key),
    setItem: (key, value) => rows.set(key, value),
  }
}

function event(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'event-1',
    title: 'Warehouse Techno',
    venue: 'Marquee',
    district: 'Marina Bay',
    time: 'Tonight 22:30',
    genre: 'LIVE MUSIC',
    exploreCategoryId: 'arts',
    locationCityId: 'singapore',
    verified: 0,
    image: 'https://cdn.example.com/event.jpg',
    host: 'Host',
    hostPrompt: 'Summary',
    friendsGoing: 0,
    vibeTags: ['techno'],
    ticketPrice: '0.00 SGD',
    ...overrides,
  }
}

describe('plan detail cache', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock(),
    })
  })

  it('returns cached plan details while they are fresh', () => {
    const now = 1_000
    const row = { event: event(), segment: 'upcoming' as const }
    upsertPlanDetailCache([row], now)

    expect(readFreshPlanDetails([row.event.id], now + PLAN_CONFIG.cacheFreshMs - 1)).toEqual({
      [row.event.id]: row,
    })
  })

  it('ignores cached plan details after the freshness window', () => {
    const now = 1_000
    const row = { event: event(), segment: 'upcoming' as const }
    upsertPlanDetailCache([row], now)

    expect(readFreshPlanDetails([row.event.id], now + PLAN_CONFIG.cacheFreshMs + 1)).toEqual({})
  })

  it('prunes cache rows that are no longer planned', () => {
    const now = 1_000
    const kept = { event: event({ id: 'event-kept', title: 'Kept Event' }), segment: 'upcoming' as const }
    const removed = { event: event({ id: 'event-removed', title: 'Removed Event' }), segment: 'past' as const }
    upsertPlanDetailCache([kept, removed], now)

    prunePlanDetailCache([kept.event.id])

    expect(readFreshPlanDetails([kept.event.id, removed.event.id], now)).toEqual({
      [kept.event.id]: kept,
    })
  })
})

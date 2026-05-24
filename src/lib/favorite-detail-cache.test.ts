import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FAVORITES_CONFIG } from '../config/favorites'
import type { FavoriteEvent } from '../store/appStore'
import {
  pruneFavoriteDetailCache,
  readFreshFavoriteDetails,
  upsertFavoriteDetailCache,
} from './favorite-detail-cache'

function localStorageMock(): Pick<Storage, 'clear' | 'getItem' | 'removeItem' | 'setItem'> {
  const rows = new Map<string, string>()
  return {
    clear: () => rows.clear(),
    getItem: (key) => rows.get(key) ?? null,
    removeItem: (key) => rows.delete(key),
    setItem: (key, value) => rows.set(key, value),
  }
}

function favorite(overrides: Partial<FavoriteEvent> = {}): FavoriteEvent {
  return {
    id: 'event-1',
    title: 'Warehouse Techno',
    venueLine: 'Marquee, Marina Bay',
    timeLabel: 'Tonight 22:30',
    image: 'https://cdn.example.com/event.jpg',
    variant: 'upcoming',
    ...overrides,
  }
}

describe('favorite detail cache', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock(),
    })
  })

  it('returns cached favorite details while they are fresh', () => {
    const now = 1_000
    const event = favorite()
    upsertFavoriteDetailCache([event], now)

    expect(readFreshFavoriteDetails([event.id], now + FAVORITES_CONFIG.cacheFreshMs - 1)).toEqual({
      [event.id]: event,
    })
  })

  it('ignores cached favorite details after the freshness window', () => {
    const now = 1_000
    const event = favorite()
    upsertFavoriteDetailCache([event], now)

    expect(readFreshFavoriteDetails([event.id], now + FAVORITES_CONFIG.cacheFreshMs + 1)).toEqual({})
  })

  it('prunes cache rows that are no longer favorited', () => {
    const now = 1_000
    const kept = favorite({ id: 'event-kept', title: 'Kept Event' })
    const removed = favorite({ id: 'event-removed', title: 'Removed Event' })
    upsertFavoriteDetailCache([kept, removed], now)

    pruneFavoriteDetailCache([kept.id])

    expect(readFreshFavoriteDetails([kept.id, removed.id], now)).toEqual({
      [kept.id]: kept,
    })
  })
})

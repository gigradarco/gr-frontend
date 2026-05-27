import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventItem } from '../../types'
import { DEFAULT_DISCOVER_FILTERS } from '../../lib/discover-filters'
import { eventMatchesFilters } from './EventCardFeed'

function makeEvent(eventDateTime: string): EventItem {
  return {
    id: 'evt-1',
    title: 'Test Event',
    venue: 'Test Venue',
    district: 'Test District',
    time: 'Date TBA',
    displayDateTimeLabel: 'Date TBA',
    eventDateTime,
    genre: 'live-music',
    exploreCategoryId: 'live-music',
    locationCityId: 'singapore',
    verified: 0,
    image: '',
    host: '',
    hostPrompt: '',
    friendsGoing: 0,
    vibeTags: [],
    ticketPrice: 'Not available',
  }
}

describe('EventCardFeed date filters', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses Singapore day boundary for Tonight filter', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-26T16:30:00.000Z')) // 2026-06-27 00:30 in Singapore

    const filters = { ...DEFAULT_DISCOVER_FILTERS, date: 'Tonight' as const }
    const eventTonight = makeEvent('2026-06-27T01:00:00+08:00')
    const eventYesterday = makeEvent('2026-06-26T21:00:00+08:00')

    expect(eventMatchesFilters(eventTonight, filters)).toBe(true)
    expect(eventMatchesFilters(eventYesterday, filters)).toBe(false)
  })
})

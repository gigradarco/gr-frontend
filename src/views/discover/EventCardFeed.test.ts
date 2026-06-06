import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventItem } from '../../types'
import { DEFAULT_DISCOVER_FILTERS } from '../../lib/discover-filters'
import { eventMatchesFilters, getEventDateTag, getEventTopTimeLabel } from './EventCardFeed'

function makeEvent(eventDateTime: string, displayDateTimeLabel = 'Date TBA'): EventItem {
  return {
    id: 'evt-1',
    title: 'Test Event',
    venue: 'Test Venue',
    district: 'Test District',
    time: displayDateTimeLabel,
    displayDateTimeLabel,
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

describe('getEventDateTag', () => {
  const now = new Date('2026-06-02T00:00:00+08:00')

  it('uses urgency labels from full display labels', () => {
    const event = makeEvent('2026-06-02T00:00:00+08:00', 'Tue 02 Jun · Tonight 00:00')

    expect(getEventDateTag(event, now)).toBe('TONIGHT')
  })

  it('labels upcoming events within seven days as this week', () => {
    const event = makeEvent('2026-06-06T20:00:00+08:00', 'Sat 06 Jun · 20:00')

    expect(getEventDateTag(event, now)).toBe('THIS WEEK')
  })

  it('labels later same-month events as this month', () => {
    const event = makeEvent('2026-06-23T20:00:00+08:00', 'Tue 23 Jun · 20:00')

    expect(getEventDateTag(event, now)).toBe('THIS MONTH')
  })

  it('uses month and year for longer-range events', () => {
    const event = makeEvent('2026-09-15T20:00:00+08:00', 'Tue 15 Sep · 20:00')

    expect(getEventDateTag(event, now)).toBe('SEPT 2026')
  })
})

describe('getEventTopTimeLabel', () => {
  it('removes urgency words already shown by the top date tag', () => {
    const event = makeEvent('2026-06-06T00:00:00+08:00', 'Sat 06 Jun · Tonight 00:00')

    expect(getEventTopTimeLabel(event)).toBe('Sat 06 Jun · 00:00')
  })

  it('keeps compact time-only labels unchanged', () => {
    const event = makeEvent('2026-06-06T22:30:00+08:00', '22:30')

    expect(getEventTopTimeLabel(event)).toBe('22:30')
  })
})

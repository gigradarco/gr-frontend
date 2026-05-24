import { describe, expect, it } from 'vitest'
import type { EventItem } from '../types'
import { mapDiscoverEventListItemToEventItem, trimEventWindow } from './useDiscoverEvents'

function eventItem(id: string): EventItem {
  return {
    id,
    title: `Event ${id}`,
    venue: 'Venue',
    district: 'District',
    time: 'Tonight 22:30',
    genre: 'Techno',
    exploreCategoryId: 'club-nights',
    locationCityId: 'singapore',
    verified: 0,
    image: '',
    host: '',
    hostPrompt: '',
    friendsGoing: 0,
    vibeTags: [],
    ticketPrice: '42.00 SGD',
  }
}

describe('mapDiscoverEventListItemToEventItem', () => {
  it('does not require sourceUrl on public list items', () => {
    const event = mapDiscoverEventListItemToEventItem({
      id: 'event-1',
      title: 'Warehouse Techno',
      venue: 'Marquee',
      district: 'Marina Bay',
      category: 'Techno',
      categoryId: 'club-nights',
      locationCityId: 'singapore',
      eventDateTime: '2026-05-22T14:30:00.000Z',
      displayDateTimeLabel: 'Tonight 22:30',
      imageUrl: '',
      host: 'Buzo',
      summary: 'Peak energy',
      tags: ['techno'],
      ticketPrice: '42.00 SGD',
      lat: 1.28,
      lng: 103.85,
    })

    expect(event.sourceUrl).toBeNull()
    expect(event.image).toContain('/api/image-proxy?')
    expect(decodeURIComponent(event.image)).toContain('https://images.unsplash.com/')
  })
})

describe('trimEventWindow', () => {
  it('keeps the current window untouched below the hard render limit', () => {
    const events = Array.from({ length: 180 }, (_, index) => eventItem(`event-${index}`))

    expect(trimEventWindow(events)).toBe(events)
  })

  it('trims to the newest soft window above the hard render limit', () => {
    const events = Array.from({ length: 181 }, (_, index) => eventItem(`event-${index}`))
    const trimmed = trimEventWindow(events)

    expect(trimmed).toHaveLength(120)
    expect(trimmed[0]?.id).toBe('event-61')
    expect(trimmed.at(-1)?.id).toBe('event-180')
  })
})

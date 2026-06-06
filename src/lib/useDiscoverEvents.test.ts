import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventItem } from '../types'
import {
  diversifyRepeatedEventImages,
  mapDiscoverEventListItemToEventItem,
  normalizeExternalEventSourceUrl,
  openDiscoverEventSource,
  trimEventWindow,
} from './useDiscoverEvents'

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

function discoverEventDetail(sourceUrl: string | null) {
  return {
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
    sourceUrl,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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
    expect(decodeURIComponent(event.image)).toMatch(/images\.unsplash\.com|picsum\.photos/)
  })
})

describe('diversifyRepeatedEventImages', () => {
  it('keeps the first real image and replaces later duplicate images with event-specific fallbacks', () => {
    const duplicateImage = '/api/image-proxy?url=https%3A%2F%2Fcdn.example.com%2Frepeated.jpg&w=1200&q=80'
    const events = [
      { ...eventItem('event-1'), image: duplicateImage, title: 'First show' },
      { ...eventItem('event-2'), image: duplicateImage, title: 'Second show' },
      { ...eventItem('event-3'), image: duplicateImage, title: 'Third show' },
    ]

    const diversified = diversifyRepeatedEventImages(events)

    expect(diversified[0]?.image).toBe(duplicateImage)
    expect(diversified[1]?.image).not.toBe(duplicateImage)
    expect(diversified[2]?.image).not.toBe(duplicateImage)
    expect(new Set(diversified.map((event) => event.image)).size).toBe(3)
    expect(decodeURIComponent(diversified[1]?.image ?? '')).toMatch(/images\.unsplash\.com|picsum\.photos/)
  })
})

describe('normalizeExternalEventSourceUrl', () => {
  it('accepts http URLs and normalizes schemeless public URLs', () => {
    expect(normalizeExternalEventSourceUrl('https://example.com/events/1')).toBe('https://example.com/events/1')
    expect(normalizeExternalEventSourceUrl('//example.com/events/1')).toBe('https://example.com/events/1')
    expect(normalizeExternalEventSourceUrl('example.com/events/1')).toBe('https://example.com/events/1')
  })

  it('rejects non-http event source URLs', () => {
    expect(normalizeExternalEventSourceUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeExternalEventSourceUrl('/internal/path')).toBeNull()
    expect(normalizeExternalEventSourceUrl('')).toBeNull()
  })
})

describe('openDiscoverEventSource', () => {
  it('opens a direct source URL without fetching detail', async () => {
    const open = vi.fn()
    const fetch = vi.fn()
    vi.stubGlobal('window', { open })
    vi.stubGlobal('fetch', fetch)

    await openDiscoverEventSource('event-1', 'example.com/events/1')

    expect(open).toHaveBeenCalledWith('https://example.com/events/1', '_blank', 'noopener,noreferrer')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('pre-opens a tab and navigates it after fetching the detail source URL', async () => {
    const replace = vi.fn()
    const pendingWindow = {
      opener: {},
      closed: false,
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      location: {
        replace,
      },
      close: vi.fn(),
    }
    const open = vi.fn(() => pendingWindow)
    const fetch = vi.fn(async () => new Response(JSON.stringify(discoverEventDetail('https://example.com/events/1'))))
    const onFallback = vi.fn()
    vi.stubGlobal('window', { open })
    vi.stubGlobal('fetch', fetch)

    await openDiscoverEventSource('event-1', null, onFallback)

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/discover/events/event-1'), {
      credentials: 'include',
      signal: undefined,
    })
    expect(replace).toHaveBeenCalledWith('https://example.com/events/1')
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('closes the pending tab and falls back when detail has no valid source URL', async () => {
    const pendingWindow = {
      opener: {},
      closed: false,
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      location: {
        replace: vi.fn(),
      },
      close: vi.fn(),
    }
    const open = vi.fn(() => pendingWindow)
    const fetch = vi.fn(async () => new Response(JSON.stringify(discoverEventDetail(null))))
    const onFallback = vi.fn()
    vi.stubGlobal('window', { open })
    vi.stubGlobal('fetch', fetch)

    await openDiscoverEventSource('event-1', null, onFallback)

    expect(pendingWindow.close).toHaveBeenCalled()
    expect(onFallback).toHaveBeenCalledTimes(1)
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

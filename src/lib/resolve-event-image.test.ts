import { describe, expect, it } from 'vitest'
import type { EventItem } from '../types'
import {
  describeImageState,
  imageUrlsForRow,
  resolveEventImagePlaceholder,
  resolveListImage,
  rowHasFailedImageLoad,
} from './resolve-event-image'
import { isSplashImageUrl } from './splash-images'

function eventItem(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: 'event-1',
    title: 'Warehouse Techno',
    venue: 'Marquee',
    district: 'Marina Bay',
    time: 'Tonight 22:30',
    genre: 'Techno',
    exploreCategoryId: 'club-nights',
    locationCityId: 'singapore',
    verified: 0,
    image: '',
    host: 'Buzo',
    hostPrompt: '',
    friendsGoing: 0,
    vibeTags: [],
    ticketPrice: '42.00 SGD',
    ...overrides,
  }
}

describe('resolveListImage', () => {
  it('uses a valid event_img first', () => {
    const event = eventItem()
    const resolved = resolveListImage({ event_img: 'https://cdn.example.com/event.jpg' }, event)

    expect(resolved).toEqual({
      url: 'https://cdn.example.com/event.jpg',
      source: 'event-img',
    })
  })

  it('routes raw Unsplash event_img values through the generated splash bucket', () => {
    const event = eventItem()
    const raw = {
      event_id: event.id,
      event_img: 'https://images.unsplash.com/photo-000000000000?auto=format&fit=crop&w=1200&q=80',
      category: 'Techno',
      title: event.title,
    }

    const resolved = resolveListImage(raw, event)

    expect(resolved.source).toBe('splash-img')
    expect(isSplashImageUrl(resolved.url)).toBe(true)
    expect(resolved.url).toBe(resolveEventImagePlaceholder(raw, event))
  })

  it('falls through to fallback_event_img when event_img has failed', () => {
    const event = eventItem()
    const eventUrl = 'https://cdn.example.com/broken.jpg'
    const fallbackUrl = 'https://cdn.example.com/fallback.jpg'

    const resolved = resolveListImage(
      { event_img: eventUrl, fallback_event_img: fallbackUrl },
      event,
      new Set([eventUrl]),
    )

    expect(resolved).toEqual({
      url: fallbackUrl,
      source: 'fallback-img',
    })
  })

  it('skips non-http fallback values and records a warning', () => {
    const event = eventItem()
    const raw = {
      event_id: event.id,
      category: 'Techno',
      fallback_event_img: '[object Blob]',
      title: event.title,
    }

    const state = describeImageState({ raw, item: event })

    expect(state.source).toBe('splash-img')
    expect(state.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'fallback_event_img is not an http(s) URL, so it was skipped.',
          severity: 'warning',
          source: 'fallback-img',
        }),
      ]),
    )
  })

  it('returns an empty image when every candidate failed', () => {
    const event = eventItem()
    const raw = {
      event_id: event.id,
      event_img: 'https://cdn.example.com/broken.jpg',
      fallback_event_img: 'https://cdn.example.com/fallback-broken.jpg',
      category: 'Techno',
      title: event.title,
    }
    const failed = new Set([
      'https://cdn.example.com/broken.jpg',
      'https://cdn.example.com/fallback-broken.jpg',
      resolveEventImagePlaceholder(raw, event),
    ])

    expect(resolveListImage(raw, event, failed)).toEqual({ url: '', source: null })
    expect(rowHasFailedImageLoad({ raw, item: event }, failed)).toBe(true)
  })

  it('dedupes repeated display candidates', () => {
    const event = eventItem()
    const raw = {
      event_img: 'https://cdn.example.com/same.jpg',
      fallback_event_img: 'https://cdn.example.com/same.jpg',
    }

    expect(imageUrlsForRow({ raw, item: event })).toEqual(['https://cdn.example.com/same.jpg'])
  })
})

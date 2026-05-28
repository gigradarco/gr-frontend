import { describe, expect, it } from 'vitest'
import type { EventItem } from '../../../types'
import { buildDiscoverMapMarkers } from './map-clustering'
import type { EventMapPoint, LatLng } from './map-geo'

function makePoint(id: string, pos: LatLng): EventMapPoint {
  const event: EventItem = {
    id,
    title: id,
    venue: 'Test venue',
    district: 'Singapore',
    time: 'Fri 29 May · Tonight 00:00',
    displayDateTimeLabel: 'Fri 29 May · Tonight 00:00',
    genre: 'Live Music',
    exploreCategoryId: 'live-music',
    locationCityId: 'singapore',
    verified: 0,
    image: '',
    host: '',
    hostPrompt: '',
    friendsGoing: 0,
    vibeTags: [],
    ticketPrice: 'Not available',
    lat: pos[0],
    lng: pos[1],
  }
  return { event, pos }
}

describe('buildDiscoverMapMarkers', () => {
  it('uses compact offset clusters at default city zoom', () => {
    const markers = buildDiscoverMapMarkers(
      [
        makePoint('a', [1.29, 103.85]),
        makePoint('b', [1.299, 103.85]),
        makePoint('c', [1.29, 103.859]),
      ],
      10.8,
    )

    expect(markers).toHaveLength(3)
    expect(markers.every((marker) => marker.type === 'cluster')).toBe(true)
    expect(markers.every((marker) => marker.type === 'cluster' && marker.compact)).toBe(true)

    const offsets = markers.map((marker) => (marker.type === 'cluster' ? marker.offset?.join(',') : null))
    expect(new Set(offsets).size).toBe(3)
  })

  it('returns individual event markers after zooming in', () => {
    const markers = buildDiscoverMapMarkers(
      [
        makePoint('a', [1.29, 103.85]),
        makePoint('b', [1.299, 103.85]),
      ],
      15,
    )

    expect(markers).toHaveLength(2)
    expect(markers.every((marker) => marker.type === 'event')).toBe(true)
  })
})

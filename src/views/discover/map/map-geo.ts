import type { EventItem } from '../../../types'

export type LatLng = [number, number]
export type LngLat = [number, number]

export type EventMapPoint = {
  event: EventItem
  pos: LatLng
}

export function eventLatLng(event: EventItem): LatLng | null {
  if (!Number.isFinite(event.lat) || !Number.isFinite(event.lng)) return null
  return [event.lat as number, event.lng as number]
}

export function latLngToLngLat(pos: LatLng): LngLat {
  return [pos[1], pos[0]]
}

export function lngLatToLatLng(pos: LngLat): LatLng {
  return [pos[1], pos[0]]
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * When events share exact coordinates, fan them out slightly so HTML pins do
 * not stack into one impossible-to-tap marker.
 */
export function spreadOverlappingPositions(items: EventMapPoint[]): EventMapPoint[] {
  const radiusDeg = 0.003
  const groups = new Map<string, EventMapPoint[]>()

  for (const item of items) {
    const key = `${item.pos[0].toFixed(6)},${item.pos[1].toFixed(6)}`
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  const result: EventMapPoint[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!)
      continue
    }

    group.forEach((item, index) => {
      const angle = (2 * Math.PI * index) / group.length - Math.PI / 2
      result.push({
        ...item,
        pos: [
          item.pos[0] + radiusDeg * Math.cos(angle),
          item.pos[1] + radiusDeg * Math.sin(angle),
        ],
      })
    })
  }

  return result
}

export function lngLatBoundsFromLatLngs(positions: LatLng[]): [[number, number], [number, number]] | null {
  if (positions.length === 0) return null

  let minLat = positions[0]![0]
  let maxLat = positions[0]![0]
  let minLng = positions[0]![1]
  let maxLng = positions[0]![1]

  for (const [lat, lng] of positions) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

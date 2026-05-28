import Supercluster from 'supercluster'
import type { BBox, Feature, Point } from 'geojson'
import type { EventItem } from '../../../types'
import { getAccent, DEFAULT_ACCENT } from './map-pin-html'
import { distanceKm, latLngToLngLat, lngLatToLatLng, spreadOverlappingPositions, type EventMapPoint, type LatLng } from './map-geo'

type EventFeatureProperties = {
  cluster?: false
  event: EventItem
  eventId: string
  accent: string
  pos: LatLng
}

type EmptyClusterProperties = Record<string, never>

type EventFeature = Feature<Point, EventFeatureProperties>

type SuperclusterClusterProperties = {
  cluster: true
  cluster_id: number
  point_count: number
  point_count_abbreviated: string | number
}

type ClusterFeature = Feature<Point, SuperclusterClusterProperties & EmptyClusterProperties>

export type DiscoverMapMarker =
  | {
      type: 'event'
      id: string
      event: EventItem
      pos: LatLng
      accent: string
    }
  | {
      type: 'cluster'
      id: string
      count: number
      pos: LatLng
      accent: string
      eventIds: string[]
      firstEventId: string | null
      compact: boolean
      offset?: [number, number]
    }

const WORLD_BBOX: BBox = [-180, -85, 180, 85]
const EVENT_LABEL_MIN_ZOOM = 13.8
const COMPACT_CLUSTER_MAX_ZOOM = 12.8

export function superclusterRadiusForZoom(zoom: number): number {
  if (zoom >= 14.2) return 0
  if (zoom < 9.8) return 8
  return 2
}

export function pickDominantAccent(events: EventItem[]): string {
  const counts = new Map<string, number>()
  for (const event of events) {
    const accent = getAccent(event)
    counts.set(accent, (counts.get(accent) ?? 0) + 1)
  }

  let best = DEFAULT_ACCENT
  let bestCount = -1
  for (const [accent, count] of counts) {
    if (count > bestCount) {
      best = accent
      bestCount = count
    }
  }
  return best
}

export function buildDiscoverMapMarkers(points: EventMapPoint[], zoom: number): DiscoverMapMarker[] {
  const radius = superclusterRadiusForZoom(zoom)
  if (radius <= 0 || points.length <= 1) {
    const eventMarkers: DiscoverMapMarker[] = spreadOverlappingPositions(points).map(({ event, pos }) => ({
      type: 'event',
      id: event.id,
      event,
      pos,
      accent: getAccent(event),
    }))
    return finalizeMarkers(eventMarkers, zoom)
  }

  const features: EventFeature[] = points.map(({ event, pos }) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: latLngToLngLat(pos),
    },
    properties: {
      event,
      eventId: event.id,
      accent: getAccent(event),
      pos,
    },
  }))

  const index = new Supercluster<EventFeatureProperties, EmptyClusterProperties>({
    minZoom: 0,
    maxZoom: 16,
    minPoints: 2,
    radius,
    extent: 512,
  })
  index.load(features)

  // MapLibre reports fractional zoom. Ceil keeps clusters from staying
  // over-compressed at defaults like Singapore's 11.5 viewport.
  const markers = index.getClusters(WORLD_BBOX, Math.max(0, Math.ceil(zoom))).map((feature): DiscoverMapMarker => {
    if (isClusterFeature(feature)) {
      const leaves = index.getLeaves(feature.properties.cluster_id, Number.MAX_SAFE_INTEGER)
      const events = leaves.map((leaf) => leaf.properties.event)
      const eventIds = events.map((event) => event.id)

      return {
        type: 'cluster',
        id: `cluster:${feature.properties.cluster_id}:${eventIds.join(',')}`,
        count: feature.properties.point_count,
        pos: lngLatToLatLng(feature.geometry.coordinates as [number, number]),
        accent: pickDominantAccent(events),
        eventIds,
        firstEventId: eventIds[0] ?? null,
        compact: zoom < COMPACT_CLUSTER_MAX_ZOOM,
      }
    }

    return {
      type: 'event',
      id: feature.properties.eventId,
      event: feature.properties.event,
      pos: feature.properties.pos,
      accent: feature.properties.accent,
    }
  })
  return finalizeMarkers(markers, zoom)
}

function isClusterFeature(feature: EventFeature | ClusterFeature): feature is ClusterFeature {
  return feature.properties.cluster === true
}

function finalizeMarkers(markers: DiscoverMapMarker[], zoom: number): DiscoverMapMarker[] {
  return declutterCompactClusters(collapseLowZoomEventMarkers(markers, zoom), zoom)
}

function collapseLowZoomEventMarkers(markers: DiscoverMapMarker[], zoom: number): DiscoverMapMarker[] {
  if (zoom >= EVENT_LABEL_MIN_ZOOM) return markers

  return markers.map((marker) => {
    if (marker.type === 'cluster') return marker

    return {
      type: 'cluster',
      id: `event-count:${marker.id}`,
      count: 1,
      pos: marker.pos,
      accent: marker.accent,
      eventIds: [marker.event.id],
      firstEventId: marker.event.id,
      compact: true,
    }
  })
}

function declutterCompactClusters(markers: DiscoverMapMarker[], zoom: number): DiscoverMapMarker[] {
  if (zoom >= EVENT_LABEL_MIN_ZOOM) return markers

  const clusterMarkers = markers.filter((marker): marker is Extract<DiscoverMapMarker, { type: 'cluster' }> => marker.type === 'cluster')
  if (clusterMarkers.length <= 1) return markers

  const thresholdKm = declutterThresholdKmForZoom(zoom)
  if (thresholdKm <= 0) return markers

  const groupedIds = new Map<string, [number, number]>()
  for (const group of connectedMarkerGroups(clusterMarkers, thresholdKm)) {
    if (group.length <= 1) continue

    const center = markerGroupCenter(group)
    const sorted = [...group].sort((a, b) => {
      const angleA = bearingAround(center, a.pos)
      const angleB = bearingAround(center, b.pos)
      if (angleA !== angleB) return angleA - angleB
      if (b.count !== a.count) return b.count - a.count
      return a.id.localeCompare(b.id)
    })
    const radiusPx = declutterRadiusPx(sorted.length, zoom)

    sorted.forEach((marker, index) => {
      // Keep ordering geographic, but use an even visual ring so dense CBD
      // badges do not inherit near-identical bearings and overlap again.
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / sorted.length
      groupedIds.set(marker.id, [
        Math.round(Math.cos(angle) * radiusPx),
        Math.round(Math.sin(angle) * radiusPx),
      ])
    })
  }

  if (groupedIds.size === 0) return markers
  return markers.map((marker) => {
    if (marker.type !== 'cluster') return marker
    const offset = groupedIds.get(marker.id)
    return offset ? { ...marker, offset } : marker
  })
}

function declutterThresholdKmForZoom(zoom: number): number {
  if (zoom >= EVENT_LABEL_MIN_ZOOM) return 0
  if (zoom >= 13.2) return 0.55
  if (zoom >= 12.4) return 0.85
  if (zoom >= 11.4) return 1.25
  return 1.8
}

function declutterRadiusPx(groupSize: number, zoom: number): number {
  const base = zoom < 11.4 ? 32 : zoom < 12.4 ? 28 : 24
  return base + Math.min(18, Math.max(0, groupSize - 2) * 5)
}

function connectedMarkerGroups(
  markers: Array<Extract<DiscoverMapMarker, { type: 'cluster' }>>,
  thresholdKm: number,
): Array<Array<Extract<DiscoverMapMarker, { type: 'cluster' }>>> {
  const visited = new Set<string>()
  const groups: Array<Array<Extract<DiscoverMapMarker, { type: 'cluster' }>>> = []

  for (const marker of markers) {
    if (visited.has(marker.id)) continue

    const queue = [marker]
    const group: Array<Extract<DiscoverMapMarker, { type: 'cluster' }>> = []
    visited.add(marker.id)

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!
      group.push(current)

      for (const candidate of markers) {
        if (visited.has(candidate.id)) continue
        if (distanceKm(current.pos, candidate.pos) > thresholdKm) continue
        visited.add(candidate.id)
        queue.push(candidate)
      }
    }

    groups.push(group)
  }

  return groups
}

function markerGroupCenter(markers: Array<Extract<DiscoverMapMarker, { type: 'cluster' }>>): LatLng {
  const totalWeight = markers.reduce((sum, marker) => sum + Math.max(1, marker.count), 0)
  const lat = markers.reduce((sum, marker) => sum + marker.pos[0] * Math.max(1, marker.count), 0) / totalWeight
  const lng = markers.reduce((sum, marker) => sum + marker.pos[1] * Math.max(1, marker.count), 0) / totalWeight
  return [lat, lng]
}

function bearingAround(center: LatLng, pos: LatLng): number {
  const lngScale = Math.cos((center[0] * Math.PI) / 180)
  return Math.atan2((pos[0] - center[0]), (pos[1] - center[1]) * lngScale)
}

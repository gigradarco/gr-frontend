import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import Map, { Marker, type MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Theme } from '../../../types'
import { buildDiscoverMapMarkers, type DiscoverMapMarker } from './map-clustering'
import { latLngToLngLat, lngLatBoundsFromLatLngs, type EventMapPoint, type LatLng } from './map-geo'
import { ClusterPin, EventPin } from './map-pin-html'
import { mapBackgroundForTheme, mapStyleForTheme } from './map-config'

type DiscoverMapCanvasProps = {
  theme: Theme
  points: EventMapPoint[]
  selectedId: string | null
  cityCenter: LatLng
  cityDefaultZoom: number
  onSelectEvent: (eventId: string) => void
  onClearSelection: () => void
}

export function DiscoverMapCanvas({
  theme,
  points,
  selectedId,
  cityCenter,
  cityDefaultZoom,
  onSelectEvent,
  onClearSelection,
}: DiscoverMapCanvasProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapZoom, setMapZoom] = useState(cityDefaultZoom)
  const [mapError, setMapError] = useState<string | null>(null)
  const hasFitInitialPinsRef = useRef(false)
  const prevCityCenterRef = useRef<LatLng | null>(null)
  const prevCityZoomRef = useRef<number | null>(null)

  const mapStyle = useMemo(() => mapStyleForTheme(theme), [theme])
  const backgroundColor = mapBackgroundForTheme(theme)
  const selectedPoint = useMemo(
    () => points.find((point) => point.event.id === selectedId) ?? null,
    [points, selectedId],
  )
  const markers = useMemo<DiscoverMapMarker[]>(() => {
    return buildDiscoverMapMarkers(points, mapZoom)
  }, [mapZoom, points])

  useEffect(() => {
    if (!mapLoaded) return
    const prevCenter = prevCityCenterRef.current
    const prevZoom = prevCityZoomRef.current
    if (!prevCenter) {
      prevCityCenterRef.current = cityCenter
      prevCityZoomRef.current = cityDefaultZoom
      return
    }

    const changed =
      prevCenter[0] !== cityCenter[0] ||
      prevCenter[1] !== cityCenter[1] ||
      prevZoom !== cityDefaultZoom

    if (!changed) return
    prevCityCenterRef.current = cityCenter
    prevCityZoomRef.current = cityDefaultZoom
    mapRef.current?.flyTo({
      center: latLngToLngLat(cityCenter),
      zoom: cityDefaultZoom,
      duration: 500,
    })
  }, [cityCenter, cityDefaultZoom, mapLoaded])

  useEffect(() => {
    if (!mapLoaded || hasFitInitialPinsRef.current || points.length === 0) return
    const map = mapRef.current
    if (!map) return

    hasFitInitialPinsRef.current = true
    if (points.length === 1) {
      map.jumpTo({ center: latLngToLngLat(points[0]!.pos), zoom: 15 })
      return
    }

    const bounds = lngLatBoundsFromLatLngs(points.map((point) => point.pos))
    if (!bounds) return
    map.fitBounds(bounds, { padding: 60, maxZoom: cityDefaultZoom, duration: 0 })
  }, [cityDefaultZoom, mapLoaded, points])

  useEffect(() => {
    if (!selectedPoint) return
    const map = mapRef.current
    if (!map) return
    map.flyTo({
      center: latLngToLngLat(selectedPoint.pos),
      zoom: Math.max(map.getZoom(), 15),
      duration: 500,
    })
  }, [selectedPoint])

  return (
    <div className="mv-maplibre" style={{ backgroundColor }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: cityCenter[1],
          latitude: cityCenter[0],
          zoom: cityDefaultZoom,
        }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%', backgroundColor }}
        attributionControl={false}
        reuseMaps
        maxZoom={20}
        onLoad={() => {
          setMapLoaded(true)
          const map = mapRef.current
          if (map) setMapZoom(map.getZoom())
        }}
        onZoomEnd={(event) => setMapZoom(event.viewState.zoom)}
        onClick={onClearSelection}
        onError={(event) => setMapError(event.error?.message ?? 'Map failed to load')}
      >
        {markers.map((marker) => (
          <DiscoverMarker
            key={marker.id}
            marker={marker}
            selectedId={selectedId}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </Map>

      <MapControls
        mapRef={mapRef}
        cityCenter={cityCenter}
        cityDefaultZoom={cityDefaultZoom}
      />

      {mapError ? <div className="mv-map-error">Map style failed to load</div> : null}
    </div>
  )
}

function DiscoverMarker({
  marker,
  selectedId,
  onSelectEvent,
}: {
  marker: DiscoverMapMarker
  selectedId: string | null
  onSelectEvent: (eventId: string) => void
}) {
  if (marker.type === 'cluster') {
    return (
      <Marker
        longitude={marker.pos[1]}
        latitude={marker.pos[0]}
        anchor="top-left"
        className="mv-pin"
        offset={marker.offset}
        onClick={(event) => {
          event.originalEvent.stopPropagation()
          if (marker.firstEventId) onSelectEvent(marker.firstEventId)
        }}
      >
        <ClusterPin count={marker.count} accent={marker.accent} compact={marker.compact} />
      </Marker>
    )
  }

  const isSelected = selectedId === marker.event.id
  return (
    <Marker
      longitude={marker.pos[1]}
      latitude={marker.pos[0]}
      anchor="top-left"
      className="mv-pin"
      style={{ zIndex: isSelected ? 1000 : 0 }}
      onClick={(event) => {
        event.originalEvent.stopPropagation()
        onSelectEvent(marker.event.id)
      }}
    >
      <EventPin event={marker.event} isSelected={isSelected} />
    </Marker>
  )
}

function MapControls({
  mapRef,
  cityCenter,
  cityDefaultZoom,
}: {
  mapRef: MutableRefObject<MapRef | null>
  cityCenter: LatLng
  cityDefaultZoom: number
}) {
  function resetView() {
    mapRef.current?.flyTo({
      center: latLngToLngLat(cityCenter),
      zoom: cityDefaultZoom,
      duration: 500,
    })
  }

  return (
    <div className="mv-zoom-controls">
      <button
        type="button"
        className="mv-zoom-btn"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => mapRef.current?.zoomIn()}
      >
        +
      </button>
      <button
        type="button"
        className="mv-zoom-btn"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => mapRef.current?.zoomOut()}
      >
        −
      </button>
      <div className="mv-zoom-divider" />
      <button
        type="button"
        className="mv-zoom-btn mv-zoom-btn--reset"
        aria-label="Reset coordinates"
        title="Reset coordinates"
        onClick={resetView}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CheckCircle, ChevronLeft, Funnel, Heart, Info, Maximize2, Minimize2, Pause, Play, RefreshCw, Share2 } from 'lucide-react'
import { LocationCityPickerControl, CityPickerSheet } from '../../components/LocationCityPickerControl'
import { EventShareSheet } from '../../components/EventShareSheet'
import {
  FilterSheet,
  countActiveFilters,
  eventMatchesFilters,
} from './EventCardFeed'
import type { EventFeedFilters } from './EventCardFeed'
import { useAppState } from '../../store/appStore'
import { LOCATION_REGIONS } from '../../data/locationRegions'
import { getDiscoverMapCityCenter, getDiscoverMapCityDefaultZoom } from '../../lib/discover-map-defaults'
import { handleEventImageError } from '../../lib/event-image-fallback'
import { fireGoingCelebration } from '../../components/GoingCelebrationBurst'
import { useEventPlans } from '../../lib/useEventPlans'
import type { EventItem } from '../../types'

// ─── Category → accent (mirrors EventCardFeed) ───────────────────────────────
const CATEGORY_ACCENT: Record<string, string> = {
  'live-music':  '#ff3d00',
  'club-nights': '#00aaff',
  'jazz-blues':  '#00cc66',
  underground:   '#cc00ff',
  arts:          '#00e5cc',
  food:          '#ffaa00',
  popups:        '#0d9488',
  festivals:     '#9333ea',
}
const DEFAULT_ACCENT = '#ff3d00'

const GENRE_TO_CATEGORY: Record<string, string> = {
  Techno:        'club-nights',
  'Club Nights': 'club-nights',
  Jazz:          'jazz-blues',
  Electronic:    'underground',
  'Live Music':  'live-music',
  'Cocktail Bar':'food',
}

function getAccent(event: EventItem): string {
  const catId = CATEGORY_ACCENT[event.exploreCategoryId]
    ? event.exploreCategoryId
    : GENRE_TO_CATEGORY[event.genre] ?? event.exploreCategoryId
  return CATEGORY_ACCENT[catId] ?? DEFAULT_ACCENT
}

function eventLatLng(event: EventItem): [number, number] | null {
  if (event.lat != null && event.lng != null) return [event.lat, event.lng]
  return null
}

function distanceKm(a: [number, number], b: [number, number]): number {
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

type Cluster = {
  items: { event: EventItem; pos: [number, number] }[]
  center: [number, number]
}

function clusterByDistance(
  items: { event: EventItem; pos: [number, number] }[],
  thresholdKm: number,
): Cluster[] {
  const clusters: Cluster[] = []
  for (const item of items) {
    let target: Cluster | null = null
    for (const c of clusters) {
      if (distanceKm(item.pos, c.center) <= thresholdKm) {
        target = c
        break
      }
    }
    if (!target) {
      clusters.push({ items: [item], center: item.pos })
      continue
    }
    target.items.push(item)
    const n = target.items.length
    target.center = [
      (target.center[0] * (n - 1) + item.pos[0]) / n,
      (target.center[1] * (n - 1) + item.pos[1]) / n,
    ]
  }
  return clusters
}

function clusterThresholdKmForZoom(zoom: number): number {
  if (zoom >= 13.2) return 0
  if (zoom >= 12.6) return 0.7
  if (zoom >= 12) return 1.2
  return 1.8
}

/**
 * When several events share the exact same coordinates (district fallback or identical venue),
 * fan them out in a small circle so their pins don't stack on top of each other.
 * ~80 m radius at typical zoom — invisible at city scale, obvious at venue zoom.
 */
function spreadOverlappingPositions(
  items: { event: EventItem; pos: [number, number] }[],
): { event: EventItem; pos: [number, number] }[] {
  const RADIUS_DEG = 0.003 // ≈ 333 m — visible at city zoom (zoom 12-13)

  // Group by rounded position (6 dp ≈ 0.1 m precision)
  const groups = new Map<string, { event: EventItem; pos: [number, number] }[]>()
  for (const item of items) {
    const key = `${item.pos[0].toFixed(6)},${item.pos[1].toFixed(6)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  const result: { event: EventItem; pos: [number, number] }[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!)
      continue
    }
    // Rotate each pin evenly around the original point, starting from the top
    group.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2
      result.push({
        ...item,
        pos: [
          item.pos[0] + RADIUS_DEG * Math.cos(angle),
          item.pos[1] + RADIUS_DEG * Math.sin(angle),
        ],
      })
    })
  }
  return result
}

function getCityName(cityId: string): string {
  for (const region of LOCATION_REGIONS) {
    const city = region.cities.find((c) => c.id === cityId)
    if (city) return city.name
  }
  return cityId
}

function eventDateTimeLabel(event: EventItem): string {
  return event.displayDateTimeLabel ?? event.time
}

function compactDateTimeLabel(event: EventItem): string {
  const label = eventDateTimeLabel(event).trim()
  if (!label) return 'TBA'
  if (/^date tba/i.test(label)) return 'TBA'
  const tonight = label.match(/^tonight\s+(.+)$/i)
  if (tonight?.[1]) return tonight[1]
  return label
}

function toFavoriteEvent(event: EventItem) {
  return {
    id: event.id,
    title: event.title,
    venueLine: [event.venue, event.district].map((part) => part.trim()).filter(Boolean).join(', '),
    timeLabel: event.displayDateTimeLabel ?? event.time,
    image: event.image,
    variant: 'upcoming' as const,
  }
}

// ─── Pin (Leaflet DivIcon) ───────────────────────────────────────────────────
function buildPinIcon(event: EventItem, isSelected: boolean): L.DivIcon {
  const accent = getAccent(event)
  const markerLabel = compactDateTimeLabel(event)
  const html = `
    <div class="mv-pin-stack">
      <div class="mv-pin-bubble${isSelected ? ' mv-pin-bubble--active' : ''}" style="--pin-accent:${accent};">
        <span class="mv-pin-time">${escapeHtml(markerLabel)}</span>
      </div>
      <div class="mv-pin-tail" style="--pin-accent:${accent};"></div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'mv-pin',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function pickClusterAccent(items: { event: EventItem; pos: [number, number] }[]): string {
  const counts = new Map<string, number>()
  for (const item of items) {
    const accent = getAccent(item.event)
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

function buildClusterPinIcon(count: number, accent: string): L.DivIcon {
  const html = `
    <div class="mv-pin-stack">
      <div class="mv-pin-bubble mv-pin-bubble--cluster" style="--pin-accent:${accent};">
        <span class="mv-pin-time">${count} events</span>
      </div>
      <div class="mv-pin-tail mv-pin-tail--cluster" style="--pin-accent:${accent};"></div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'mv-pin',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string))
}

// ─── Fit map to show all pins on first render ─────────────────────────────────
function FitBounds({
  positions,
  onMapClick,
}: {
  positions: [number, number][]
  onMapClick: () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) return
    if (positions.length === 1) {
      map.setView(positions[0], 15, { animate: false })
      return
    }
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false })
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    map.on('click', onMapClick)
    return () => { map.off('click', onMapClick) }
  }, [map, onMapClick])

  return null
}

// ─── Helper: fly to a target on selection change ─────────────────────────────
function FlyToSelected({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.5 })
  }, [target, map])
  return null
}

// ─── Zoom + reset controls ────────────────────────────────────────────────────
function MapControls({
  cityCenter,
  cityDefaultZoom,
}: {
  cityCenter: [number, number]
  cityDefaultZoom: number
}) {
  const map = useMap()
  const prevCityCenterRef = useRef<[number, number] | null>(null)
  const prevCityZoomRef = useRef<number | null>(null)

  // Recenter only when city defaults actually change (avoid fighting manual zoom/pan).
  useEffect(() => {
    const prevCenter = prevCityCenterRef.current
    const prevZoom = prevCityZoomRef.current
    const changed =
      !prevCenter ||
      prevCenter[0] !== cityCenter[0] ||
      prevCenter[1] !== cityCenter[1] ||
      prevZoom !== cityDefaultZoom
    if (!changed) return
    prevCityCenterRef.current = cityCenter
    prevCityZoomRef.current = cityDefaultZoom
    map.flyTo(cityCenter, cityDefaultZoom, { duration: 0.5 })
  }, [cityCenter, cityDefaultZoom, map])

  function resetView() {
    map.flyTo(cityCenter, cityDefaultZoom, { duration: 0.5 })
  }

  return (
    <div className="mv-zoom-controls">
      <button
        type="button"
        className="mv-zoom-btn"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        type="button"
        className="mv-zoom-btn"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => map.zoomOut()}
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
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
      </button>
    </div>
  )
}

function ZoomWatcher({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void
}) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom())
    },
  })

  useEffect(() => {
    onZoomChange(map.getZoom())
  }, [map, onZoomChange])

  return null
}

// ─── Main MapView ────────────────────────────────────────────────────────────
type MapViewProps = {
  events: EventItem[]
  filters: EventFeedFilters
  onFiltersChange: (next: EventFeedFilters) => void
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  onBackToFeed: () => void
  onMoreDetails: (eventId: string) => void
  onRefresh?: () => void
}

type MapSheetState = 'hidden' | 'peek' | 'expanded'

const MAP_SHEET_ORDER: MapSheetState[] = ['hidden', 'peek', 'expanded']
const MAP_SHEET_HOLD_HIDE_MS = 800
const MAP_SHEET_Y: Record<MapSheetState, number> = {
  hidden: 280,
  peek: 120,
  expanded: 0,
}

export function MapView({
  events,
  filters,
  onFiltersChange,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  onBackToFeed,
  onMoreDetails,
  onRefresh,
}: MapViewProps) {
  const locationCityId = useAppState((s) => s.feedLocationCityId)
  const theme = useAppState((s) => s.theme)
  const isDiscoverExpanded = useAppState((s) => s.isDiscoverExpanded)
  const toggleDiscoverExpanded = useAppState((s) => s.toggleDiscoverExpanded)
  const isAuthenticated = useAppState((s) => s.isAuthenticated)
  const openSignIn = useAppState((s) => s.openSignIn)
  const toggleFavoriteEvent = useAppState((s) => s.toggleFavoriteEvent)
  const isEventFavorited = useAppState((s) => s.isEventFavorited)
  const { isEventPlanned, toggleEventPlan } = useEventPlans()
  const tileUrl =
    theme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localFilters, setLocalFilters] = useState<EventFeedFilters>(filters)
  const [showFilter, setShowFilter] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [shareEventTarget, setShareEventTarget] = useState<EventItem | null>(null)
  const [isCycling, setIsCycling] = useState(false)
  const [mapSheetState, setMapSheetState] = useState<MapSheetState>('peek')
  const [holdProgress, setHoldProgress] = useState(0)
  const [mapZoom, setMapZoom] = useState<number>(11.5)
  const cycleIdxRef = useRef(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const carouselEndRef = useRef<HTMLDivElement | null>(null)
  const holdRafRef = useRef<number | null>(null)
  const holdStartedAtRef = useRef<number | null>(null)
  const holdTriggeredRef = useRef(false)
  const suppressTapRef = useRef(false)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const activeFilterCount = countActiveFilters(localFilters)

  const cityEvents = useMemo(() => {
    const raw = events
      .filter((e) => e.locationCityId === locationCityId)
      .filter((e) => eventMatchesFilters(e, localFilters))
      .map((e) => ({ event: e, pos: eventLatLng(e) }))
      .filter((r): r is { event: EventItem; pos: [number, number] } => r.pos != null)
    return spreadOverlappingPositions(raw)
  }, [events, localFilters, locationCityId])

  const cityCenter = getDiscoverMapCityCenter(locationCityId)
  const cityDefaultZoom = getDiscoverMapCityDefaultZoom(locationCityId)
  const cityName = getCityName(locationCityId)
  const selected = cityEvents.find((r) => r.event.id === selectedId) ?? null
  const clusterThresholdKm = useMemo(() => clusterThresholdKmForZoom(mapZoom), [mapZoom])
  const cityClusters = useMemo(
    () => (clusterThresholdKm > 0 ? clusterByDistance(cityEvents, clusterThresholdKm) : []),
    [cityEvents, clusterThresholdKm],
  )

  const allPositions = useMemo(() => cityEvents.map((r) => r.pos), [cityEvents])

  function selectAndScroll(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
    const idx = cityEvents.findIndex((r) => r.event.id === id)
    const el = carouselRef.current
    if (!el || idx < 0) return
    const card = el.children[idx] as HTMLElement | undefined
    if (!card) return
    // Scroll only the carousel — `scrollIntoView` cascades to ancestors and
    // can horizontally shift the entire app frame when the card is offscreen.
    const target = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }

  useEffect(() => {
    const el = carouselRef.current
    const sentinel = carouselEndRef.current
    if (!el || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (hasMore && !loadingMore && !loading) onLoadMore?.()
      },
      {
        root: el,
        rootMargin: '0px 35% 0px 0px',
        threshold: 0.01,
      },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, onLoadMore, cityEvents.length])

  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const onScroll = () => {
      const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 160
      if (nearEnd && hasMore && !loadingMore && !loading) onLoadMore?.()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [hasMore, loading, loadingMore, onLoadMore])

  // Auto-cycle through events
  useEffect(() => {
    if (!isCycling || cityEvents.length === 0) return
    // Seed the index from the currently selected card (or start at 0)
    const startIdx = cityEvents.findIndex((r) => r.event.id === selectedId)
    cycleIdxRef.current = startIdx >= 0 ? startIdx : 0
    // Immediately show the first card so the user sees something right away
    const first = cityEvents[cycleIdxRef.current]
    if (first) selectAndScroll(first.event.id)

    const interval = setInterval(() => {
      cycleIdxRef.current = (cycleIdxRef.current + 1) % cityEvents.length
      const next = cityEvents[cycleIdxRef.current]
      if (next) selectAndScroll(next.event.id)
    }, 3500)

    return () => clearInterval(interval)
  // selectAndScroll is defined inside the component; list only the primitives that
  // should restart the cycle (toggling isCycling or changing cities).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCycling, cityEvents])

  // Stop cycling when the user changes city
  useEffect(() => {
    setIsCycling(false)
  }, [locationCityId])

  useEffect(() => {
    if (cityEvents.length === 0) {
      setMapSheetState('hidden')
      return
    }
    setMapSheetState((prev) => (prev === 'hidden' ? 'peek' : prev))
  }, [cityEvents.length])

  function moveSheet(direction: 'up' | 'down') {
    setMapSheetState((prev) => {
      const idx = MAP_SHEET_ORDER.indexOf(prev)
      if (idx < 0) return 'peek'
      if (direction === 'up') {
        return MAP_SHEET_ORDER[Math.min(MAP_SHEET_ORDER.length - 1, idx + 1)] ?? prev
      }
      return MAP_SHEET_ORDER[Math.max(0, idx - 1)] ?? prev
    })
  }

  function onSheetDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.y > 65) {
      moveSheet('down')
      return
    }
    if (info.offset.y < -65) {
      moveSheet('up')
    }
  }

  function clearHoldAnimation() {
    if (holdRafRef.current != null) {
      window.cancelAnimationFrame(holdRafRef.current)
      holdRafRef.current = null
    }
  }

  function endHold() {
    clearHoldAnimation()
    holdStartedAtRef.current = null
    setHoldProgress(0)
  }

  function tickHoldProgress() {
    const start = holdStartedAtRef.current
    if (start == null) return
    const elapsed = performance.now() - start
    const next = Math.min(1, elapsed / MAP_SHEET_HOLD_HIDE_MS)
    setHoldProgress(next)
    if (next >= 1) {
      holdTriggeredRef.current = true
      suppressTapRef.current = true
      setMapSheetState('hidden')
      endHold()
      return
    }
    holdRafRef.current = window.requestAnimationFrame(tickHoldProgress)
  }

  function startHold() {
    if (mapSheetState === 'hidden') return
    holdTriggeredRef.current = false
    holdStartedAtRef.current = performance.now()
    setHoldProgress(0)
    clearHoldAnimation()
    holdRafRef.current = window.requestAnimationFrame(tickHoldProgress)
  }

  function onHandleTap() {
    if (suppressTapRef.current) {
      suppressTapRef.current = false
      return
    }
    if (mapSheetState === 'expanded') {
      setMapSheetState('peek')
      return
    }
    setMapSheetState('expanded')
  }

  useEffect(() => () => clearHoldAnimation(), [])

  useEffect(() => {
    if (mapSheetState === 'hidden') {
      setHoldProgress(0)
      holdTriggeredRef.current = false
    }
  }, [mapSheetState])

  return (
    <div className="mv-root">
      {/* Header */}
      <div className="mv-header">
        <div className="mv-header-row">
          <button
            type="button"
            className="mv-back-btn"
            onClick={onBackToFeed}
            aria-label="Back to feed"
          >
            <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
            <span>Feed</span>
          </button>

          {/* Filter + city chips (reuse feed styles) */}
          <div className="mv-chip-row">
            <button
              type="button"
              className={`ecf-chip-btn ecf-chip-btn--filter ecf-chip-btn--icon-only${activeFilterCount > 0 ? ' ecf-chip-btn--active' : ''}`}
              onClick={() => setShowFilter(true)}
              aria-label={activeFilterCount > 0 ? `Filters active (${activeFilterCount})` : 'Open filters'}
              title={activeFilterCount > 0 ? `Filters active (${activeFilterCount})` : 'Open filters'}
            >
              <span className="ecf-chip-filter-icon-wrap">
                <Funnel className="ecf-chip-filter-icon" size={14} strokeWidth={2.25} aria-hidden />
                {activeFilterCount > 0 && (
                  <CheckCircle className="ecf-chip-filter-badge" size={9} strokeWidth={2.5} aria-hidden />
                )}
              </span>
            </button>
            <LocationCityPickerControl
              triggerClassName="ecf-chip-btn ecf-chip-btn--location ecf-chip-btn--icon-only"
              wrapClassName="ecf-chip-wrap"
              onOpen={() => setShowCityPicker(true)}
              iconOnly
            />
            <button
              type="button"
              className="ecf-chip-btn ecf-chip-btn--icon-only"
              onClick={toggleDiscoverExpanded}
              aria-label={isDiscoverExpanded ? 'Collapse discover view' : 'Expand discover view'}
              title={isDiscoverExpanded ? 'Collapse discover view' : 'Expand discover view'}
            >
              {isDiscoverExpanded ? (
                <Minimize2 size={14} strokeWidth={2.25} aria-hidden />
              ) : (
                <Maximize2 size={14} strokeWidth={2.25} aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="ecf-chip-btn ecf-chip-btn--icon-only"
              onClick={() => onRefresh?.()}
              aria-label="Refresh events"
              title="Refresh events"
              disabled={loading}
            >
              <RefreshCw
                size={14}
                strokeWidth={2.25}
                aria-hidden
                className={loading ? 'ecf-refresh-spin' : undefined}
              />
            </button>
          </div>

          <div className="mv-header-meta">
            <button
              type="button"
              className={`mv-cycle-btn${isCycling ? ' mv-cycle-btn--active' : ''}`}
              aria-label={isCycling ? 'Stop cycling' : 'Cycle through events'}
              onClick={() => setIsCycling((v) => !v)}
            >
              {isCycling ? <span className="mv-cycle-loader" aria-hidden /> : null}
              {isCycling
                ? <Pause size={12} strokeWidth={2.5} aria-hidden />
                : <Play size={12} strokeWidth={2.5} aria-hidden />}
            </button>
            <span className="mv-header-count">{cityEvents.length} events</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="mv-map-wrap">
        <MapContainer
          center={cityCenter}
          zoom={cityDefaultZoom}
          zoomControl={false}
          attributionControl={false}
          className="mv-leaflet"
        >
          <TileLayer
            key={theme}
            url={tileUrl}
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
          />
          <ZoomWatcher onZoomChange={setMapZoom} />
          <FitBounds positions={allPositions} onMapClick={() => setSelectedId(null)} />
          <FlyToSelected target={selected ? selected.pos : null} />
          <MapControls cityCenter={cityCenter} cityDefaultZoom={cityDefaultZoom} />
          {selectedId || clusterThresholdKm <= 0
            ? cityEvents.map(({ event, pos }) => (
                <Marker
                  key={event.id}
                  position={pos}
                  icon={buildPinIcon(event, selectedId === event.id)}
                  eventHandlers={{ click: () => selectAndScroll(event.id) }}
                  zIndexOffset={selectedId === event.id ? 1000 : 0}
                />
              ))
            : cityClusters.map((cluster) => {
                if (cluster.items.length === 1) {
                  const only = cluster.items[0]
                  return (
                    <Marker
                      key={only.event.id}
                      position={only.pos}
                      icon={buildPinIcon(only.event, false)}
                      eventHandlers={{ click: () => selectAndScroll(only.event.id) }}
                    />
                  )
                }
                return (
                  <Marker
                    key={`cluster:${cluster.items.map((i) => i.event.id).join(',')}`}
                    position={cluster.center}
                    icon={buildClusterPinIcon(cluster.items.length, pickClusterAccent(cluster.items))}
                    eventHandlers={{
                      click: () => {
                        const first = cluster.items[0]
                        if (first) selectAndScroll(first.event.id)
                      },
                    }}
                  />
                )
              })}
        </MapContainer>

        {/* Empty state overlay */}
        {cityEvents.length === 0 && (
          <div className="mv-empty">
            <div className="mv-empty-line" />
            <p className="mv-empty-text">
              No mappable events in {cityName}
              <br />
              <span>Check back soon or try another city</span>
            </p>
          </div>
        )}

        {/* Bottom card carousel */}
        {cityEvents.length > 0 && (
          <>
            <motion.div
              className={`mv-carousel-wrap mv-carousel-wrap--${mapSheetState}`}
              animate={{ y: MAP_SHEET_Y[mapSheetState] }}
              transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.8 }}
              drag="y"
              dragElastic={0.04}
              dragMomentum={false}
              onDragEnd={onSheetDragEnd}
            >
              <button
                type="button"
                className="mv-sheet-handle"
                aria-label={mapSheetState === 'expanded' ? 'Tap to shrink event cards' : 'Tap to expand event cards'}
                onClick={onHandleTap}
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerCancel={endHold}
                onPointerLeave={endHold}
              >
                <span className={`mv-sheet-hold-ring${holdProgress > 0 ? ' is-active' : ''}`} aria-hidden>
                  <svg viewBox="0 0 24 24">
                    <circle className="mv-sheet-hold-ring-track" cx="12" cy="12" r="10" />
                    <circle
                      className="mv-sheet-hold-ring-progress"
                      cx="12"
                      cy="12"
                      r="10"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 10}`,
                        strokeDashoffset: `${(1 - holdProgress) * 2 * Math.PI * 10}`,
                      }}
                    />
                  </svg>
                </span>
                <span className="mv-sheet-handle-bar" aria-hidden />
                <small>
                  {mapSheetState === 'expanded'
                    ? 'Hold down to hide · Tap to shrink'
                    : 'Hold down to hide · Tap to expand'}
                </small>
              </button>
              <div className="mv-carousel" ref={carouselRef}>
                {cityEvents.map(({ event }) => {
                  const isSel = selectedId === event.id
                  const isGoing = isEventPlanned(event.id)
                  const isSaved = isEventFavorited(event.id)
                  const accent = getAccent(event)
                  const dateTime = eventDateTimeLabel(event)
                  return (
                    <div
                      key={event.id}
                      className={`mv-card${isSel ? ' mv-card--active' : ''}`}
                      style={{ '--card-accent': accent } as React.CSSProperties}
                      onClick={() => selectAndScroll(event.id)}
                    >
                      <img
                        src={event.image}
                        alt={event.title}
                        className="mv-card-img"
                        loading="lazy"
                        onError={(e) => handleEventImageError(event, e)}
                      />
                      <div className="mv-card-body">
                        <div className="mv-card-meta-row">
                          <span className="mv-card-genre">{event.genre.toUpperCase()}</span>
                          <span className="mv-card-time">{compactDateTimeLabel(event)}</span>
                        </div>
                        <p className="mv-card-title">{event.title}</p>
                        <p className="mv-card-sub">
                          {event.district} · {dateTime}
                        </p>
                        <p className="mv-card-price">{event.ticketPrice}</p>
                        <div className="mv-card-actions">
                          <button
                            type="button"
                            className={`mv-card-going${isGoing ? ' mv-card-going--active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isGoing) fireGoingCelebration(e.currentTarget)
                              toggleEventPlan(event.id)
                            }}
                          >
                            {isGoing ? "✓ I'm Going" : "I'm Going"}
                          </button>
                          <button
                            type="button"
                            className="mv-card-details-btn"
                            aria-label="More details"
                            onClick={(e) => {
                              e.stopPropagation()
                              onMoreDetails(event.id)
                            }}
                          >
                            <Info size={13} strokeWidth={2} aria-hidden />
                            <span>More Details</span>
                          </button>
                          <button
                            type="button"
                            className="mv-card-icon-btn"
                            aria-label="Save event"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isAuthenticated) {
                                openSignIn('Sign in to save this event.')
                                return
                              }
                              toggleFavoriteEvent(toFavoriteEvent(event))
                            }}
                          >
                            <Heart
                              size={13}
                              strokeWidth={isSaved ? 2.5 : 2}
                              fill={isSaved ? accent : 'none'}
                              color={isSaved ? accent : undefined}
                              aria-hidden
                            />
                          </button>
                          <button
                            type="button"
                            className="mv-card-icon-btn"
                            aria-label="Share event"
                            onClick={(e) => {
                              e.stopPropagation()
                              setShareEventTarget(event)
                            }}
                          >
                            <Share2 size={13} strokeWidth={2} aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="mv-end-card" role="status" aria-live="polite" ref={carouselEndRef}>
                  {loadingMore ? (
                    <>
                      <span className="mv-end-spinner" aria-hidden />
                      <p>Loading more events…</p>
                    </>
                  ) : hasMore ? (
                    <button type="button" className="mv-end-load-btn" onClick={() => onLoadMore?.()}>
                      Load more
                    </button>
                  ) : (
                    <p>No more events.</p>
                  )}
                </div>
              </div>
            </motion.div>
            {mapSheetState === 'hidden' ? (
              <button
                type="button"
                className="mv-sheet-restore"
                onClick={() => setMapSheetState('peek')}
              >
                Show All Events
              </button>
            ) : null}
          </>
        )}
      </div>

      {/* Filter bottom sheet */}
      {createPortal(
        <AnimatePresence>
          {showFilter && (
            <FilterSheet
              applied={localFilters}
              onApply={(next) => {
                setLocalFilters(next)
                onFiltersChange(next)
                setShowFilter(false)
              }}
              onClose={() => setShowFilter(false)}
            />
          )}
        </AnimatePresence>,
        (document.querySelector('main.phone-shell') ?? document.getElementById('root')) as HTMLElement,
      )}

      {/* City picker sheet */}
      {createPortal(
        <AnimatePresence>
          {showCityPicker && (
            <motion.div
              className="ecf-filter-backdrop"
              onClick={() => setShowCityPicker(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <motion.div
                className="lcp-sheet"
                onClick={(e) => e.stopPropagation()}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <CityPickerSheet
                  onClose={() => setShowCityPicker(false)}
                  autoCloseOnSelect
                  autoCloseDelayMs={1000}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        (document.querySelector('main.phone-shell') ?? document.getElementById('root')) as HTMLElement,
      )}

      {shareEventTarget
        ? createPortal(
            <EventShareSheet
              eventId={shareEventTarget.id}
              title={shareEventTarget.title}
              venue={`${shareEventTarget.venue}, ${shareEventTarget.district}`}
              when={shareEventTarget.displayDateTimeLabel ?? shareEventTarget.time}
              url={shareEventTarget.sourceUrl}
              fallbackPath={`/discover/${shareEventTarget.id}`}
              onClose={() => setShareEventTarget(null)}
            />,
            (document.querySelector('main.phone-shell') ?? document.getElementById('root')) as HTMLElement,
          )
        : null}
    </div>
  )
}

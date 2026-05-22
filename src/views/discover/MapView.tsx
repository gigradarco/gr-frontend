import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CheckCircle, ChevronLeft, Funnel, Heart, Info, Pause, Play, Share2 } from 'lucide-react'
import { LocationCityPickerControl, CityPickerSheet } from '../../components/LocationCityPickerControl'
import {
  FilterSheet,
  DEFAULT_FILTERS,
  countActiveFilters,
  eventMatchesFilters,
} from './EventCardFeed'
import type { EventFeedFilters } from './EventCardFeed'
import { useAppState } from '../../store/appStore'
import { LOCATION_REGIONS } from '../../data/locationRegions'
import { handleEventImageError } from '../../lib/event-image-fallback'
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

// ─── City → centroid (for default map center) ────────────────────────────────
const CITY_CENTERS: Record<string, [number, number]> = {
  singapore:   [1.2870, 103.8470],
  bangkok:     [13.7367, 100.5232],
  tokyo:       [35.6762, 139.6503],
  'hong-kong': [22.3193, 114.1694],
  seoul:       [37.5665, 126.9780],
  london:      [51.5074, -0.1278],
  berlin:      [52.5200, 13.4050],
  paris:       [48.8566, 2.3522],
  amsterdam:   [52.3676, 4.9041],
  barcelona:   [41.3851, 2.1734],
  'new-york':  [40.7128, -74.0060],
}

function eventLatLng(event: EventItem): [number, number] | null {
  if (event.lat != null && event.lng != null) return [event.lat, event.lng]
  return null
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

function getCityCenter(cityId: string): [number, number] {
  return CITY_CENTERS[cityId] ?? [1.2870, 103.8470]
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

// ─── Pin (Leaflet DivIcon) ───────────────────────────────────────────────────
function buildPinIcon(event: EventItem, isSelected: boolean): L.DivIcon {
  const accent = getAccent(event)
  const markerLabel = compactDateTimeLabel(event)
  const html = `
    <div class="mv-pin-stack">
      <div class="mv-pin-bubble${isSelected ? ' mv-pin-bubble--active' : ''}" style="--pin-accent:${accent};">
        ${isSelected ? `<span class="mv-pin-title">${escapeHtml(event.title)}</span>` : ''}
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
  positions,
  cityCenter,
}: {
  positions: [number, number][]
  cityCenter: [number, number]
}) {
  const map = useMap()

  function resetView() {
    if (positions.length > 1) {
      map.flyToBounds(L.latLngBounds(positions), { padding: [60, 60], maxZoom: 15, duration: 0.5 })
    } else {
      map.flyTo(cityCenter, 14, { duration: 0.5 })
    }
  }

  return (
    <div className="mv-zoom-controls">
      <button type="button" className="mv-zoom-btn" aria-label="Zoom in"  onClick={() => map.zoomIn()}>+</button>
      <button type="button" className="mv-zoom-btn" aria-label="Zoom out" onClick={() => map.zoomOut()}>−</button>
      <div className="mv-zoom-divider" />
      <button type="button" className="mv-zoom-btn mv-zoom-btn--reset" aria-label="Reset view" onClick={resetView}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Main MapView ────────────────────────────────────────────────────────────
type MapViewProps = {
  events: EventItem[]
  onBackToFeed: () => void
  onMoreDetails: (eventId: string) => void
}

export function MapView({ events, onBackToFeed, onMoreDetails }: MapViewProps) {
  const locationCityId = useAppState((s) => s.feedLocationCityId)
  const theme = useAppState((s) => s.theme)
  const tileUrl =
    theme === 'light'
      ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [going, setGoing] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [filters, setFilters] = useState<EventFeedFilters>(DEFAULT_FILTERS)
  const [showFilter, setShowFilter] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [isCycling, setIsCycling] = useState(false)
  const cycleIdxRef = useRef(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const activeFilterCount = countActiveFilters(filters)

  const cityEvents = useMemo(() => {
    const raw = events
      .filter((e) => e.locationCityId === locationCityId)
      .filter((e) => eventMatchesFilters(e, filters))
      .map((e) => ({ event: e, pos: eventLatLng(e) }))
      .filter((r): r is { event: EventItem; pos: [number, number] } => r.pos != null)
    return spreadOverlappingPositions(raw)
  }, [events, locationCityId, filters])

  const cityCenter = getCityCenter(locationCityId)
  const cityName = getCityName(locationCityId)
  const selected = cityEvents.find((r) => r.event.id === selectedId) ?? null

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

  const toggle = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

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
              className={`ecf-chip-btn ecf-chip-btn--filter${activeFilterCount > 0 ? ' ecf-chip-btn--active' : ''}`}
              onClick={() => setShowFilter(true)}
            >
              <span className="ecf-chip-filter-icon-wrap">
                <Funnel className="ecf-chip-filter-icon" size={14} strokeWidth={2.25} aria-hidden />
                {activeFilterCount > 0 && (
                  <CheckCircle className="ecf-chip-filter-badge" size={9} strokeWidth={2.5} aria-hidden />
                )}
              </span>
              <span>Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}</span>
            </button>
            <LocationCityPickerControl
              triggerClassName="ecf-chip-btn ecf-chip-btn--location"
              wrapClassName="ecf-chip-wrap"
              onOpen={() => setShowCityPicker(true)}
            />
          </div>

          <div className="mv-header-meta">
            <button
              type="button"
              className={`mv-cycle-btn${isCycling ? ' mv-cycle-btn--active' : ''}`}
              aria-label={isCycling ? 'Stop cycling' : 'Cycle through events'}
              onClick={() => setIsCycling((v) => !v)}
            >
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
          zoom={14}
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
          <FitBounds positions={allPositions} onMapClick={() => setSelectedId(null)} />
          <FlyToSelected target={selected ? selected.pos : null} />
          <MapControls positions={allPositions} cityCenter={cityCenter} />
          {cityEvents.map(({ event, pos }) => (
            <Marker
              key={event.id}
              position={pos}
              icon={buildPinIcon(event, selectedId === event.id)}
              eventHandlers={{ click: () => selectAndScroll(event.id) }}
              zIndexOffset={selectedId === event.id ? 1000 : 0}
            />
          ))}
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
          <div className="mv-carousel-wrap">
            <div className="mv-carousel" ref={carouselRef}>
              {cityEvents.map(({ event }) => {
                const isSel = selectedId === event.id
                const isGoing = going.includes(event.id)
                const isSaved = saved.includes(event.id)
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
                            toggle(event.id, setGoing)
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
                            toggle(event.id, setSaved)
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
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Share2 size={13} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Filter bottom sheet */}
      {createPortal(
        <AnimatePresence>
          {showFilter && (
            <FilterSheet
              applied={filters}
              onApply={(next) => {
                setFilters(next)
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
                <CityPickerSheet onClose={() => setShowCityPicker(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        (document.querySelector('main.phone-shell') ?? document.getElementById('root')) as HTMLElement,
      )}
    </div>
  )
}

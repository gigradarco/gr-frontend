import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { CheckCircle, ChevronLeft, ExternalLink, Funnel, Heart, Info, Maximize2, Minimize2, Pause, Play, RefreshCw, Share2 } from 'lucide-react'
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
import type { EventItem } from '../../types'
import { DiscoverMapCanvas } from './map/DiscoverMapCanvas'
import { eventLatLng, type EventMapPoint } from './map/map-geo'
import { compactDateTimeLabel, getAccent } from './map/map-pin-html'

function getCityName(cityId: string): string {
  for (const region of LOCATION_REGIONS) {
    const city = region.cities.find((c) => c.id === cityId)
    if (city) return city.name
  }
  return cityId
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localFilters, setLocalFilters] = useState<EventFeedFilters>(filters)
  const [showFilter, setShowFilter] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [shareEventTarget, setShareEventTarget] = useState<EventItem | null>(null)
  const [isCycling, setIsCycling] = useState(false)
  const [mapSheetState, setMapSheetState] = useState<MapSheetState>('peek')
  const [holdProgress, setHoldProgress] = useState(0)
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
      .filter((r): r is EventMapPoint => r.pos != null)
    return raw
  }, [events, localFilters, locationCityId])

  const cityCenter = useMemo(() => getDiscoverMapCityCenter(locationCityId), [locationCityId])
  const cityDefaultZoom = useMemo(() => getDiscoverMapCityDefaultZoom(locationCityId), [locationCityId])
  const cityName = getCityName(locationCityId)

  function selectAndScroll(id: string) {
    setSelectedId(id)
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
        <DiscoverMapCanvas
          theme={theme}
          points={cityEvents}
          selectedId={selectedId}
          cityCenter={cityCenter}
          cityDefaultZoom={cityDefaultZoom}
          onSelectEvent={selectAndScroll}
          onClearSelection={() => setSelectedId(null)}
        />

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
                <p className="mv-sheet-hint">
                  <span className="mv-sheet-hint-action mv-sheet-hint-action--hold">Hold down to hide</span>
                  <span className="mv-sheet-hint-sep" aria-hidden>
                    {' '}
                    ·{' '}
                  </span>
                  <span className="mv-sheet-hint-action mv-sheet-hint-action--tap">
                    {mapSheetState === 'expanded' ? 'Tap to shrink' : 'Tap to expand'}
                  </span>
                </p>
              </button>
              <div className="mv-carousel" ref={carouselRef}>
                {cityEvents.map(({ event }) => {
                  const isSel = selectedId === event.id
                  const isSaved = isEventFavorited(event.id)
                  const accent = getAccent(event)
                  const sourceUrl = (event.sourceUrl ?? '').trim()
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
                        <p className="mv-card-sub">{event.district}</p>
                        <p className="mv-card-price">{event.ticketPrice}</p>
                        <div className="mv-card-actions">
                          <button
                            type="button"
                            className="mv-card-details-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              onMoreDetails(event.id)
                            }}
                          >
                            <Info size={13} strokeWidth={2} aria-hidden />
                            <span>View event info</span>
                          </button>
                          <div className="mv-card-icon-row">
                            <button
                              type="button"
                              className="mv-card-icon-grid-btn"
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
                              className="mv-card-icon-grid-btn"
                              aria-label="View event source"
                              title="View event source"
                              disabled={!sourceUrl}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!sourceUrl) return
                                window.open(sourceUrl, '_blank', 'noopener,noreferrer')
                              }}
                            >
                              <ExternalLink size={13} strokeWidth={2} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="mv-card-icon-grid-btn"
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

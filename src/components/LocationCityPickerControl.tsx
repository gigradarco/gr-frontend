import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, MapPin, Search, X } from 'lucide-react'
import {
  filterLocationRegionsByQuery,
  formatLocationRegionHeading,
  getLocationCityById,
} from '../data/locationRegions'
import { useAppState } from '../store/appStore'

/** ── Trigger button only — sheet is rendered by the parent via createPortal ── */
export type LocationCityPickerControlProps = {
  triggerClassName: string
  wrapClassName?: string
  onOpen: () => void
  iconOnly?: boolean
}

export function LocationCityPickerControl({
  triggerClassName,
  wrapClassName,
  onOpen,
  iconOnly = false,
}: LocationCityPickerControlProps) {
  const locationCityId = useAppState((s) => s.feedLocationCityId)
  const locationLabel  = getLocationCityById(locationCityId)?.name ?? 'Singapore'
  const wrapClass      = wrapClassName ?? 'feed-filter-wrap'

  return (
    <div className={wrapClass}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="dialog"
        aria-label={`Location: ${locationLabel}. Choose city`}
        title={`Currently showing ${locationLabel} — tap to change city`}
        onClick={onOpen}
      >
        <MapPin className="feed-filter-pill-icon feed-filter-pill-icon--pin" size={16} strokeWidth={2.25} aria-hidden />
        {iconOnly ? null : <span>{locationLabel}</span>}
        {iconOnly ? null : <Search className="feed-filter-pill-search-hint" size={14} strokeWidth={2.25} aria-hidden />}
        {iconOnly ? null : <ChevronDown className="feed-filter-pill-chevron" size={14} strokeWidth={2.25} aria-hidden />}
      </button>
    </div>
  )
}

/** ── Sheet content — rendered by parent via createPortal inside AnimatePresence ── */
const PICKER_DOM_ID = 'discover'

/** Short version used in the dot-nav so long names fit comfortably */
function shortRegionLabel(label: string): string {
  const full = formatLocationRegionHeading(label)
  return full
    .replace(/^North\s+/i, 'N. ')
    .replace(/^South\s+/i, 'S. ')
    .replace(/^Asia\s+Pacific$/i, 'Asia Pac.')
    .replace(/^Central\s+/i, 'C. ')
    .replace(/^Middle\s+East/i, 'Mid. East')
}

type CityPickerSheetProps = {
  onClose: () => void
  statusMessage?: string | null
  autoCloseOnSelect?: boolean
  autoCloseDelayMs?: number
}

export function CityPickerSheet({
  onClose,
  statusMessage,
  autoCloseOnSelect = true,
  autoCloseDelayMs = 1000,
}: CityPickerSheetProps) {
  const locationCityId    = useAppState((s) => s.feedLocationCityId)
  const setLocationCityId = useAppState((s) => s.setFeedLocationCityId)
  const [query, setQuery] = useState('')
  const [localStatusMessage, setLocalStatusMessage] = useState<string | null>(null)
  const listboxId         = `${PICKER_DOM_ID}-location-listbox`
  const titleId           = `${PICKER_DOM_ID}-location-curtain-title`
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filteredRegions = useMemo(
    () => filterLocationRegionsByQuery(query),
    [query],
  )

  // ── Scroll-spy (same pattern as filter sheet) ──────────────────────────────
  const [activeIdx, setActiveIdx] = useState(0)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])

  // Reset active index when query changes (regions list may shrink/reorder)
  useMemo(() => { setActiveIdx(0) }, [query])

  const cascadeTargetRef = useRef(0)
  const cascadeTimers    = useRef<ReturnType<typeof setTimeout>[]>([])
  const activeIdxRef     = useRef(0)

  const cascadeTo = useCallback((target: number) => {
    if (cascadeTargetRef.current === target) return
    cascadeTimers.current.forEach(clearTimeout)
    cascadeTimers.current = []
    cascadeTargetRef.current = target

    const from = activeIdxRef.current
    if (target === from) return

    const dir   = target > from ? 1 : -1
    const steps: number[] = []
    for (let i = from + dir; dir > 0 ? i <= target : i >= target; i += dir) {
      steps.push(i)
    }
    steps.forEach((idx, i) => {
      const t = setTimeout(() => {
        activeIdxRef.current = idx
        setActiveIdx(idx)
      }, (i + 1) * 220)
      cascadeTimers.current.push(t)
    })
  }, [])

  const handleScroll = useCallback(() => {
    const body = scrollRef.current
    if (!body) return
    const maxScroll = body.scrollHeight - body.clientHeight
    if (maxScroll <= 0) return
    const progress = body.scrollTop / maxScroll
    const idx = Math.min(
      Math.floor(progress * filteredRegions.length),
      filteredRegions.length - 1,
    )
    cascadeTo(idx)
  }, [filteredRegions.length, cascadeTo])

  const scrollToRegion = useCallback((idx: number) => {
    const el = sectionRefs.current[idx]
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
    }
  }, [])

  const effectiveStatusMessage = statusMessage ?? localStatusMessage

  return (
    <>
      <div className="lcp-handle" aria-hidden />

      {/* Section indicator dots — same as ecf-filter-nav */}
      {filteredRegions.length > 1 && (
        <div className="ecf-filter-nav" aria-hidden>
          {filteredRegions.map((region, idx) => (
            <button
              key={region.id}
              type="button"
              className={`ecf-filter-nav-dot${activeIdx === idx ? ' ecf-filter-nav-dot--active' : ''}`}
              onClick={() => scrollToRegion(idx)}
              tabIndex={-1}
            >
              <span className="ecf-filter-nav-label">
                {shortRegionLabel(region.label)}
              </span>
            </button>
          ))}
        </div>
      )}

      <header className="lcp-header">
        <h2 id={titleId} className="lcp-title">Choose a city</h2>
        <button type="button" className="lcp-close" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2.5} aria-hidden />
        </button>
      </header>

      {effectiveStatusMessage ? (
        <p className="lcp-status-message" role="status" aria-live="polite">
          <span>{effectiveStatusMessage}</span>
          <span className="lcp-status-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </p>
      ) : null}

      <div className="lcp-search-wrap" role="presentation">
        <input
          type="search"
          className="feed-filter-menu-search lcp-search"
          placeholder="Search cities or regions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search cities and regions"
          autoComplete="off"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      <div
        className="lcp-scroll"
        id={listboxId}
        role="listbox"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {filteredRegions.length === 0 ? (
          <p className="lcp-empty">No cities match</p>
        ) : (
          filteredRegions.map((region, idx) => (
            <section
              key={region.id}
              className="lcp-region"
              aria-labelledby={`${PICKER_DOM_ID}-region-${region.id}`}
              ref={(el) => { sectionRefs.current[idx] = el }}
            >
              <h3
                className="lcp-region-heading"
                id={`${PICKER_DOM_ID}-region-${region.id}`}
              >
                {formatLocationRegionHeading(region.label)}
              </h3>
              <ul className="lcp-chip-row">
                {region.cities.map((city) => (
                  <li key={city.id} role="presentation">
                    <button
                      type="button"
                      className={`feed-location-curtain__chip${city.id === locationCityId ? ' is-active' : ''}`}
                      role="option"
                      aria-selected={city.id === locationCityId}
                      onClick={() => {
                        if (closeTimerRef.current) {
                          clearTimeout(closeTimerRef.current)
                          closeTimerRef.current = null
                        }
                        const isChanged = city.id !== locationCityId
                        setLocationCityId(city.id)
                        if (autoCloseOnSelect && isChanged) {
                          setLocalStatusMessage('Updating region, auto closing in 1 second')
                          closeTimerRef.current = setTimeout(() => {
                            closeTimerRef.current = null
                            onClose()
                          }, autoCloseDelayMs)
                        }
                      }}
                    >
                      {city.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  )
}

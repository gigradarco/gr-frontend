import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, Funnel, Heart, Info, Map, Maximize2, Minimize2, RefreshCw, Share2, X } from 'lucide-react'
import { LocationCityPickerControl, CityPickerSheet } from '../../components/LocationCityPickerControl'
import { DISCOVER_FEED_CATEGORY_FILTER_OPTIONS } from '../../data/exploreCategories'
import { useAppState } from '../../store/appStore'
import { handleEventImageError } from '../../lib/event-image-fallback'
import { fetchDiscoverEventById } from '../../lib/useDiscoverEvents'
import { EventShareSheet } from '../../components/EventShareSheet'
import { DISCOVER_FEED_CONFIG } from '../../config/discoverFeed'
import { DISCOVER_FILTER_SECTIONS } from '../../config/discoverUi'
import {
  AREA_FILTER,
  DATE_FILTER,
  DEFAULT_DISCOVER_FILTERS,
  PRICE_FILTER,
  TIME_FILTER,
  persistDiscoverCategoryFilters,
  readInitialDiscoverFilters,
  type DiscoverEventFilters,
} from '../../lib/discover-filters'
import type { EventItem } from '../../types'

// ─── Category → visual accent mapping (keyed by exploreCategoryId) ───────────
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

const CATEGORY_BG: Record<string, string> = {
  'live-music':  '#0d0500',
  'club-nights': '#000d1a',
  'jazz-blues':  '#000a05',
  underground:   '#0d0010',
  arts:          '#00100e',
  food:          '#1a0e00',
  popups:        '#001210',
  festivals:     '#0d0020',
}
const DEFAULT_BG = '#0a0a0a'

// Genre label → exploreCategoryId (for card visuals)
const GENRE_TO_CATEGORY: Record<string, string> = {
  Techno:        'club-nights',
  'Club Nights': 'club-nights',
  Jazz:          'jazz-blues',
  Electronic:    'underground',
  'Live Music':  'live-music',
  'Cocktail Bar':'food',
}

export type EventFeedFilters = DiscoverEventFilters
const DEFAULT_FILTERS: EventFeedFilters = DEFAULT_DISCOVER_FILTERS

function parseEventTimeMinutes(time: string): number | null {
  const m = time.trim().match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function parsePriceAmount(ticketPrice: string): number | null {
  const lower = ticketPrice.toLowerCase()
  if (lower.includes('free')) return 0
  const m = ticketPrice.match(/([\d.]+)/)
  if (!m) return null
  return Number.parseFloat(m[1])
}

function eventDate(event: EventItem): Date | null {
  if (event.eventDateTime) {
    const date = new Date(event.eventDateTime)
    return Number.isFinite(date.getTime()) ? date : null
  }
  const mins = parseEventTimeMinutes(event.displayDateTimeLabel ?? event.time)
  if (mins == null) return null
  const fallback = new Date()
  fallback.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return fallback
}

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function eventMatchesFilters(event: EventItem, f: EventFeedFilters): boolean {
  if (f.categories !== 'All' && !f.categories.includes(event.exploreCategoryId)) return false

  if (f.area !== 'All') {
    const area = f.area.toLowerCase()
    const locationText = `${event.venue} ${event.district}`.toLowerCase()
    if (!locationText.includes(area)) return false
  }

  if (f.date !== 'All') {
    const date = eventDate(event)
    if (!date) return false
    const today = startOfDay(new Date())
    const eventDay = startOfDay(date)
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / 86_400_000)
    if (f.date === 'Tonight' && diffDays !== 0) return false
    if (f.date === 'Tomorrow' && diffDays !== 1) return false
    if (f.date === 'Next 7 Days' && (diffDays < 0 || diffDays >= 7)) return false
    if (f.date === 'This Month') {
      if (date.getMonth() !== today.getMonth() || date.getFullYear() !== today.getFullYear()) return false
    }
    if (f.date === 'Next 90 Days' && (diffDays < 0 || eventDay >= addDays(today, 90))) return false
    if (f.date === 'Custom Range') {
      const hasStartDate = f.startDate.trim().length > 0
      const hasEndDate = f.endDate.trim().length > 0
      const hasStartTime = f.startTime.trim().length > 0
      const hasEndTime = f.endTime.trim().length > 0
      if (hasStartDate || hasEndDate || hasStartTime || hasEndTime) {
        const eventMs = date.getTime()
        let startMs: number | null = null
        let endMs: number | null = null
        if (hasStartDate) {
          const start = new Date(`${f.startDate}T${hasStartTime ? f.startTime : '00:00'}:00`)
          if (Number.isFinite(start.getTime())) startMs = start.getTime()
        }
        if (hasEndDate) {
          const end = new Date(`${f.endDate}T${hasEndTime ? f.endTime : '23:59'}:59`)
          if (Number.isFinite(end.getTime())) endMs = end.getTime()
        }
        if (startMs != null && eventMs < startMs) return false
        if (endMs != null && eventMs > endMs) return false
      }
    }
  }

  if (f.time !== 'All') {
    const mins = parseEventTimeMinutes(event.displayDateTimeLabel ?? event.time)
    if (mins != null) {
      const t18 = 18 * 60
      const t21 = 21 * 60
      const t23 = 23 * 60
      if (f.time === 'Early Evening (6-9PM)' && (mins < t18 || mins >= t21)) return false
      if (f.time === 'Prime (9-11PM)' && (mins < t21 || mins >= t23)) return false
      if (f.time === 'Late Night (11PM+)' && mins < t23) return false
    }
  }

  if (f.price !== 'All') {
    const lower = event.ticketPrice.toLowerCase()
    const isFree = lower.includes('free')
    const n = parsePriceAmount(event.ticketPrice)
    const amount = n ?? (isFree ? 0 : NaN)

    if (f.price === 'Free') {
      if (!isFree && amount !== 0) return false
    } else if (Number.isNaN(amount)) {
      return false
    } else if (f.price === 'Under $20') {
      if (amount >= 20) return false
    } else if (f.price === '$20-$50') {
      if (amount < 20 || amount >= 50) return false
    } else if (f.price === '$50+') {
      if (amount < 50) return false
    }
  }

  return true
}

export function countActiveFilters(f: EventFeedFilters): number {
  let n = 0
  if (f.categories !== 'All' && f.categories.length > 0) n += 1
  if (f.date !== 'All') n += 1
  if (f.time !== 'All') n += 1
  if (f.area !== 'All') n += 1
  if (f.price !== 'All') n += 1
  return n
}

function getAccent(genre: string) {
  const catId = GENRE_TO_CATEGORY[genre] ?? genre
  return CATEGORY_ACCENT[catId] ?? DEFAULT_ACCENT
}

function getBg(genre: string) {
  const catId = GENRE_TO_CATEGORY[genre] ?? genre
  return CATEGORY_BG[catId] ?? DEFAULT_BG
}

function getTag(event: EventItem): string {
  const label = event.displayDateTimeLabel ?? event.time
  if (/^date tba/i.test(label)) return 'DATE TBA'
  if (/^tonight/i.test(label)) return 'TONIGHT'
  if (/^tmr/i.test(label)) return 'TOMORROW'
  return label.toUpperCase()
}

function eventDateTimeLabel(event: EventItem): string {
  return event.displayDateTimeLabel ?? event.time
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

function titleDensityClass(title: string): string {
  const normalized = title.trim().replace(/\s+/g, ' ')
  const wordCount = normalized.split(' ').filter(Boolean).length
  if (normalized.length >= 92 || wordCount >= 12) return ' ecf-title--extreme'
  if (normalized.length >= 68 || wordCount >= 9) return ' ecf-title--very-long'
  if (normalized.length >= 46 || wordCount >= 6) return ' ecf-title--long'
  return ''
}

// ─── Single card ─────────────────────────────────────────────────────────────
type EventCardProps = {
  event: EventItem
  isGoing: boolean
  isSaved: boolean
  onGoing: () => void
  onSave: () => void
  onShare: () => void
  onMoreDetails: () => void
}

function EventCard({ event, isGoing, isSaved, onGoing, onSave, onShare, onMoreDetails }: EventCardProps) {
  const [loaded, setLoaded] = useState(false)
  const accent = getAccent(event.genre)
  const bgColor = getBg(event.genre)
  const tag = getTag(event)
  const titleClassName = `ecf-title${titleDensityClass(event.title)}`

  return (
    <div className="ecf-slide" style={{ background: bgColor }}>
      <img
        src={event.image}
        alt={event.title}
        className={`ecf-bg-img${loaded ? ' ecf-bg-img--loaded' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={(e) => handleEventImageError(event, e)}
        loading="lazy"
        decoding="async"
      />
      <div
        className="ecf-overlay"
        style={{
          background: `linear-gradient(160deg, ${bgColor}88 0%, transparent 50%, ${bgColor}ff 75%)`,
        }}
      />

      {/* Tag badge */}
      <div className="ecf-tags">
        <span
          className="ecf-tag"
          style={{ border: `1px solid ${accent}66`, color: accent }}
        >
          {tag}
        </span>
      </div>

      {/* Bottom content block */}
      <div className="ecf-body">
        {/* Spacer pushes content down to the bottom action zone. */}
        <div className="ecf-body-spacer" />
        <div className="ecf-headline">
          <p className="ecf-genre" style={{ color: accent }}>
            {event.genre.toUpperCase()}
          </p>
          <h2 className={titleClassName} title={event.title}>
            {event.title.toUpperCase()}
          </h2>
        </div>

        <div className="ecf-lede">
          <p className="ecf-lede-primary">{event.venue}</p>
          {event.vibeTags.length > 0 || event.hostPrompt ? (
            <p className="ecf-lede-secondary">
              {event.vibeTags.length > 0 ? event.vibeTags.join(' · ') : null}
              {event.hostPrompt ? (
                <span className="ecf-lede-hook">
                  {event.vibeTags.length > 0 ? ' ' : null}&mdash; {event.hostPrompt}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div
          className="ecf-meta-row"
          role="group"
          aria-label={`${event.district}, ${eventDateTimeLabel(event)}, ${event.ticketPrice}`}
        >
          {[
            { label: 'WHERE', value: event.district },
            { label: 'WHEN',  value: eventDateTimeLabel(event) },
            { label: 'PRICE', value: event.ticketPrice },
          ].map((m) => (
            <div key={m.label} className="ecf-meta-col">
              <span className="ecf-meta-label">{m.label}</span>
              <strong className="ecf-meta-value">{m.value}</strong>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="ecf-actions">
          <button
            type="button"
            className={`ecf-going-btn${isGoing ? ' ecf-going-btn--active' : ''}`}
            onClick={onGoing}
            title={isGoing ? "You're going — tap to undo" : "Mark yourself as going"}
          >
            {isGoing ? '✓ I\'m Going' : 'I\'m Going'}
          </button>
          <button
            type="button"
            className="ecf-details-btn"
            aria-label={`More details for ${event.title}`}
            title="See full event details"
            onClick={onMoreDetails}
          >
            <Info size={16} strokeWidth={2} aria-hidden />
            <span className="ecf-details-btn-label">More details</span>
          </button>
          <button
            type="button"
            className="ecf-icon-btn"
            aria-label="Save event"
            title={isSaved ? 'Remove from saved' : 'Save event'}
            onClick={onSave}
            style={isSaved ? { color: accent, borderColor: accent } : undefined}
          >
            <Heart
              size={18}
              strokeWidth={isSaved ? 2.5 : 2}
              fill={isSaved ? accent : 'none'}
              aria-hidden
            />
          </button>
          <button
            type="button"
            className="ecf-icon-btn"
            aria-label="Share event"
            title="Share this event"
            onClick={onShare}
          >
            <Share2 size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter bottom sheet ──────────────────────────────────────────────────────
type FilterSectionName = (typeof DISCOVER_FILTER_SECTIONS)[number]

export type FilterSheetProps = {
  applied: EventFeedFilters
  onApply: (next: EventFeedFilters) => void
  onClose: () => void
}

export { DEFAULT_FILTERS }

export function FilterSheet({ applied, onApply, onClose }: FilterSheetProps) {
  const subscriptionTier = useAppState((s) => s.subscriptionTier)
  const [draft, setDraft] = useState<EventFeedFilters>(applied)
  const [activeSection, setActiveSection] = useState<FilterSectionName>('Category')
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Partial<Record<FilterSectionName, HTMLElement>>>({})
  const activeSectionRef = useRef<FilterSectionName>('Category')
  const cascadeTargetRef = useRef<FilterSectionName>('Category')
  const cascadeTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  useLayoutEffect(() => {
    setDraft(applied)
  }, [applied])

  // Cascade to a target section one step at a time with 120 ms between each.
  // Guards against continuous scroll events restarting mid-cascade by only
  // acting when the target actually changes.
  const cascadeTo = useCallback((target: FilterSectionName) => {
    if (cascadeTargetRef.current === target) return   // already heading there

    cascadeTimers.current.forEach(clearTimeout)
    cascadeTimers.current = []
    cascadeTargetRef.current = target

    const fromIdx = DISCOVER_FILTER_SECTIONS.indexOf(activeSectionRef.current)
    const toIdx   = DISCOVER_FILTER_SECTIONS.indexOf(target)
    if (toIdx === fromIdx) return

    const dir = toIdx > fromIdx ? 1 : -1
    const steps: FilterSectionName[] = []
    for (let i = fromIdx + dir; dir > 0 ? i <= toIdx : i >= toIdx; i += dir) {
      steps.push(DISCOVER_FILTER_SECTIONS[i])
    }

    steps.forEach((section, i) => {
      const t = setTimeout(() => {
        activeSectionRef.current = section
        setActiveSection(section)
      }, (i + 1) * 220)           // 220 ms per step so each section is clearly visible
      cascadeTimers.current.push(t)
    })
  }, [])

  useEffect(() => {
    return () => cascadeTimers.current.forEach(clearTimeout)
  }, [])

  // Scroll-spy: divide the full scroll range into N equal zones, one per
  // section. This guarantees every section (including Area and Price) gets its
  // own slice regardless of how much scrollable content is below it.
  const handleBodyScroll = useCallback(() => {
    const body = bodyRef.current
    if (!body) return

    const maxScroll = body.scrollHeight - body.clientHeight
    if (maxScroll <= 0) return

    const progress = body.scrollTop / maxScroll                        // 0 → 1
    const idx = Math.min(
      Math.floor(progress * DISCOVER_FILTER_SECTIONS.length),
      DISCOVER_FILTER_SECTIONS.length - 1,
    )
    cascadeTo(DISCOVER_FILTER_SECTIONS[idx])
  }, [cascadeTo])

  const scrollToSection = useCallback((name: FilterSectionName) => {
    const el = sectionRefs.current[name]
    if (!el || !bodyRef.current) return
    bodyRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' })
  }, [])

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      className={`ecf-filter-chip${active ? ' ecf-filter-chip--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )

  return (
    <motion.div
      className="ecf-filter-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="ecf-filter-sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="ecf-filter-handle" />

        {/* Section indicator dots */}
        <div className="ecf-filter-nav" aria-hidden>
          {DISCOVER_FILTER_SECTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className={`ecf-filter-nav-dot${activeSection === name ? ' ecf-filter-nav-dot--active' : ''}`}
              onClick={() => scrollToSection(name)}
              tabIndex={-1}
            >
              <span className="ecf-filter-nav-label">{name}</span>
            </button>
          ))}
        </div>

        <div className="ecf-filter-title-row">
          <h2 className="ecf-filter-title">Filter</h2>
          <span className={`ecf-filter-tier-hint ecf-filter-tier-hint--${subscriptionTier}`}>
            {subscriptionTier === 'pro' ? 'Pro search · up to 1 year' : 'Free search · up to 6 months'}
          </span>
        </div>

        <div className="ecf-filter-body" ref={bodyRef} onScroll={handleBodyScroll}>
          <section
            className="ecf-filter-section"
            data-section="Category"
            ref={(el) => { if (el) sectionRefs.current.Category = el }}
          >
            <p className="ecf-filter-section-label">Category</p>
            <div className="ecf-filter-chips">
              {DISCOVER_FEED_CATEGORY_FILTER_OPTIONS.map((c) => {
                const isAll = c.id === 'All'
                const active = isAll
                  ? draft.categories === 'All'
                  : draft.categories !== 'All' && draft.categories.includes(c.id)
                const onCategoryClick = () => {
                  setDraft((d) => {
                    if (isAll) {
                      return { ...d, categories: 'All' }
                    }
                    if (d.categories === 'All') {
                      return { ...d, categories: [c.id] }
                    }
                    const list = d.categories
                    const has = list.includes(c.id)
                    const next = has ? list.filter((x) => x !== c.id) : [...list, c.id]
                    return { ...d, categories: next.length === 0 ? 'All' : next }
                  })
                }
                return chip(active, c.label, onCategoryClick)
              })}
            </div>
          </section>

          <section
            className="ecf-filter-section"
            data-section="Date"
            ref={(el) => { if (el) sectionRefs.current.Date = el }}
          >
            <p className="ecf-filter-section-label">Date</p>
            <div className="ecf-filter-chips">
              {DATE_FILTER.map((d) =>
                chip(draft.date === d, d, () =>
                  setDraft((prev) => ({
                    ...prev,
                    date: d,
                    ...(d !== 'Custom Range'
                      ? { startDate: '', endDate: '', startTime: '', endTime: '' }
                      : {}),
                  })),
                ),
              )}
            </div>
            {draft.date === 'Custom Range' ? (
              <div className="ecf-filter-range-grid">
                <label className="ecf-filter-range-field">
                  <span>Start date</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </label>
                <label className="ecf-filter-range-field">
                  <span>End date</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section
            className="ecf-filter-section"
            data-section="Time"
            ref={(el) => { if (el) sectionRefs.current.Time = el }}
          >
            <p className="ecf-filter-section-label">Time</p>
            <p className="ecf-filter-section-note">Times shown in SGT</p>
            <div className="ecf-filter-chips">
              {TIME_FILTER.map((t) =>
                chip(draft.time === t, t, () => setDraft((d) => ({ ...d, time: t }))),
              )}
            </div>
            {draft.date === 'Custom Range' ? (
              <div className="ecf-filter-range-grid">
                <label className="ecf-filter-range-field">
                  <span>Start time</span>
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) => setDraft((prev) => ({ ...prev, startTime: e.target.value }))}
                  />
                </label>
                <label className="ecf-filter-range-field">
                  <span>End time</span>
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(e) => setDraft((prev) => ({ ...prev, endTime: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}
          </section>

          <section
            className="ecf-filter-section"
            data-section="Area"
            ref={(el) => { if (el) sectionRefs.current.Area = el }}
          >
            <p className="ecf-filter-section-label">Area</p>
            <div className="ecf-filter-chips">
              {AREA_FILTER.map((a) =>
                chip(draft.area === a, a, () => setDraft((d) => ({ ...d, area: a }))),
              )}
            </div>
          </section>

          <section
            className="ecf-filter-section"
            data-section="Price"
            ref={(el) => { if (el) sectionRefs.current.Price = el }}
          >
            <p className="ecf-filter-section-label">Price</p>
            <div className="ecf-filter-chips">
              {PRICE_FILTER.map((p) =>
                chip(draft.price === p, p, () => setDraft((d) => ({ ...d, price: p }))),
              )}
            </div>
          </section>
        </div>

        <button
          type="button"
          className="ecf-filter-apply"
          onClick={() => {
            if (
              draft.date === 'Custom Range' &&
              draft.startDate &&
              draft.endDate &&
              new Date(`${draft.startDate}T${draft.startTime || '00:00'}:00`).getTime() >
                new Date(`${draft.endDate}T${draft.endTime || '23:59'}:59`).getTime()
            ) {
              return
            }
            onApply(draft)
          }}
        >
          Show Results
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main EventCardFeed ───────────────────────────────────────────────────────
type EventCardFeedProps = {
  events: EventItem[]
  filters: EventFeedFilters
  onFiltersChange: (next: EventFeedFilters) => void
  loading?: boolean
  loadingMore?: boolean
  error?: string | null
  hasMore?: boolean
  totalAvailable?: number | null
  onLoadMore?: () => void
  onMoreDetails: (eventId: string) => void
  onMapView?: () => void
  onRefresh?: () => void
}

export function EventCardFeed({
  events,
  filters,
  onFiltersChange,
  loading = false,
  loadingMore = false,
  error = null,
  hasMore = false,
  totalAvailable = null,
  onLoadMore,
  onMoreDetails,
  onMapView,
  onRefresh,
}: EventCardFeedProps) {
  const locationCityId = useAppState((s) => s.feedLocationCityId)
  const isDiscoverExpanded = useAppState((s) => s.isDiscoverExpanded)
  const toggleDiscoverExpanded = useAppState((s) => s.toggleDiscoverExpanded)

  const [localFilters, setLocalFilters] = useState<EventFeedFilters>(filters)
  const [showFilter, setShowFilter] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [going, setGoing] = useState<string[]>([])
  const toggleFavoriteEvent = useAppState((s) => s.toggleFavoriteEvent)
  const isEventFavorited = useAppState((s) => s.isEventFavorited)
  const [cardIdx, setCardIdx] = useState(0)
  const [shareEventTarget, setShareEventTarget] = useState<EventItem | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollElRef = useRef<HTMLDivElement | null>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const endSentinelRef = useRef<HTMLDivElement | null>(null)
  const prevRenderedLengthRef = useRef(0)
  const prevRenderWindowOffsetRef = useRef(0)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const filtered = useMemo(
    () =>
      events
        .filter((e) => e.locationCityId === locationCityId)
        .filter((e) => eventMatchesFilters(e, localFilters)),
    [events, localFilters, locationCityId],
  )

  const renderWindowOffset =
    filtered.length > DISCOVER_FEED_CONFIG.hardRenderedEventCount
      ? Math.max(0, filtered.length - DISCOVER_FEED_CONFIG.softRenderedEventCount)
      : 0
  const renderedEvents = useMemo(
    () => (renderWindowOffset > 0 ? filtered.slice(renderWindowOffset) : filtered),
    [filtered, renderWindowOffset],
  )

  const activeCount = countActiveFilters(localFilters)

  const scrollToCard = useCallback((idx: number) => {
    const el = scrollElRef.current
    if (!el) return
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' })
  }, [])

  const requestLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return
    onLoadMore?.()
  }, [hasMore, loading, loadingMore, onLoadMore])

  const maybeLoadMoreFromScroll = useCallback(() => {
    const el = scrollElRef.current
    if (!el || !hasMore || loadingMore || loading) return
    const remainingPx = el.scrollHeight - el.scrollTop - el.clientHeight
    const nearEndByDistance = remainingPx <= el.clientHeight * DISCOVER_FEED_CONFIG.loadMoreScrollBufferScreens
    const idx = Math.round(el.scrollTop / el.clientHeight)
    const nearEndByCard = idx >= Math.max(0, renderedEvents.length - DISCOVER_FEED_CONFIG.loadMoreCardBuffer)
    if (nearEndByDistance || nearEndByCard) {
      onLoadMore?.()
    }
  }, [hasMore, loading, loadingMore, onLoadMore, renderedEvents.length])

  // Callback ref — attaches scroll + scrollend listeners the instant the div mounts
  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    if (scrollElRef.current) {
      scrollElRef.current.removeEventListener('scroll', onScrollRef.current!)
      scrollElRef.current.removeEventListener('scrollend', onScrollEndRef.current!)
    }
    scrollElRef.current = el
    ;(scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    if (el) {
      el.addEventListener('scroll', onScrollRef.current!, { passive: true })
      if ('onscrollend' in el) {
        el.addEventListener('scrollend', onScrollEndRef.current!, { passive: true })
      }
    }
  }, [])

  const onScrollRef = useRef<(() => void) | undefined>(undefined)
  onScrollRef.current = () => {
    const el = scrollElRef.current
    if (!el) return
    const idx = Math.round(el.scrollTop / el.clientHeight)
    setCardIdx(idx)
    maybeLoadMoreFromScroll()
  }

  const onScrollEndRef = useRef<(() => void) | undefined>(undefined)
  onScrollEndRef.current = () => {
    const el = scrollElRef.current
    if (!el) return
    setCardIdx(Math.round(el.scrollTop / el.clientHeight))
    maybeLoadMoreFromScroll()
  }

  // When onboarding finishes, pick up the newly written localStorage categories
  const showOnboarding = useAppState((s) => s.showOnboarding)
  const prevShowOnboarding = useRef(showOnboarding)
  useEffect(() => {
    if (prevShowOnboarding.current && !showOnboarding) {
      const next = readInitialDiscoverFilters()
      setLocalFilters((prev) => ({ ...prev, categories: next.categories }))
      onFiltersChange({ ...localFilters, categories: next.categories })
    }
    prevShowOnboarding.current = showOnboarding
  }, [localFilters, onFiltersChange, showOnboarding])

  // Reset scroll position when city or filters change.
  useLayoutEffect(() => {
    const el = scrollElRef.current
    if (el) el.scrollTop = 0
    setCardIdx(0)
    prevRenderedLengthRef.current = renderedEvents.length
    prevRenderWindowOffsetRef.current = renderWindowOffset
  }, [localFilters, locationCityId])

  useLayoutEffect(() => {
    const prevLength = prevRenderedLengthRef.current
    const prevOffset = prevRenderWindowOffsetRef.current
    const droppedFromWindow = renderWindowOffset - prevOffset
    const el = scrollElRef.current
    if (el && droppedFromWindow > 0) {
      const nextIdx = Math.max(0, cardIdx - droppedFromWindow)
      el.scrollTo({ top: nextIdx * el.clientHeight, behavior: 'auto' })
      setCardIdx(nextIdx)
    } else if (el && prevLength > 0 && renderedEvents.length > prevLength && cardIdx >= prevLength) {
      el.scrollTo({ top: prevLength * el.clientHeight, behavior: 'auto' })
      setCardIdx(prevLength)
    }
    prevRenderedLengthRef.current = renderedEvents.length
    prevRenderWindowOffsetRef.current = renderWindowOffset
  }, [cardIdx, renderedEvents.length, renderWindowOffset])

  useEffect(() => {
    const root = scrollElRef.current
    const sentinels = [loadMoreSentinelRef.current, endSentinelRef.current].filter(
      (node): node is HTMLDivElement => node != null,
    )
    if (!root || sentinels.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((entry) => entry.isIntersecting)
        if (!hit) return
        requestLoadMore()
      },
      {
        root,
        rootMargin: '0px 0px 200% 0px',
        threshold: 0.01,
      },
    )
    sentinels.forEach((sentinel) => observer.observe(sentinel))
    return () => observer.disconnect()
  }, [renderedEvents.length, requestLoadMore])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => maybeLoadMoreFromScroll())
    return () => window.cancelAnimationFrame(frame)
  }, [renderedEvents.length, maybeLoadMoreFromScroll])

  // Fail-safe for snap/observer edge cases:
  // if user is already on the end card and we still have more pages, keep loading.
  useEffect(() => {
    if (!hasMore || loadingMore || loading) return
    if (renderedEvents.length === 0) return
    if (cardIdx >= renderedEvents.length) {
      requestLoadMore()
    }
  }, [cardIdx, hasMore, loading, loadingMore, renderedEvents.length, requestLoadMore])

  const toggleGoing = (id: string) =>
    setGoing((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )

  const openEventSourceInNewTab = useCallback(async (event: EventItem) => {
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer')
    const openTarget = (target: string) => {
      if (popup) popup.location.replace(target)
      else window.open(target, '_blank', 'noopener,noreferrer')
    }

    const directUrl = event.sourceUrl?.trim()
    if (directUrl) {
      openTarget(directUrl)
      toggleGoing(event.id)
      return
    }

    try {
      const detail = await fetchDiscoverEventById(event.id)
      const resolvedUrl = detail.sourceUrl?.trim()
      if (resolvedUrl) {
        openTarget(resolvedUrl)
        toggleGoing(event.id)
        return
      }
    } catch {
      // Fall back below.
    }

    if (popup) popup.close()
    onMoreDetails(event.id)
  }, [onMoreDetails])

  return (
    <div className="ecf-root">
      {/* Header */}
      <div className="ecf-header">
        <div className="ecf-header-inner">
          <div className="ecf-chip-row">
            <button
              type="button"
              className={`ecf-chip-btn ecf-chip-btn--filter ecf-chip-btn--icon-only${activeCount > 0 ? ' ecf-chip-btn--active' : ''}`}
              onClick={() => setShowFilter(true)}
              title={activeCount > 0 ? `Filters active (${activeCount}) — click to edit` : 'Filter events'}
              aria-label={activeCount > 0 ? `Filter · ${activeCount} active` : 'Filter events'}
            >
              <span className="ecf-chip-filter-icon-wrap">
                <Funnel className="ecf-chip-filter-icon" size={14} strokeWidth={2.25} aria-hidden />
                {activeCount > 0 && (
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
            {activeCount > 0 && (
              <button
                type="button"
                className="ecf-chip-btn ecf-chip-btn--active ecf-chip-btn--clear"
                onClick={() => {
                  setLocalFilters(DEFAULT_FILTERS)
                  onFiltersChange(DEFAULT_FILTERS)
                  persistDiscoverCategoryFilters('All')
                }}
                title="Clear all filters"
                aria-label="Clear all filters"
              >
                <X size={13} strokeWidth={2.5} aria-hidden className="ecf-chip-clear-icon" />
                <span>Clear all</span>
              </button>
            )}
          </div>
          <span className="ecf-header-count">
            {typeof totalAvailable === 'number'
              ? `${filtered.length} of ${totalAvailable} events`
              : `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`}
          </span>
          <button
            type="button"
            className="ecf-map-view-btn"
            onClick={onMapView}
            aria-label="Switch to map view"
            title="Switch to map view"
          >
            <Map size={14} strokeWidth={2.25} aria-hidden />
            <span>Map</span>
          </button>
        </div>
      </div>

      {/* Scroll progress indicator */}
      {filtered.length > 0 && (
        <div className="ecf-progress">
          {renderedEvents.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`ecf-progress-dot${i === cardIdx ? ' ecf-progress-dot--active' : ''}`}
              onClick={() => scrollToCard(i)}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Scroll container */}
      <div
        ref={setScrollEl}
        className="ecf-scroll"
        role="feed"
        aria-label="Event cards"
      >
        {loading && filtered.length === 0 ? (
          <div className="ecf-empty">
            <div className="ecf-empty-line" />
            <p className="ecf-empty-text">
              Loading events
              <br />
              <span>Pulling the latest Discover feed</span>
            </p>
          </div>
        ) : error && filtered.length === 0 ? (
          <div className="ecf-empty">
            <div className="ecf-empty-line" />
            <p className="ecf-empty-text">
              Events failed to load
              <br />
              <span>{error}</span>
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ecf-empty">
            <div className="ecf-empty-line" />
            {activeCount > 0 ? (
              <>
                <p className="ecf-empty-text">
                  No matching events
                  <br />
                  <span>Try adjusting your filters</span>
                </p>
                <button
                  type="button"
                  className="ecf-empty-clear"
                  onClick={() => {
                    setLocalFilters(DEFAULT_FILTERS)
                    onFiltersChange(DEFAULT_FILTERS)
                    persistDiscoverCategoryFilters('All')
                  }}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <p className="ecf-empty-text">
                Nothing on in this city yet
                <br />
                <span>Check back soon or try another city</span>
              </p>
            )}
          </div>
        ) : (
          <>
            {renderedEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                isGoing={going.includes(ev.id)}
                isSaved={isEventFavorited(ev.id)}
                onGoing={() => openEventSourceInNewTab(ev)}
                onSave={() => toggleFavoriteEvent(toFavoriteEvent(ev))}
                onShare={() => setShareEventTarget(ev)}
                onMoreDetails={() => onMoreDetails(ev.id)}
              />
            ))}
            <div className="ecf-load-more-sentinel" ref={loadMoreSentinelRef} aria-hidden />
            {/* End-of-feed sentinel */}
            <div className="ecf-end-card" role="status" aria-live="polite" ref={endSentinelRef}>
              <div className="ecf-end-line" />
              {loadingMore && <span className="ecf-end-spinner" aria-hidden />}
              <p className="ecf-end-text">
                {loadingMore ? 'Loading more events...' : hasMore ? 'Scroll for more events.' : 'No more events.'}
                <br />
                <span>
                  {loadingMore
                    ? 'Hang tight while we pull in the next batch.'
                    : hasMore
                      ? 'More nights are queued up.'
                      : 'You can scroll back up to revisit earlier picks.'}
                </span>
              </p>
              {hasMore && !loadingMore && (
                <button
                  type="button"
                  className="ecf-end-load-more"
                  onClick={requestLoadMore}
                >
                  Load more events
                </button>
              )}
            </div>
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
                if (next.categories !== localFilters.categories) persistDiscoverCategoryFilters(next.categories)
              }}
              onClose={() => setShowFilter(false)}
            />
          )}
        </AnimatePresence>,
        (document.querySelector('main.phone-shell') ?? document.getElementById('root')) as HTMLElement,
      )}

      {/* City picker — identical portal/animation structure as filter sheet */}
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

      {shareEventTarget
        ? createPortal(
            <EventShareSheet
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

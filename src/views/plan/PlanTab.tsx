import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, MapPin, X } from 'lucide-react'
import {
  planDetailFromEventItem,
} from '../../data/demoData'
import { PLAN_CONFIG } from '../../config/plan'
import { PLAN_PATHS } from '../../config/routes'
import { formatEventPriceLabel } from '../../lib/event-price-label'
import {
  getPlanScheduledEventPath,
  navigateShellToTab,
  planScheduledEventIdFromPath,
  planShellViewFromPath,
} from '../../lib/tabRoutes'
import {
  prunePlanDetailCache,
  readFreshPlanDetails,
  upsertPlanDetailCache,
  type PlanCachedRow,
  type PlanSegment,
} from '../../lib/plan-detail-cache'
import { api } from '../../lib/trpc'
import { useEventPlans } from '../../lib/useEventPlans'
import { isPastPlanEventDateTime, planSegmentForEventDateTime } from '../../lib/plan-event-date'
import { fetchDiscoverEventById, mapDiscoverEventListItemToEventItem } from '../../lib/useDiscoverEvents'
import { useAppState, type FavoriteEvent } from '../../store/appStore'
import type { EventItem, PlanPageEvent, Tab } from '../../types'
import { fetchCityWeatherSummary, type CityWeatherSummary } from '../../lib/event-weather-summary'
import { PlanCancelConfirmDialog } from './PlanCancelConfirmDialog'
import { PlanEventDetail } from './PlanEventDetail'
import { PlanEventReview } from './PlanEventReview'
import { PlanHub } from './PlanHub'
import { PlanScheduledScreen } from './PlanScheduledScreen'
import { PlanWeatherScreen } from './PlanWeatherScreen'

type PendingCancelPlan = {
  eventId: string
  title: string
}

type PlanTabProps = {
  events: EventItem[]
  onOpenEvent: (eventId: string) => void
}

async function fetchPlanEventDetails(ids: string[], signal: AbortSignal): Promise<PlanCachedRow[]> {
  const out: PlanCachedRow[] = []
  for (let i = 0; i < ids.length; i += PLAN_CONFIG.refreshBatchSize) {
    if (signal.aborted) break
    const batch = ids.slice(i, i + PLAN_CONFIG.refreshBatchSize)
    const results = await Promise.allSettled(batch.map((id) => fetchDiscoverEventById(id, signal)))
    for (const result of results) {
      if (result.status === 'fulfilled') {
        out.push({
          event: result.value,
          segment: planSegmentForEventDateTime(result.value.eventDateTime),
        })
      }
    }
  }
  return out
}

function tabReturnAriaLabel(t: Tab): string {
  switch (t) {
    case 'discover':
      return 'Back to discover'
    case 'ask':
      return 'Back to Ask Buzo'
    case 'favorites':
      return 'Back to saved events'
    case 'plan':
      return 'Back to plan'
    case 'profile':
      return 'Back to profile'
  }
}

export function PlanTab({ events, onOpenEvent }: PlanTabProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const planView = planShellViewFromPath(location.pathname)
  const scheduledEventId = planScheduledEventIdFromPath(location.pathname)
  const isAuthenticated = useAppState((s) => s.isAuthenticated)
  const openSignIn = useAppState((s) => s.openSignIn)
  const pendingPlanDetail = useAppState((s) => s.pendingPlanDetail)
  const clearPendingPlanDetail = useAppState((s) => s.clearPendingPlanDetail)
  const toggleFavoriteEvent = useAppState((s) => s.toggleFavoriteEvent)
  const isEventFavorited = useAppState((s) => s.isEventFavorited)
  const { isEventPlanned, toggleEventPlan, plannedEventIds, isUpdating } = useEventPlans()
  const utils = api.useUtils()
  const [cachedPlan, setCachedPlan] = useState<Record<string, PlanCachedRow>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const requestedIdsRef = useRef(new Set<string>())

  const upcomingQuery = api.plan.upcoming.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: PLAN_CONFIG.cacheFreshMs,
  })
  const [pastOffset, setPastOffset] = useState(0)
  const [pastEvents, setPastEvents] = useState<EventItem[]>([])
  const [pastTotal, setPastTotal] = useState(0)
  const [pastNextOffset, setPastNextOffset] = useState<number | null>(null)
  const historyLoadMoreRef = useRef<HTMLDivElement | null>(null)
  const pastQuery = api.plan.past.useQuery({
    limit: PLAN_CONFIG.historyPageSize,
    offset: pastOffset,
  }, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: PLAN_CONFIG.cacheFreshMs,
  })

  const [segment, setSegment] = useState<'upcoming' | 'past'>('upcoming')
  const [cityWeather, setCityWeather] = useState<CityWeatherSummary | null>(null)
  const [cityWeatherLoading, setCityWeatherLoading] = useState(false)
  const [detailReturnTab, setDetailReturnTab] = useState<Tab | null>(null)
  const [reviewPastId, setReviewPastId] = useState<string | null>(null)
  const [pendingCancelPlan, setPendingCancelPlan] = useState<PendingCancelPlan | null>(null)

  useEffect(() => {
    setPendingCancelPlan(null)
  }, [location.pathname])

  const openPlanHub = useCallback(() => {
    navigate(PLAN_PATHS.hub)
  }, [navigate])

  const openPlanWeather = useCallback(() => {
    navigate(PLAN_PATHS.weather)
  }, [navigate])

  const openPlanScheduled = useCallback(() => {
    navigate(PLAN_PATHS.scheduled)
  }, [navigate])

  const upcomingEvents = useMemo(
    () => (upcomingQuery.data ?? []).map(mapDiscoverEventListItemToEventItem),
    [upcomingQuery.data],
  )

  const upcomingDisplayEvents = useMemo(() => {
    const fromServer = upcomingEvents.filter((event) => !isPastPlanEventDateTime(event.eventDateTime))
    if (fromServer.length > 0) return fromServer

    const live = events
      .filter((event) => plannedEventIds.includes(event.id))
      .filter((event) => !isPastPlanEventDateTime(event.eventDateTime))
    if (live.length > 0) return live

    return Object.values(cachedPlan)
      .filter((row) => !isPastPlanEventDateTime(row.event.eventDateTime))
      .map((row) => row.event)
  }, [cachedPlan, events, plannedEventIds, upcomingEvents])

  const pastDisplayEvents = useMemo(() => {
    const fromServer = pastEvents.filter((event) => isPastPlanEventDateTime(event.eventDateTime))
    if (fromServer.length > 0) return fromServer

    return Object.values(cachedPlan)
      .filter((row) => isPastPlanEventDateTime(row.event.eventDateTime))
      .map((row) => row.event)
  }, [cachedPlan, pastEvents])

  const detailKind = useMemo((): 'upcoming' | 'past' | null => {
    if (!scheduledEventId) return null
    if (upcomingDisplayEvents.some((event) => event.id === scheduledEventId)) return 'upcoming'
    if (pastDisplayEvents.some((event) => event.id === scheduledEventId)) return 'past'
    const cached = cachedPlan[scheduledEventId]?.event
    if (cached) {
      return planSegmentForEventDateTime(cached.eventDateTime) === 'past' ? 'past' : 'upcoming'
    }
    return segment
  }, [cachedPlan, pastDisplayEvents, scheduledEventId, segment, upcomingDisplayEvents])

  const detailEvent = useMemo(() => {
    if (!scheduledEventId) return null
    return (
      upcomingDisplayEvents.find((event) => event.id === scheduledEventId) ??
      pastDisplayEvents.find((event) => event.id === scheduledEventId) ??
      cachedPlan[scheduledEventId]?.event ??
      null
    )
  }, [cachedPlan, pastDisplayEvents, scheduledEventId, upcomingDisplayEvents])

  const exitEventDetail = useCallback(() => {
    setReviewPastId(null)
    const go = detailReturnTab
    setDetailReturnTab(null)
    if (go) {
      navigateShellToTab(go)
      return
    }
    navigate(PLAN_PATHS.scheduled)
  }, [detailReturnTab, navigate])

  const handleCancelPlanFromList = useCallback((eventId: string) => {
    if (!isEventPlanned(eventId)) return
    toggleEventPlan(eventId)
    if (scheduledEventId === eventId) {
      exitEventDetail()
    }
  }, [exitEventDetail, isEventPlanned, scheduledEventId, toggleEventPlan])

  const requestCancelPlan = useCallback((eventId: string, title: string) => {
    setPendingCancelPlan({
      eventId,
      title: title.trim() || 'This event',
    })
  }, [])

  const dismissCancelPlan = useCallback(() => {
    setPendingCancelPlan(null)
  }, [])

  const confirmCancelPlan = useCallback(() => {
    if (!pendingCancelPlan) return
    handleCancelPlanFromList(pendingCancelPlan.eventId)
    setPendingCancelPlan(null)
  }, [handleCancelPlanFromList, pendingCancelPlan])

  useEffect(() => {
    if (!pendingCancelPlan) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissCancelPlan()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissCancelPlan, pendingCancelPlan])

  useEffect(() => {
    if (!scheduledEventId) return
    if (isEventPlanned(scheduledEventId)) return
    const loading =
      detailKind === 'upcoming'
        ? upcomingQuery.isLoading && upcomingDisplayEvents.length === 0
        : pastQuery.isLoading && pastDisplayEvents.length === 0
    if (loading || detailEvent) return
    exitEventDetail()
  }, [
    detailEvent,
    detailKind,
    exitEventDetail,
    isEventPlanned,
    pastDisplayEvents.length,
    pastQuery.isLoading,
    scheduledEventId,
    upcomingDisplayEvents.length,
    upcomingQuery.isLoading,
  ])

  useEffect(() => {
    if (!scheduledEventId || detailKind == null) return
    setSegment(detailKind)
  }, [detailKind, scheduledEventId])

  useEffect(() => {
    if (isAuthenticated || !scheduledEventId) return
    navigate(PLAN_PATHS.hub, { replace: true })
  }, [isAuthenticated, navigate, scheduledEventId])

  useEffect(() => {
    prunePlanDetailCache(plannedEventIds)
    setCachedPlan(readFreshPlanDetails(plannedEventIds))
  }, [plannedEventIds])

  useEffect(() => {
    if (upcomingEvents.length === 0) return
    const rows = upcomingEvents.map((event) => ({
      event,
      segment: planSegmentForEventDateTime(event.eventDateTime) as PlanSegment,
    }))
    upsertPlanDetailCache(rows)
    setCachedPlan((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [row.event.id, row])),
    }))
  }, [upcomingEvents])

  useEffect(() => {
    if (pastEvents.length === 0) return
    const rows = pastEvents.map((event) => ({
      event,
      segment: planSegmentForEventDateTime(event.eventDateTime) as PlanSegment,
    }))
    upsertPlanDetailCache(rows)
    setCachedPlan((current) => ({
      ...current,
      ...Object.fromEntries(rows.map((row) => [row.event.id, row])),
    }))
  }, [pastEvents])

  useEffect(() => {
    const live = events
      .filter((event) => plannedEventIds.includes(event.id))
      .map((event) => ({
        event,
        segment: planSegmentForEventDateTime(event.eventDateTime) as PlanSegment,
      }))
    if (live.length === 0) return
    upsertPlanDetailCache(live)
    setCachedPlan((current) => ({
      ...current,
      ...Object.fromEntries(live.map((row) => [row.event.id, row])),
    }))
  }, [events, plannedEventIds])

  useEffect(() => {
    const serverIds = new Set([
      ...upcomingEvents.map((event) => event.id),
      ...pastEvents.map((event) => event.id),
    ])
    const liveIds = new Set(events.map((event) => event.id))
    const missing = plannedEventIds
      .filter((id) => (
        !serverIds.has(id) &&
        !cachedPlan[id] &&
        !liveIds.has(id) &&
        !requestedIdsRef.current.has(id)
      ))
      .slice(0, 20)
    if (missing.length === 0) return

    const controller = new AbortController()
    missing.forEach((id) => requestedIdsRef.current.add(id))
    fetchPlanEventDetails(missing, controller.signal).then((rows) => {
      if (controller.signal.aborted) return
      upsertPlanDetailCache(rows)
      setCachedPlan((current) => ({
        ...current,
        ...Object.fromEntries(rows.map((row) => [row.event.id, row])),
      }))
    })

    return () => controller.abort()
  }, [cachedPlan, events, pastEvents, plannedEventIds, upcomingEvents])

  const refreshPlan = async () => {
    if (!isAuthenticated || refreshing) return
    const controller = new AbortController()
    setRefreshing(true)
    setRefreshError(null)
    try {
      await Promise.all([
        utils.plan.upcoming.invalidate(),
        utils.plan.past.invalidate(),
      ])
      if (plannedEventIds.length > 0) {
        const rows = await fetchPlanEventDetails(plannedEventIds, controller.signal)
        upsertPlanDetailCache(rows)
        setCachedPlan((current) => ({
          ...current,
          ...Object.fromEntries(rows.map((row) => [row.event.id, row])),
        }))
      }
      setRefreshedAt(Date.now())
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setRefreshError(e instanceof Error ? e.message : 'Could not refresh plan')
      }
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setPastOffset(0)
      setPastEvents([])
      setPastTotal(0)
      setPastNextOffset(null)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const page = pastQuery.data
    if (!page) return
    const mapped = page.items.map(mapDiscoverEventListItemToEventItem)
    setPastTotal(page.total)
    setPastNextOffset(page.nextOffset)
    setPastEvents((current) => {
      if (page.offset === 0) return mapped
      const byId = new Map(current.map((event) => [event.id, event]))
      for (const event of mapped) byId.set(event.id, event)
      return [...byId.values()]
    })
  }, [pastQuery.data])

  const loadMorePast = useCallback(() => {
    if (pastNextOffset == null || pastQuery.isFetching) return
    setPastOffset(pastNextOffset)
  }, [pastNextOffset, pastQuery.isFetching])

  useEffect(() => {
    if (segment !== 'past' || pastNextOffset == null || pastQuery.isFetching) return
    const sentinel = historyLoadMoreRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMorePast()
      },
      { root: null, rootMargin: '240px 0px', threshold: 0.01 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMorePast, pastNextOffset, pastQuery.isFetching, segment])

  const toFavoriteEvent = (
    id: string,
    kind: 'upcoming' | 'past',
    data: PlanPageEvent | null,
  ): FavoriteEvent => ({
    id,
    title: data?.displayTitle ?? 'Event',
    venueLine: data?.venueLine ?? '',
    timeLabel: data?.timeRange ?? '',
    image: data?.heroImage ?? '',
    variant: kind,
  })

  useEffect(() => {
    if (!pendingPlanDetail) return
    // Discover / Ask / Profile: App shows full detail as an overlay; tab stays put.
    if (pendingPlanDetail.returnTab != null && pendingPlanDetail.returnTab !== 'plan') return
    navigate(getPlanScheduledEventPath(pendingPlanDetail.id), { replace: true })
    setSegment(pendingPlanDetail.kind === 'past' ? 'past' : 'upcoming')
    setDetailReturnTab(pendingPlanDetail.returnTab ?? null)
    clearPendingPlanDetail()
  }, [clearPendingPlanDetail, navigate, pendingPlanDetail])

  useEffect(() => {
    if (!isAuthenticated || planView !== 'hub') return
    const controller = new AbortController()
    setCityWeatherLoading(true)
    void fetchCityWeatherSummary('singapore', { signal: controller.signal })
      .then((summary) => {
        if (controller.signal.aborted) return
        setCityWeather(summary)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setCityWeather({ available: false, message: 'No data available' })
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setCityWeatherLoading(false)
      })
    return () => controller.abort()
  }, [isAuthenticated, planView])

  if (reviewPastId) {
    const reviewEvent = pastDisplayEvents.find((event) => event.id === reviewPastId) ?? null
    const reviewData = reviewEvent ? planDetailFromEventItem(reviewEvent) : null
    if (!reviewData) {
      return (
        <div className="screen-content plan-home">
          <p className="plan-home-sub">This event is no longer available.</p>
          <button type="button" className="plan-segment plan-segment--on" onClick={() => setReviewPastId(null)}>
            Back to plan
          </button>
        </div>
      )
    }
    return (
      <PlanEventReview
        data={reviewData}
        onBack={() => setReviewPastId(null)}
      />
    )
  }

  if (scheduledEventId && isAuthenticated) {
    const kind = detailKind ?? 'upcoming'
    const data = detailEvent ? planDetailFromEventItem(detailEvent) : null

    if (!data) {
      return (
        <motion.div
          className="screen-content plan-home"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="plan-home-sub">This event is no longer available.</p>
          <button type="button" className="plan-segment plan-segment--on" onClick={exitEventDetail}>
            {detailReturnTab ? tabReturnAriaLabel(detailReturnTab) : 'Back to scheduled'}
          </button>
        </motion.div>
      )
    }

    return (
      <>
        <PlanEventDetail
          data={data}
          variant={kind}
          backAriaLabel={
            detailReturnTab ? tabReturnAriaLabel(detailReturnTab) : 'Back to scheduled'
          }
          onBack={exitEventDetail}
          onOpenEvent={onOpenEvent}
          isFavorited={isEventFavorited(data.eventId)}
          onToggleFavorite={() =>
            toggleFavoriteEvent(toFavoriteEvent(data.eventId, kind, data))
          }
          isPlanned={isEventPlanned(data.eventId)}
          onTogglePlan={() => {
            const wasPlanned = isEventPlanned(data.eventId)
            toggleEventPlan(data.eventId)
            if (wasPlanned) exitEventDetail()
          }}
          onOpenReview={kind === 'past' ? () => setReviewPastId(scheduledEventId) : undefined}
        />
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <motion.div
        className="screen-content plan-home"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <header className="plan-home-header">
          <h1 className="plan-home-title">Plan</h1>
          <p className="plan-home-sub">Weather, scheduled nights, and where you&apos;ve been.</p>
        </header>
        <PlanHub
          weatherPreview="Sign in to view"
          weatherLoading={false}
          upcomingCount={0}
          pastCount={0}
          onOpenWeather={() => openSignIn('Sign in to view weather in Plan.')}
          onOpenScheduled={() => openSignIn('Sign in to view and manage your event plan.')}
        />
      </motion.div>
    )
  }

  const visibleEvents = segment === 'upcoming' ? upcomingDisplayEvents : pastDisplayEvents
  const upcomingCount = upcomingDisplayEvents.length
  const pastCount = pastTotal > 0 ? pastTotal : pastDisplayEvents.length
  const loading = segment === 'upcoming'
    ? upcomingQuery.isLoading && upcomingDisplayEvents.length === 0
    : pastEvents.length === 0 && pastQuery.isLoading && pastDisplayEvents.length === 0
  const error = segment === 'upcoming' ? upcomingQuery.error : pastQuery.error
  const weatherPreview = cityWeatherLoading
    ? 'Loading…'
    : cityWeather?.available
      ? cityWeather.condition
      : 'No data available'

  const segmentControls = (
    <div className="plan-segments" role="tablist" aria-label="Scheduled lists">
      <button
        type="button"
        role="tab"
        aria-selected={segment === 'upcoming'}
        className={segment === 'upcoming' ? 'plan-segment plan-segment--on' : 'plan-segment'}
        onClick={() => setSegment('upcoming')}
      >
        Upcoming
        <span className="plan-seg-count">{upcomingCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={segment === 'past'}
        className={segment === 'past' ? 'plan-segment plan-segment--on' : 'plan-segment'}
        onClick={() => setSegment('past')}
      >
        Past
        <span className="plan-seg-count">{pastCount}</span>
      </button>
    </div>
  )

  const listContent = (
    <div className="plan-list" role="tabpanel">
      {loading ? (
        <div className="favorites-empty">
          <p className="favorites-empty-title">Loading your plan</p>
          <p className="favorites-empty-copy">Checking saved event IDs and hydrating event details.</p>
        </div>
      ) : error ? (
        <div className="favorites-empty">
          <p className="favorites-empty-title">Plan could not load</p>
          <p className="favorites-empty-copy">{error.message}</p>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="favorites-empty">
          <p className="favorites-empty-title">
            {segment === 'upcoming' ? 'No upcoming plans yet' : 'No past events yet'}
          </p>
          <p className="favorites-empty-copy">
            {segment === 'upcoming'
              ? 'Tap I\'m Going on any event to add it here.'
              : 'Events move here after their event date has passed.'}
          </p>
        </div>
      ) : (
        <>
          {segment === 'upcoming'
            ? visibleEvents.map((ev) => (
            <div key={ev.id} className="plan-list-item-wrap" role="listitem">
              <button
                type="button"
                className="plan-list-card"
                onClick={() => {
                  setDetailReturnTab(null)
                  navigate(getPlanScheduledEventPath(ev.id))
                }}
              >
                <img src={ev.image} alt="" className="plan-list-card-img" decoding="async" />
                <div className="plan-list-card-body plan-list-card-body--with-cancel">
                  <span className="plan-list-card-label">{ev.genre}</span>
                  <h2 className="plan-list-card-title">{ev.title}</h2>
                  <p className="plan-list-card-meta">
                    <MapPin size={13} aria-hidden />
                    {ev.venue}, {ev.district}
                  </p>
                  <p className="plan-list-card-meta">
                    <Clock size={13} aria-hidden />
                    {ev.time}
                    {ev.ticketPrice ? ` · ${formatEventPriceLabel(ev.ticketPrice)}` : ''}
                  </p>
                </div>
              </button>
              <button
                type="button"
                className="plan-list-cancel"
                aria-label={`Cancel plan for ${ev.title}`}
                disabled={isUpdating}
                onClick={() => requestCancelPlan(ev.id, ev.title)}
              >
                <X size={14} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          ))
            : visibleEvents.map((p: EventItem) => (
            <button
              type="button"
              key={p.id}
              className="plan-list-card plan-list-card--past"
              onClick={() => {
                setDetailReturnTab(null)
                navigate(getPlanScheduledEventPath(p.id))
              }}
            >
              <img src={p.image} alt="" className="plan-list-card-img" decoding="async" />
              <div className="plan-list-card-body">
                <span className="plan-list-card-label plan-list-card-label--past">{p.displayDateTimeLabel ?? p.time}</span>
                <h2 className="plan-list-card-title">{p.title}</h2>
                <p className="plan-list-card-meta">
                  <MapPin size={13} aria-hidden />
                  {p.venue}, {p.district}
                </p>
              </div>
            </button>
          ))}
          {segment === 'past' && pastNextOffset != null ? (
            <div className="plan-history-load-more" ref={historyLoadMoreRef} role="status" aria-live="polite">
              {pastQuery.isFetching ? 'Loading more history...' : 'Scroll for more history'}
            </div>
          ) : null}
        </>
      )}
    </div>
  )

  return (
    <>
    <motion.div
      className="screen-content plan-home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {planView === 'hub' ? (
        <>
          <header className="plan-home-header">
            <h1 className="plan-home-title">Plan</h1>
            <p className="plan-home-sub">Weather, scheduled nights, and where you&apos;ve been.</p>
          </header>
          <PlanHub
            weatherPreview={weatherPreview}
            weatherLoading={cityWeatherLoading}
            upcomingCount={upcomingCount}
            pastCount={pastCount}
            onOpenWeather={openPlanWeather}
            onOpenScheduled={openPlanScheduled}
          />
        </>
      ) : planView === 'weather' ? (
        <PlanWeatherScreen onBack={openPlanHub} />
      ) : (
        <PlanScheduledScreen
          refreshedAt={refreshedAt}
          refreshing={refreshing}
          refreshError={refreshError}
          onBack={openPlanHub}
          onRefresh={() => {
            void refreshPlan()
          }}
          segmentControls={segmentControls}
          listContent={listContent}
        />
      )}
    </motion.div>
    {pendingCancelPlan ? (
      <PlanCancelConfirmDialog
        eventTitle={pendingCancelPlan.title}
        onConfirm={confirmCancelPlan}
        onDismiss={dismissCancelPlan}
      />
    ) : null}
    </>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, MapPin, RefreshCw, X } from 'lucide-react'
import {
  planDetailFromEventItem,
} from '../../data/demoData'
import { PLAN_CONFIG } from '../../config/plan'
import { navigateShellToTab } from '../../lib/tabRoutes'
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
import { PlanCancelConfirmDialog } from './PlanCancelConfirmDialog'
import { PlanEventDetail } from './PlanEventDetail'
import { PlanEventReview } from './PlanEventReview'

type PendingCancelPlan = {
  eventId: string
  title: string
}

type PlanTabProps = {
  events: EventItem[]
  onOpenEvent: (eventId: string) => void
}

type DetailRoute =
  | { kind: 'upcoming'; id: string }
  | { kind: 'past'; id: string }

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
      return 'Back to plan list'
    case 'profile':
      return 'Back to profile'
  }
}

export function PlanTab({ events, onOpenEvent }: PlanTabProps) {
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
  const [detail, setDetail] = useState<DetailRoute | null>(null)
  const [detailReturnTab, setDetailReturnTab] = useState<Tab | null>(null)
  const [reviewPastId, setReviewPastId] = useState<string | null>(null)
  const [pendingCancelPlan, setPendingCancelPlan] = useState<PendingCancelPlan | null>(null)

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

  const detailEvents = detail?.kind === 'past' ? pastDisplayEvents : upcomingDisplayEvents
  const detailEvent = detail ? detailEvents.find((event) => event.id === detail.id) ?? null : null

  const exitEventDetail = useCallback(() => {
    setReviewPastId(null)
    setDetail(null)
    const go = detailReturnTab
    setDetailReturnTab(null)
    if (go) navigateShellToTab(go)
  }, [detailReturnTab])

  const handleCancelPlanFromList = useCallback((eventId: string) => {
    if (!isEventPlanned(eventId)) return
    toggleEventPlan(eventId)
    if (detail?.id === eventId) {
      exitEventDetail()
    }
  }, [detail, exitEventDetail, isEventPlanned, toggleEventPlan])

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
    if (!detail) return
    if (isEventPlanned(detail.id)) return
    const loading =
      detail.kind === 'upcoming'
        ? upcomingQuery.isLoading && upcomingDisplayEvents.length === 0
        : pastQuery.isLoading && pastDisplayEvents.length === 0
    if (loading || detailEvent) return
    exitEventDetail()
  }, [
    detail,
    detailEvent,
    exitEventDetail,
    isEventPlanned,
    pastDisplayEvents.length,
    pastQuery.isLoading,
    upcomingDisplayEvents.length,
    upcomingQuery.isLoading,
  ])

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
    setDetail({ kind: pendingPlanDetail.kind, id: pendingPlanDetail.id })
    setSegment(pendingPlanDetail.kind === 'past' ? 'past' : 'upcoming')
    setDetailReturnTab(pendingPlanDetail.returnTab ?? null)
    clearPendingPlanDetail()
  }, [pendingPlanDetail, clearPendingPlanDetail])

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

  if (detail) {
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
            {detailReturnTab ? tabReturnAriaLabel(detailReturnTab) : 'Back to plan'}
          </button>
        </motion.div>
      )
    }

    return (
      <>
        <PlanEventDetail
          data={data}
          variant={detail.kind}
          backAriaLabel={
            detailReturnTab ? tabReturnAriaLabel(detailReturnTab) : 'Back to plan list'
          }
          onBack={exitEventDetail}
          onOpenEvent={onOpenEvent}
          isFavorited={isEventFavorited(data.eventId)}
          onToggleFavorite={() =>
            toggleFavoriteEvent(toFavoriteEvent(data.eventId, detail.kind, data))
          }
          isPlanned={isEventPlanned(data.eventId)}
          onTogglePlan={() => {
            if (isEventPlanned(data.eventId)) {
              requestCancelPlan(data.eventId, data.displayTitle)
              return
            }
            toggleEventPlan(data.eventId)
          }}
          onOpenReview={detail.kind === 'past' ? () => setReviewPastId(detail.id) : undefined}
        />
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
          <p className="plan-home-sub">Upcoming nights and where you&apos;ve been.</p>
        </header>
        <div className="favorites-empty">
          <p className="favorites-empty-title">Sign in to start planning</p>
          <p className="favorites-empty-copy">Your Plan syncs upcoming and past events across devices.</p>
          <button
            type="button"
            className="plan-segment plan-segment--on"
            onClick={() => openSignIn('Sign in to view and manage your event plan.')}
          >
            Sign in
          </button>
        </div>
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

  return (
    <>
    <motion.div
      className="screen-content plan-home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="plan-home-header">
        <div className="plan-home-header-row">
          <h1 className="plan-home-title">Plan</h1>
          <div className="plan-home-header-actions">
            {refreshedAt ? (
              <span
                className="favorites-limit-bubble"
                aria-label={`Plan updated at ${new Date(refreshedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}`}
              >
                Updated {new Date(refreshedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
            <button
              type="button"
              className="favorites-refresh"
              onClick={() => {
                void refreshPlan()
              }}
              disabled={refreshing || !isAuthenticated}
            >
              <RefreshCw size={15} className={refreshing ? 'favorites-refresh-icon is-spinning' : 'favorites-refresh-icon'} aria-hidden />
              <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </div>
        </div>
        <p className="plan-home-sub">Upcoming nights and where you&apos;ve been.</p>
        {refreshError ? <p className="favorites-refresh-error" role="alert">{refreshError}</p> : null}
      </header>

      <div className="plan-segments" role="tablist" aria-label="Plan lists">
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
                    setDetail({ kind: 'upcoming', id: ev.id })
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
                      {ev.ticketPrice ? ` · ${ev.ticketPrice}` : ''}
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
                  setDetail({ kind: 'past', id: p.id })
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

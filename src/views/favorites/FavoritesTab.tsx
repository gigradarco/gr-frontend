import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Heart, MapPin, RefreshCw } from 'lucide-react'
import { useAppState, type FavoriteEvent } from '../../store/appStore'
import { fetchDiscoverEventById } from '../../lib/useDiscoverEvents'
import type { EventItem } from '../../types'
import { FAVORITES_CONFIG, favoriteLimitForTier } from '../../config/favorites'
import {
  pruneFavoriteDetailCache,
  readFreshFavoriteDetails,
  upsertFavoriteDetailCache,
} from '../../lib/favorite-detail-cache'

type FavoritesTabProps = {
  events: EventItem[]
  onOpenFavorite: (eventId: string) => void
}

function singaporeDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function favoriteVariantFromEventItem(event: EventItem): FavoriteEvent['variant'] {
  if (!event.eventDateTime) return 'upcoming'
  const eventDate = new Date(event.eventDateTime)
  if (!Number.isFinite(eventDate.getTime())) return 'upcoming'
  return singaporeDateKey(eventDate) < singaporeDateKey(new Date()) ? 'past' : 'upcoming'
}

function favoriteFromEventItem(event: EventItem): FavoriteEvent {
  return {
    id: event.id,
    title: event.title,
    venueLine: [event.venue, event.district].map((part) => part.trim()).filter(Boolean).join(', '),
    timeLabel: event.displayDateTimeLabel ?? event.time,
    image: event.image,
    variant: favoriteVariantFromEventItem(event),
  }
}

function fallbackFavorite(eventId: string, unavailable = false): FavoriteEvent {
  return {
    id: eventId,
    title: unavailable ? 'Event no longer available' : 'Loading saved event',
    venueLine: unavailable
      ? 'This event is no longer in the Discover feed. Remove it to clean up your saved list.'
      : 'Fetching latest event details...',
    timeLabel: unavailable ? `Saved ID: ${eventId}` : eventId,
    image: '',
    variant: 'upcoming',
  }
}

type FavoriteDetailsResult = {
  details: FavoriteEvent[]
  unavailableIds: string[]
}

async function fetchFavoriteDetails(ids: string[], signal: AbortSignal): Promise<FavoriteDetailsResult> {
  const out: FavoriteEvent[] = []
  const unavailableIds: string[] = []
  for (let i = 0; i < ids.length; i += FAVORITES_CONFIG.refreshBatchSize) {
    if (signal.aborted) break
    const batch = ids.slice(i, i + FAVORITES_CONFIG.refreshBatchSize)
    const results = await Promise.allSettled(batch.map((id) => fetchDiscoverEventById(id, signal)))
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') out.push(favoriteFromEventItem(result.value))
      else if (!signal.aborted) unavailableIds.push(batch[index]!)
    })
  }
  return { details: out, unavailableIds }
}

export function FavoritesTab({ events, onOpenFavorite }: FavoritesTabProps) {
  const favoriteEventIds = useAppState((s) => s.favoriteEventIds)
  const favoriteEventSnapshots = useAppState((s) => s.favoriteEvents)
  const subscriptionTier = useAppState((s) => s.subscriptionTier)
  const authSessionHydrated = useAppState((s) => s.authSessionHydrated)
  const toggleFavoriteEvent = useAppState((s) => s.toggleFavoriteEvent)
  const [cachedFavorites, setCachedFavorites] = useState<Record<string, FavoriteEvent>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null)
  const [unavailableFavoriteIds, setUnavailableFavoriteIds] = useState<Set<string>>(() => new Set())
  const requestedIdsRef = useRef(new Set<string>())
  const hasHydratedPlan = authSessionHydrated
  const favoriteLimit = hasHydratedPlan ? favoriteLimitForTier(subscriptionTier) : null
  const tierLabel = subscriptionTier === 'pro' ? 'Buzo Pro' : 'Buzo Basic'

  const favoriteEvents = useMemo(() => {
    const live = new Map(events.map((event) => [event.id, favoriteFromEventItem(event)]))
    const snapshots = new Map(favoriteEventSnapshots.map((event) => [event.id, event]))
    return favoriteEventIds.map(
      (id) =>
        live.get(id) ??
        cachedFavorites[id] ??
        snapshots.get(id) ??
        fallbackFavorite(id, unavailableFavoriteIds.has(id)),
    )
  }, [cachedFavorites, events, favoriteEventIds, favoriteEventSnapshots, unavailableFavoriteIds])

  useEffect(() => {
    pruneFavoriteDetailCache(favoriteEventIds)
    setCachedFavorites(readFreshFavoriteDetails(favoriteEventIds))
    setUnavailableFavoriteIds((current) => new Set([...current].filter((id) => favoriteEventIds.includes(id))))
    requestedIdsRef.current = new Set([...requestedIdsRef.current].filter((id) => favoriteEventIds.includes(id)))
  }, [favoriteEventIds])

  useEffect(() => {
    const liveFavorites = events
      .filter((event) => favoriteEventIds.includes(event.id))
      .map((event) => favoriteFromEventItem(event))
    const cacheable = [...liveFavorites, ...favoriteEventSnapshots]
    if (cacheable.length === 0) return
    upsertFavoriteDetailCache(cacheable)
    setCachedFavorites((current) => ({ ...current, ...Object.fromEntries(cacheable.map((event) => [event.id, event])) }))
  }, [events, favoriteEventIds, favoriteEventSnapshots])

  useEffect(() => {
    const liveIds = new Set(events.map((event) => event.id))
    const snapshotIds = new Set(favoriteEventSnapshots.map((event) => event.id))
    const missing = favoriteEventIds
      .filter((id) => (
        !liveIds.has(id) &&
        !cachedFavorites[id] &&
        !snapshotIds.has(id) &&
        !requestedIdsRef.current.has(id)
      ))
      .slice(0, 20)
    if (missing.length === 0) return

    const controller = new AbortController()
    let settled = false
    missing.forEach((id) => requestedIdsRef.current.add(id))
    fetchFavoriteDetails(missing, controller.signal)
      .then(({ details, unavailableIds }) => {
        settled = true
        if (controller.signal.aborted) return
        upsertFavoriteDetailCache(details)
        setCachedFavorites((current) => ({ ...current, ...Object.fromEntries(details.map((event) => [event.id, event])) }))
        setUnavailableFavoriteIds((current) => {
          const next = new Set(current)
          details.forEach((event) => next.delete(event.id))
          unavailableIds.forEach((id) => next.add(id))
          return next
        })
      })
      .catch((e) => {
        settled = true
        if (!(e instanceof DOMException && e.name === 'AbortError')) setRefreshError('Could not load saved event details.')
      })

    return () => {
      controller.abort()
      if (!settled) missing.forEach((id) => requestedIdsRef.current.delete(id))
    }
  }, [cachedFavorites, events, favoriteEventIds, favoriteEventSnapshots])

  const refreshFavorites = async () => {
    if (favoriteEventIds.length === 0 || refreshing) return
    const controller = new AbortController()
    setRefreshing(true)
    setRefreshError(null)
    try {
      const { details, unavailableIds } = await fetchFavoriteDetails(favoriteEventIds, controller.signal)
      upsertFavoriteDetailCache(details)
      setCachedFavorites((current) => ({ ...current, ...Object.fromEntries(details.map((event) => [event.id, event])) }))
      setUnavailableFavoriteIds((current) => {
        const next = new Set(current)
        favoriteEventIds.forEach((id) => next.delete(id))
        unavailableIds.forEach((id) => next.add(id))
        return next
      })
      if (unavailableIds.length > 0) {
        setRefreshError(`${unavailableIds.length} saved event${unavailableIds.length === 1 ? ' is' : 's are'} no longer available.`)
      }
      setRefreshedAt(Date.now())
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setRefreshError(e instanceof Error ? e.message : 'Could not refresh favorites')
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <motion.div
      className="screen-content plan-home favorites-tab"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="plan-home-header">
        <div className="plan-home-header-row">
          <h1 className="plan-home-title">Saved events</h1>
          <button
            type="button"
            className="favorites-refresh"
            onClick={() => {
              void refreshFavorites()
            }}
            disabled={refreshing || favoriteEventIds.length === 0}
          >
            <RefreshCw size={15} className={refreshing ? 'favorites-refresh-icon is-spinning' : 'favorites-refresh-icon'} aria-hidden />
            <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
        <div
          className="favorites-limit-bubbles"
          aria-busy={!hasHydratedPlan}
          aria-label={
            hasHydratedPlan
              ? `${tierLabel}, ${favoriteEventIds.length} of ${favoriteLimit} favourites saved`
              : `Checking plan, ${favoriteEventIds.length} favourites saved`
          }
        >
          <span
            className={`favorites-limit-bubble ${
              hasHydratedPlan ? `favorites-limit-bubble--${subscriptionTier}` : 'favorites-limit-bubble--loading'
            }`}
          >
            {hasHydratedPlan ? tierLabel : 'Checking plan'}
          </span>
          <span className="favorites-limit-bubble">
            {hasHydratedPlan ? `${favoriteEventIds.length} / ${favoriteLimit} favourites` : `${favoriteEventIds.length} favourites saved`}
          </span>
          {refreshedAt ? (
            <span className="favorites-limit-bubble">
              Last updated {new Date(refreshedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>
        {refreshError ? <p className="favorites-refresh-error" role="alert">{refreshError}</p> : null}
      </header>

      {favoriteEvents.length === 0 ? (
        <div className="favorites-empty">
          <Heart size={22} aria-hidden />
          <p className="favorites-empty-title">No saved events yet</p>
          <p className="favorites-empty-copy">Tap the heart on any event detail to save it here.</p>
        </div>
      ) : (
        <div className="plan-list" role="list" aria-label="Saved events">
          {favoriteEvents.map((event) => {
            const unavailable = unavailableFavoriteIds.has(event.id)
            return (
            <div key={event.id} className="favorites-list-item-wrap" role="listitem">
              <button
                type="button"
                className={`plan-list-card favorites-list-card${unavailable ? ' favorites-list-card--unavailable' : ''}`}
                onClick={() => onOpenFavorite(event.id)}
                disabled={unavailable}
              >
                {event.image ? (
                  <img src={event.image} alt="" className="plan-list-card-img" decoding="async" />
                ) : (
                  <div className="plan-list-card-img favorites-list-card-img-placeholder" aria-hidden />
                )}
                <div className="plan-list-card-body favorites-list-card-body">
                  <span
                    className={`plan-list-card-label${event.variant === 'past' ? ' plan-list-card-label--past' : ''}`}
                  >
                    {unavailable ? 'Unavailable favorite' : event.variant === 'past' ? 'Past favorite' : 'Upcoming favorite'}
                  </span>
                  <h2 className="plan-list-card-title">{event.title}</h2>
                  <p className="plan-list-card-meta">
                    <MapPin size={13} aria-hidden />
                    {event.venueLine}
                  </p>
                  <p className="plan-list-card-meta">
                    <Clock size={13} aria-hidden />
                    {event.timeLabel}
                  </p>
                </div>
              </button>
              <button
                type="button"
                className="favorites-list-remove"
                aria-label={`Remove ${event.title} from favorites`}
                onClick={() => toggleFavoriteEvent(event)}
              >
                <Heart size={18} fill="currentColor" aria-hidden />
              </button>
            </div>
          )})}
        </div>
      )}
    </motion.div>
  )
}

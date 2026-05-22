import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { events as demoEvents } from '../data/demoData'
import type { EventItem } from '../types'
import { apiBase } from './api-base'
import { resolveEventImagePlaceholder } from './resolve-event-image'

const DISCOVER_PAGE_SIZE = 30
const SOFT_RENDER_CAP = 90
const HARD_RENDER_CAP = 120

type DiscoverEventsSource = 'live' | 'demo' | 'auto'

type DiscoverEventListItem = {
  id: string
  title: string
  venue: string
  district: string
  category: string
  categoryId: string
  locationCityId: string
  eventDateTime: string | null
  displayDateTimeLabel: string
  imageUrl: string
  host: string
  summary: string
  tags: string[]
  ticketPrice: string
  lat: number | null
  lng: number | null
}

type DiscoverEventsPage = {
  items: DiscoverEventListItem[]
  nextCursor: string | null
}

type DiscoverEventsState = {
  events: EventItem[]
  source: DiscoverEventsSource
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
}

function configuredSource(): DiscoverEventsSource {
  const raw = (import.meta.env.VITE_DISCOVER_EVENTS_SOURCE as string | undefined)?.trim().toLowerCase()
  if (raw === 'demo' || raw === 'auto' || raw === 'live') return raw
  return 'live'
}

function mapDiscoverEventListItemToEventItem(item: DiscoverEventListItem): EventItem {
  const image =
    item.imageUrl ||
    resolveEventImagePlaceholder(
      {
        event_id: item.id,
        title: item.title,
        category: item.category,
      },
      { id: item.id, title: item.title, genre: item.category },
    )

  return {
    id: item.id,
    title: item.title,
    venue: item.venue,
    district: item.district,
    time: item.displayDateTimeLabel,
    displayDateTimeLabel: item.displayDateTimeLabel,
    eventDateTime: item.eventDateTime,
    genre: item.category,
    exploreCategoryId: item.categoryId,
    locationCityId: item.locationCityId,
    verified: 0,
    image,
    host: item.host,
    hostPrompt: item.summary,
    friendsGoing: 0,
    vibeTags: item.tags,
    ticketPrice: item.ticketPrice,
    bpReward: undefined,
    buzzPct: undefined,
    lat: item.lat ?? undefined,
    lng: item.lng ?? undefined,
  }
}

function discoverEventsUrl(cityId: string, cursor: string | null): string {
  const params = new URLSearchParams()
  params.set('cityId', cityId)
  params.set('limit', String(DISCOVER_PAGE_SIZE))
  if (cursor) params.set('cursor', cursor)
  const base = apiBase()
  const path = `/api/discover/events?${params.toString()}`
  return base ? `${base}${path}` : path
}

function trimEventWindow(events: EventItem[]): EventItem[] {
  if (events.length <= HARD_RENDER_CAP) return events
  return events.slice(-SOFT_RENDER_CAP)
}

export function useDiscoverEvents(cityId: string): DiscoverEventsState {
  const source = useMemo(() => configuredSource(), [])
  const [events, setEvents] = useState<EventItem[]>(() => (source === 'demo' ? demoEvents : []))
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(source !== 'demo')
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(source !== 'demo')
  const abortRef = useRef<AbortController | null>(null)
  const pendingCursorRef = useRef<string | null>(null)

  const fetchPage = useCallback(
    async (nextCursor: string | null, mode: 'reset' | 'append') => {
      if (source === 'demo') return
      if (pendingCursorRef.current === nextCursor && mode === 'append') return
      pendingCursorRef.current = nextCursor

      if (mode === 'reset') {
        abortRef.current?.abort()
        abortRef.current = new AbortController()
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError(null)

      const controller = mode === 'reset' ? abortRef.current! : new AbortController()
      try {
        const res = await fetch(discoverEventsUrl(cityId, nextCursor), {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `Discover events failed with ${res.status}`)
        }
        const page = (await res.json()) as DiscoverEventsPage
        const mapped = page.items.map((item) => mapDiscoverEventListItemToEventItem(item))
        setEvents((current) => {
          if (mode === 'reset') return mapped
          const byId = new Map(current.map((event) => [event.id, event]))
          for (const event of mapped) byId.set(event.id, event)
          return trimEventWindow([...byId.values()])
        })
        setCursor(page.nextCursor)
        setHasMore(Boolean(page.nextCursor))
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (source === 'auto') {
          setEvents(demoEvents)
          setCursor(null)
          setHasMore(false)
          setError(null)
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load Discover events')
        setHasMore(false)
      } finally {
        pendingCursorRef.current = null
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [cityId, source],
  )

  useEffect(() => {
    if (source === 'demo') {
      setEvents(demoEvents)
      setCursor(null)
      setHasMore(false)
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      return
    }

    setEvents([])
    setCursor(null)
    setHasMore(true)
    void fetchPage(null, 'reset')
    return () => abortRef.current?.abort()
  }, [cityId, fetchPage, source])

  const loadMore = useCallback(() => {
    if (source === 'demo' || loading || loadingMore || !hasMore) return
    void fetchPage(cursor, 'append')
  }, [cursor, fetchPage, hasMore, loading, loadingMore, source])

  return {
    events,
    source,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
  }
}

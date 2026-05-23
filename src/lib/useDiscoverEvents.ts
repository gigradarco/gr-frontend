import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { events as demoEvents } from '../data/demoData'
import type { EventItem } from '../types'
import { apiBase } from './api-base'
import { resolveEventImagePlaceholder } from './resolve-event-image'
import type { DiscoverEventFilters } from './discover-filters'

const DISCOVER_PAGE_SIZE = 30
const APPEND_LOADING_MIN_MS = 450
const APPEND_LOAD_COOLDOWN_MS = 300

export type DiscoverEventsSource = 'live' | 'demo' | 'auto'

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
  sourceUrl?: string | null
}

type DiscoverEventsPage = {
  items: DiscoverEventListItem[]
  nextCursor: string | null
  totalAvailable: number
}

type DiscoverEventDetail = DiscoverEventListItem & {
  sourceUrl?: string | null
}

type DiscoverEventsState = {
  events: EventItem[]
  source: DiscoverEventsSource
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  totalAvailable: number | null
  loadMore: () => void
  refresh: () => void
}

function configuredSource(): DiscoverEventsSource {
  const raw = (import.meta.env.VITE_DISCOVER_EVENTS_SOURCE as string | undefined)?.trim().toLowerCase()
  if (raw === 'demo' || raw === 'auto' || raw === 'live') return raw
  return 'live'
}

export function mapDiscoverEventListItemToEventItem(item: DiscoverEventListItem): EventItem {
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
    sourceUrl: item.sourceUrl ?? null,
  }
}

function discoverEventsUrl(cityId: string, cursor: string | null, filters: DiscoverEventFilters): string {
  const params = new URLSearchParams()
  params.set('cityId', cityId)
  params.set('limit', String(DISCOVER_PAGE_SIZE))
  if (cursor) params.set('cursor', cursor)
  if (filters.categories !== 'All' && filters.categories.length > 0) {
    params.set('categoryIds', filters.categories.join(','))
  }
  if (filters.date !== 'All' && filters.date !== 'Custom Range') params.set('datePreset', filters.date)
  if (filters.time !== 'All') params.set('timePreset', filters.time)
  if (filters.date === 'Custom Range') {
    if (filters.startDate.trim()) params.set('startDate', filters.startDate.trim())
    if (filters.endDate.trim()) params.set('endDate', filters.endDate.trim())
    if (filters.startTime.trim()) params.set('startTime', filters.startTime.trim())
    if (filters.endTime.trim()) params.set('endTime', filters.endTime.trim())
  }
  if (filters.area !== 'All') params.set('area', filters.area)
  if (filters.price !== 'All') params.set('pricePreset', filters.price)
  const base = apiBase()
  const path = `/api/discover/events?${params.toString()}`
  return base ? `${base}${path}` : path
}

function discoverEventDetailUrl(eventId: string): string {
  const base = apiBase()
  const path = `/api/discover/events/${encodeURIComponent(eventId)}`
  return base ? `${base}${path}` : path
}

function trimEventWindow(events: EventItem[]): EventItem[] {
  return events
}

export async function fetchDiscoverEventById(eventId: string, signal?: AbortSignal): Promise<EventItem> {
  const res = await fetch(discoverEventDetailUrl(eventId), {
    credentials: 'include',
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Discover event failed with ${res.status}`)
  }
  const item = (await res.json()) as DiscoverEventDetail
  return mapDiscoverEventListItemToEventItem(item)
}

export function useDiscoverEvents(cityId: string, filters: DiscoverEventFilters): DiscoverEventsState {
  const source = useMemo(() => configuredSource(), [])
  const [events, setEvents] = useState<EventItem[]>(() => (source === 'demo' ? demoEvents : []))
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(source !== 'demo')
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(source !== 'demo')
  const [totalAvailable, setTotalAvailable] = useState<number | null>(source === 'demo' ? demoEvents.length : null)
  const abortRef = useRef<AbortController | null>(null)
  const pendingCursorRef = useRef<string | null>(null)
  const lastAppendFinishedAtRef = useRef(0)

  const fetchPage = useCallback(
    async (nextCursor: string | null, mode: 'reset' | 'append') => {
      if (source === 'demo') return
      if (pendingCursorRef.current === nextCursor && mode === 'append') return
      pendingCursorRef.current = nextCursor

      const appendStartedAt = mode === 'append' ? performance.now() : 0
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
        const res = await fetch(discoverEventsUrl(cityId, nextCursor, filters), {
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
        setTotalAvailable(Number.isFinite(page.totalAvailable) ? page.totalAvailable : null)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (source === 'auto') {
          setEvents(demoEvents)
          setCursor(null)
          setHasMore(false)
          setTotalAvailable(demoEvents.length)
          setError(null)
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load Discover events')
        setHasMore(false)
        setTotalAvailable(null)
      } finally {
        if (mode === 'append') {
          const elapsed = performance.now() - appendStartedAt
          if (elapsed < APPEND_LOADING_MIN_MS) {
            await new Promise((resolve) => window.setTimeout(resolve, APPEND_LOADING_MIN_MS - elapsed))
          }
          lastAppendFinishedAtRef.current = Date.now()
        }
        pendingCursorRef.current = null
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [cityId, filters, source],
  )

  useEffect(() => {
    if (source === 'demo') {
      setEvents(demoEvents)
      setCursor(null)
      setHasMore(false)
      setTotalAvailable(demoEvents.length)
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      return
    }

    setEvents([])
    setCursor(null)
    setHasMore(true)
    setTotalAvailable(null)
    void fetchPage(null, 'reset')
    return () => abortRef.current?.abort()
  }, [cityId, fetchPage, source])

  const loadMore = useCallback(() => {
    if (source === 'demo' || loading || loadingMore || !hasMore) return
    const now = Date.now()
    if (now - lastAppendFinishedAtRef.current < APPEND_LOAD_COOLDOWN_MS) return
    void fetchPage(cursor, 'append')
  }, [cursor, fetchPage, hasMore, loading, loadingMore, source])

  const refresh = useCallback(() => {
    if (source === 'demo') return
    setCursor(null)
    setHasMore(true)
    void fetchPage(null, 'reset')
  }, [fetchPage, source])

  return {
    events,
    source,
    loading,
    loadingMore,
    error,
    hasMore,
    totalAvailable,
    loadMore,
    refresh,
  }
}

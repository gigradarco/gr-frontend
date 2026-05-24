import type { SyntheticEvent } from 'react'
import type { EventItem } from '../types'
import { proxiedEventImageUrl } from './image-proxy'
import { splashImageForEventRow } from './splash-images'

export function fallbackImageForEvent(event: EventItem): string {
  const fallback = splashImageForEventRow(
    {
      event_id: event.id,
      title: event.title,
      category: event.genre,
      taste_and_recommendations: event.vibeTags.join(', '),
    },
    event,
  )
  return proxiedEventImageUrl(fallback, { quality: 80, width: 1200 })
}

export function handleEventImageError(event: EventItem, e: SyntheticEvent<HTMLImageElement>): void {
  const fallback = fallbackImageForEvent(event)
  const target = new URL(fallback, window.location.href).toString()
  if ((e.currentTarget.currentSrc || e.currentTarget.src) !== target) {
    e.currentTarget.src = fallback
  }
}

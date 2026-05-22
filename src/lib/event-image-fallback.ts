import type { SyntheticEvent } from 'react'
import type { EventItem } from '../types'
import { splashImageForEventRow } from './splash-images'

export function fallbackImageForEvent(event: EventItem): string {
  return splashImageForEventRow(
    {
      event_id: event.id,
      title: event.title,
      category: event.genre,
      taste_and_recommendations: event.vibeTags.join(', '),
    },
    event,
  )
}

export function handleEventImageError(event: EventItem, e: SyntheticEvent<HTMLImageElement>): void {
  const fallback = fallbackImageForEvent(event)
  if (e.currentTarget.src !== fallback) {
    e.currentTarget.src = fallback
  }
}

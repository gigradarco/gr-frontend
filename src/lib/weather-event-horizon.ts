import { PLAN_CONFIG } from '../config/plan'

/** NEA cached payloads cover near-term windows; do not show event weather beyond this horizon. */
export const EVENT_WEATHER_MAX_DAYS = 4

const DAY_MS = 24 * 60 * 60 * 1000

function localDateKey(date: Date, timeZone = PLAN_CONFIG.timeZone): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isEventWithinWeatherHorizon(
  eventDateTime: string | null | undefined,
  now = new Date(),
): boolean {
  if (!eventDateTime?.trim()) return false

  const eventAt = new Date(eventDateTime)
  if (Number.isNaN(eventAt.getTime())) return false

  const eventDay = localDateKey(eventAt)
  const today = localDateKey(now)
  if (eventDay < today) return false

  const lastDay = localDateKey(new Date(now.getTime() + EVENT_WEATHER_MAX_DAYS * DAY_MS))
  return eventDay <= lastDay
}

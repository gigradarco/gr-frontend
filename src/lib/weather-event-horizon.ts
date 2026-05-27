/** NEA cached payloads cover near-term windows; do not show event weather beyond this horizon. */
export const EVENT_WEATHER_MAX_DAYS = 4

function startOfLocalDay(date: Date): Date {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

export function isEventWithinWeatherHorizon(
  eventDateTime: string | null | undefined,
  now = new Date(),
): boolean {
  if (!eventDateTime?.trim()) return false

  const eventAt = new Date(eventDateTime)
  if (Number.isNaN(eventAt.getTime())) return false
  if (eventAt.getTime() < now.getTime()) return false

  const eventDay = startOfLocalDay(eventAt)
  const today = startOfLocalDay(now)
  const lastDay = new Date(today)
  lastDay.setDate(lastDay.getDate() + EVENT_WEATHER_MAX_DAYS)

  return eventDay.getTime() <= lastDay.getTime()
}

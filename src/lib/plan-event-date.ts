import { PLAN_CONFIG } from '../config/plan'

function localDateKey(date: Date, timeZone = PLAN_CONFIG.timeZone): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isPastPlanEventDateTime(value: string | null | undefined, now = new Date()): boolean {
  if (!value) return false
  const eventDate = new Date(value)
  if (!Number.isFinite(eventDate.getTime())) return false
  return localDateKey(eventDate) < localDateKey(now)
}

export function planSegmentForEventDateTime(
  value: string | null | undefined,
  now = new Date(),
): 'upcoming' | 'past' {
  return isPastPlanEventDateTime(value, now) ? 'past' : 'upcoming'
}

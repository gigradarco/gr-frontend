import { describe, expect, it } from 'vitest'
import { isPastPlanEventDateTime, planSegmentForEventDateTime } from './plan-event-date'

describe('plan event date', () => {
  const now = new Date('2026-05-25T12:00:00+08:00')

  it('treats dates before today in Singapore as past', () => {
    expect(isPastPlanEventDateTime('2026-05-24T23:59:00+08:00', now)).toBe(true)
    expect(planSegmentForEventDateTime('2026-05-24T23:59:00+08:00', now)).toBe('past')
  })

  it('keeps today and future dates in upcoming', () => {
    expect(isPastPlanEventDateTime('2026-05-25T01:00:00+08:00', now)).toBe(false)
    expect(isPastPlanEventDateTime('2026-06-01T12:00:00+08:00', now)).toBe(false)
    expect(planSegmentForEventDateTime('2026-05-25T01:00:00+08:00', now)).toBe('upcoming')
  })

  it('keeps missing or invalid dates in upcoming', () => {
    expect(isPastPlanEventDateTime(null, now)).toBe(false)
    expect(isPastPlanEventDateTime('not-a-date', now)).toBe(false)
  })
})

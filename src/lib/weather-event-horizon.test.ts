import { describe, expect, it } from 'vitest'
import { isEventWithinWeatherHorizon } from './weather-event-horizon'

describe('isEventWithinWeatherHorizon', () => {
  const now = new Date('2026-05-27T12:00:00')

  it('accepts events within the next 4 calendar days', () => {
    expect(isEventWithinWeatherHorizon('2026-05-27T22:00:00', now)).toBe(true)
    expect(isEventWithinWeatherHorizon('2026-05-31T22:00:00', now)).toBe(true)
  })

  it('rejects events more than 4 days out', () => {
    expect(isEventWithinWeatherHorizon('2026-06-01T00:00:00', now)).toBe(false)
    expect(isEventWithinWeatherHorizon('2026-06-15T00:00:00', now)).toBe(false)
  })

  it('rejects past events and missing dates', () => {
    expect(isEventWithinWeatherHorizon('2026-05-27T10:00:00', now)).toBe(false)
    expect(isEventWithinWeatherHorizon(null, now)).toBe(false)
    expect(isEventWithinWeatherHorizon('not-a-date', now)).toBe(false)
  })
})

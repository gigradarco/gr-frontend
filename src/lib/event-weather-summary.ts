import { apiBase } from './api-base'
import { isEventWithinWeatherHorizon } from './weather-event-horizon'

export type EventWeatherSummaryAvailable = {
  available: true
  areaName: string
  condition: string
  adviceLabel: string
  temperatureC: number | null
  humidityPct: number | null
  validText: string
}

export type EventWeatherSummaryUnavailable = {
  available: false
  message: 'No data available'
}

export type EventWeatherSummary = EventWeatherSummaryAvailable | EventWeatherSummaryUnavailable

const unavailableSummary: EventWeatherSummaryUnavailable = {
  available: false,
  message: 'No data available',
}

export async function fetchEventWeatherSummary(
  input: {
    lat?: number
    lng?: number
    cityId?: string
    eventDateTime?: string | null
  },
  signal?: AbortSignal,
): Promise<EventWeatherSummary> {
  const lat = input.lat
  const lng = input.lng
  const cityId = input.cityId?.trim() || 'singapore'

  if (!isEventWithinWeatherHorizon(input.eventDateTime)) {
    return unavailableSummary
  }

  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return unavailableSummary
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    cityId,
  })
  if (input.eventDateTime?.trim()) {
    params.set('eventAt', input.eventDateTime.trim())
  }

  try {
    const res = await fetch(`${apiBase()}/api/weather/event-summary/event?${params.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!res.ok) return unavailableSummary

    const body = (await res.json()) as EventWeatherSummary
    if (body.available) return body
    return unavailableSummary
  } catch (error) {
    if (signal?.aborted) throw error
    return unavailableSummary
  }
}

export type CityWeatherSummaryAvailable = {
  available: true
  condition: string
  detail: string
  adviceLabel: string
  temperatureMinC: number | null
  temperatureMaxC: number | null
  humidityPct: number | null
  validText: string
  twentyFourHourCondition: string | null
  twentyFourHourValidText: string | null
  twentyFourHourAdviceLabel: string | null
  twentyFourHourTempLowC: number | null
  twentyFourHourTempHighC: number | null
  twentyFourHourHumidityLowPct: number | null
  twentyFourHourHumidityHighPct: number | null
  twentyFourHourValidStart: string | null
  twentyFourHourValidEnd: string | null
  twentyFourHourPeriodCount: number | null
}

export type CityWeatherSummaryUnavailable = {
  available: false
  message: 'No data available'
}

export type CityWeatherSummary = CityWeatherSummaryAvailable | CityWeatherSummaryUnavailable

const unavailableCitySummary: CityWeatherSummaryUnavailable = {
  available: false,
  message: 'No data available',
}

export async function fetchCityWeatherSummary(
  cityId = 'singapore',
  signal?: AbortSignal,
): Promise<CityWeatherSummary> {
  const params = new URLSearchParams({ cityId: cityId.trim() || 'singapore' })

  try {
    const res = await fetch(`${apiBase()}/api/weather/event-summary/city?${params.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!res.ok) return unavailableCitySummary

    const body = (await res.json()) as CityWeatherSummary
    if (body.available) return body
    return unavailableCitySummary
  } catch (error) {
    if (signal?.aborted) throw error
    return unavailableCitySummary
  }
}

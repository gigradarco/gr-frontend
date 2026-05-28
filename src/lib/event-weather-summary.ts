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

export type CityWeatherOutlookDay = {
  day: string
  timestamp: string
  forecastText: string
  adviceLabel: string
  tempLowC: number | null
  tempHighC: number | null
  humidityLowPct: number | null
  humidityHighPct: number | null
}

export type CityWeatherAlert = {
  category: 'flood' | 'rain' | 'thunder' | 'heat' | 'uv'
  title: string
  level: 1 | 2 | 3 | 4 | 5
  levelLabel: string
  kind: 'official' | 'derived'
  message: string
  metricLabel: string
  metricPrimary: string
  metricSecondary: string | null
  sourceBadge: string
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
  cachedAt: string
  cacheExpiresAt: string
  alerts: CityWeatherAlert[]
  fourDayOutlook: {
    status: 'ready' | 'unavailable'
    dayCount: number
    days: CityWeatherOutlookDay[]
  }
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
  options: { forceRefresh?: boolean; signal?: AbortSignal } = {},
): Promise<CityWeatherSummary> {
  const params = new URLSearchParams({ cityId: cityId.trim() || 'singapore' })
  if (options.forceRefresh) params.set('refresh', '1')

  try {
    const res = await fetch(`${apiBase()}/api/weather/event-summary/city?${params.toString()}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    })

    if (!res.ok) return unavailableCitySummary

    const body = (await res.json()) as CityWeatherSummary
    if (body.available) {
      return {
        ...body,
        alerts: Array.isArray(body.alerts) ? body.alerts : [],
        fourDayOutlook: body.fourDayOutlook ?? {
          status: 'unavailable',
          dayCount: 0,
          days: [],
        },
      }
    }
    return unavailableCitySummary
  } catch (error) {
    if (options.signal?.aborted) throw error
    return unavailableCitySummary
  }
}

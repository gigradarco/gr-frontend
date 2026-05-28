import { apiBase } from './api-base'
import { ensureAccessTokenFresh } from './auth-api'
import { getAccessToken } from './session'

const SINGAPORE_CACHE_KEY = 'buzo:weather-map:country:sg:v6'

export const weatherMapCountries = [
  { code: 'SG', label: 'Singapore', available: true },
  { code: 'MY', label: 'Malaysia', available: false },
  { code: 'ID', label: 'Indonesia', available: false },
  { code: 'TH', label: 'Thailand', available: false },
] as const

export type WeatherMapCountryCode = (typeof weatherMapCountries)[number]['code']
export type WeatherMapCacheState = 'network' | 'kv-cache' | 'stale-cache' | 'memory-cache' | 'session-cache'

export type ForecastAreaWeather = {
  name: string
  lat: number
  lng: number
  forecast: string
}

export type WeatherStationValue = {
  stationId: string
  name: string
  lat: number
  lng: number
  value: number
}

export type FloodAlertEvent = {
  label: string
  detail: string
  lat: number | null
  lng: number | null
  radiusM: number | null
}

export type FourDayOutlookDay = {
  day: string
  timestamp: string
  forecastCode: string
  forecastText: string
  forecastSummary: string
  tempLowC: number | null
  tempHighC: number | null
  humidityLowPct: number | null
  humidityHighPct: number | null
}

export type TwentyFourHourForecastPeriod = {
  validStart: string
  validEnd: string
  validText: string
  regions: Array<{
    region: string
    forecastCode: string
    forecastText: string
  }>
}

export type SingaporeWeatherMapData = {
  countryCode: 'SG'
  countryLabel: 'Singapore'
  source: 'data.gov.sg'
  cacheKey: string
  cachedAt: string
  cacheExpiresAt: string
  staleExpiresAt?: string
  cacheState: WeatherMapCacheState
  twoHourForecast: {
    updatedAt: string
    timestamp: string
    validStart: string
    validEnd: string
    validText: string
    areaCount: number
    areas: ForecastAreaWeather[]
  }
  twentyFourHourForecast: {
    status: 'ready' | 'unavailable'
    updatedAt: string
    timestamp: string
    validStart: string
    validEnd: string
    validText: string
    forecastCode: string
    forecastText: string
    tempLowC: number | null
    tempHighC: number | null
    humidityLowPct: number | null
    humidityHighPct: number | null
    periodCount: number
    periods: TwentyFourHourForecastPeriod[]
    note: string
  }
  fourDayOutlook: {
    status: 'ready' | 'unavailable'
    updatedAt: string
    timestamp: string
    dayCount: number
    days: FourDayOutlookDay[]
    note: string
  }
  temperature: {
    timestamp: string
    unit: 'deg C'
    stationCount: number
    minC: number | null
    maxC: number | null
    avgC: number | null
    stations: WeatherStationValue[]
  }
  rainfall: {
    timestamp: string
    unit: 'mm'
    stationCount: number
    activeStationCount: number
    maxMm: number | null
    stations: WeatherStationValue[]
  }
  humidity: {
    timestamp: string
    unit: 'percentage'
    stationCount: number
    avgPct: number | null
    stations: WeatherStationValue[]
  }
  uvIndex: {
    timestamp: string
    updatedAt: string
    latestHour: string
    latestValue: number | null
    maxToday: number | null
    maxHour: string
  }
  floodAlerts: {
    status: 'ready' | 'unavailable'
    timestamp: string
    updatedAt: string
    recordCount: number
    activeAlertCount: number
    alerts: FloodAlertEvent[]
    note: string
  }
}

type StoredSingaporeWeather = Omit<SingaporeWeatherMapData, 'cacheState'>

let memoryCache: StoredSingaporeWeather | null = null

function isFresh(entry: StoredSingaporeWeather, now = Date.now()): boolean {
  return new Date(entry.cacheExpiresAt).getTime() > now
}

function withCacheState(
  entry: StoredSingaporeWeather,
  cacheState: WeatherMapCacheState,
): SingaporeWeatherMapData {
  return { ...entry, cacheState }
}

function readSessionCache(): StoredSingaporeWeather | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SINGAPORE_CACHE_KEY)
    return raw ? (JSON.parse(raw) as StoredSingaporeWeather) : null
  } catch {
    return null
  }
}

function writeSessionCache(entry: StoredSingaporeWeather): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SINGAPORE_CACHE_KEY, JSON.stringify(entry))
  } catch {
    // Storage is an optimization only; backend KV is the source of truth.
  }
}

async function fetchBackendWeather(forceRefresh: boolean, signal?: AbortSignal): Promise<SingaporeWeatherMapData> {
  const fresh = await ensureAccessTokenFresh()
  const token = fresh ? getAccessToken() : null
  if (!token) throw new Error('Not signed in')

  const params = new URLSearchParams({ country: 'SG' })
  if (forceRefresh) params.set('refresh', '1')

  const res = await fetch(`${apiBase()}/api/admin/weather-map?${params.toString()}`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(body.error ?? body.message ?? `Weather backend failed with HTTP ${res.status}`)
  }
  return res.json() as Promise<SingaporeWeatherMapData>
}

async function fetchPublicWeatherMap(
  cityId = 'singapore',
  forceRefresh = false,
  signal?: AbortSignal,
): Promise<SingaporeWeatherMapData> {
  const params = new URLSearchParams({ cityId: cityId.trim() || 'singapore' })
  if (forceRefresh) params.set('refresh', '1')

  const res = await fetch(`${apiBase()}/api/weather/event-summary/map?${params.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
    throw new Error(body.error ?? body.message ?? `Weather map failed with HTTP ${res.status}`)
  }
  return res.json() as Promise<SingaporeWeatherMapData>
}

export async function getSingaporeWeatherMapData({
  forceRefresh = false,
  signal,
}: {
  forceRefresh?: boolean
  signal?: AbortSignal
} = {}): Promise<SingaporeWeatherMapData> {
  if (!forceRefresh && memoryCache && isFresh(memoryCache)) {
    return withCacheState(memoryCache, 'memory-cache')
  }

  if (!forceRefresh) {
    const stored = readSessionCache()
    if (stored && isFresh(stored)) {
      memoryCache = stored
      return withCacheState(stored, 'session-cache')
    }
  }

  const next = await fetchBackendWeather(forceRefresh, signal)
  const stored: StoredSingaporeWeather = { ...next }
  delete (stored as Partial<SingaporeWeatherMapData>).cacheState
  memoryCache = stored
  writeSessionCache(stored)
  return next
}

export async function fetchSingaporeWeatherMapForCity(
  cityId = 'singapore',
  options: { forceRefresh?: boolean; signal?: AbortSignal } = {},
): Promise<SingaporeWeatherMapData> {
  const { forceRefresh = false, signal } = options
  const next = await fetchPublicWeatherMap(cityId, forceRefresh, signal)
  const stored: StoredSingaporeWeather = { ...next }
  delete (stored as Partial<SingaporeWeatherMapData>).cacheState
  memoryCache = stored
  writeSessionCache(stored)
  return next
}

export function isWeatherCountryAvailable(country: WeatherMapCountryCode): boolean {
  return weatherMapCountries.some((item) => item.code === country && item.available)
}

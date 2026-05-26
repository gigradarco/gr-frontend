const DATA_GOV_REALTIME_BASE = 'https://api-open.data.gov.sg/v2/real-time/api'
const SINGAPORE_CACHE_KEY = 'buzo:weather-map:country:sg:v4'
const SINGAPORE_CACHE_TTL_MS = 10 * 60 * 1000

export const weatherMapCountries = [
  { code: 'SG', label: 'Singapore', available: true },
  { code: 'MY', label: 'Malaysia', available: false },
  { code: 'ID', label: 'Indonesia', available: false },
  { code: 'TH', label: 'Thailand', available: false },
] as const

export type WeatherMapCountryCode = (typeof weatherMapCountries)[number]['code']
export type WeatherMapCacheState = 'network' | 'memory-cache' | 'session-cache'

type TwoHourForecastResponse = {
  code: number
  errorMsg: string
  data: {
    area_metadata: Array<{
      name: string
      label_location: {
        latitude: number
        longitude: number
      }
    }>
    items: Array<{
      update_timestamp: string
      timestamp: string
      valid_period: {
        start: string
        end: string
        text: string
      }
      forecasts: Array<{
        area: string
        forecast: string
      }>
    }>
  }
}

type StationReadingResponse = {
  code: number
  errorMsg: string
  data: {
    readingType: string
    readingUnit: string
    stations: Array<{
      id: string
      deviceId: string
      name: string
      location: {
        latitude: number
        longitude: number
      }
    }>
    readings: Array<{
      timestamp: string
      data: Array<{
        stationId: string
        value: number
      }>
    }>
  }
}

type UvIndexResponse = {
  code: number
  errorMsg: string
  data: {
    records: Array<{
      index: Array<{
        value: number
        hour: string
      }>
      date: string
      updatedTimestamp: string
      timestamp: string
    }>
  }
}

type FloodAlertsResponse = {
  code: number
  errorMsg: string
  data: {
    records: Array<{
      datetime: string
      updatedTimestamp: string
      item: {
        type: string
        isStationData: boolean
        readings: unknown[]
      }
    }>
    paginationToken?: string
  }
}

type FourDayOutlookResponse = {
  code: number
  errorMsg: string
  data: {
    records: Array<{
      date: string
      timestamp: string
      updatedTimestamp: string
      forecasts: Array<{
        relativeHumidity?: {
          unit: string
          high?: number
          low?: number
        }
        wind?: {
          direction?: string
          speed?: {
            high?: number
            low?: number
          }
        }
        temperature?: {
          low?: number
          high?: number
          unit: string
        }
        day: string
        timestamp: string
        forecast: {
          code?: string
          text: string
          summary: string
        }
      }>
    }>
  }
}

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

export type SingaporeWeatherMapData = {
  countryCode: 'SG'
  countryLabel: 'Singapore'
  source: 'data.gov.sg'
  cacheKey: string
  cachedAt: string
  cacheExpiresAt: string
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

function hasReadyFourDayOutlook(entry: StoredSingaporeWeather): boolean {
  return entry.fourDayOutlook.status === 'ready' && entry.fourDayOutlook.days.length > 0
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
    // Storage is an optimization only; network data can still render without it.
  }
}

async function fetchRealtime<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${DATA_GOV_REALTIME_BASE}/${endpoint}`, {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) {
    throw new Error(`data.gov.sg ${endpoint} failed with HTTP ${res.status}`)
  }
  const body = (await res.json()) as T
  const status = body as { code?: number; errorMsg?: string }
  if (status.code !== 0) {
    throw new Error(status.errorMsg || `data.gov.sg ${endpoint} returned code ${status.code ?? 'unknown'}`)
  }
  return body
}

async function fetchRealtimeOptional<T>(endpoint: string, signal?: AbortSignal): Promise<T | null> {
  try {
    return await fetchRealtime<T>(endpoint, signal)
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function minMax(values: number[]): { min: number | null; max: number | null } {
  if (values.length === 0) return { min: null, max: null }
  let min = values[0] ?? 0
  let max = values[0] ?? 0
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  return { min: round1(min), max: round1(max) }
}

function mapStationReadings(response: StationReadingResponse): {
  timestamp: string
  stations: WeatherStationValue[]
} {
  const reading = response.data.readings[0]
  const stationById = new Map(response.data.stations.map((station) => [station.id, station]))
  const stations = (reading?.data ?? [])
    .map((row) => {
      const station = stationById.get(row.stationId)
      if (!station) return null
      return {
        stationId: row.stationId,
        name: station.name,
        lat: station.location.latitude,
        lng: station.location.longitude,
        value: row.value,
      }
    })
    .filter((station): station is WeatherStationValue => station != null)
  return { timestamp: reading?.timestamp ?? '', stations }
}

function normalizeUvIndex(response: UvIndexResponse): StoredSingaporeWeather['uvIndex'] {
  const record = response.data.records[0]
  const readings = record?.index ?? []
  const latest = readings[0]
  let maxReading = latest ?? null
  for (const reading of readings) {
    if (!maxReading || reading.value > maxReading.value) {
      maxReading = reading
    }
  }
  return {
    timestamp: record?.timestamp ?? '',
    updatedAt: record?.updatedTimestamp ?? '',
    latestHour: latest?.hour ?? '',
    latestValue: latest?.value ?? null,
    maxToday: maxReading?.value ?? null,
    maxHour: maxReading?.hour ?? '',
  }
}

function valueFromKeys(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function normalizeFloodAlertReading(row: unknown, index: number): FloodAlertEvent {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return {
      label: `Flood alert ${index + 1}`,
      detail: 'Active flood alert event',
    }
  }

  const record = row as Record<string, unknown>
  const label =
    valueFromKeys(record, ['location', 'area', 'name', 'station', 'stationName', 'stationId', 'id']) ??
    `Flood alert ${index + 1}`
  const detail =
    valueFromKeys(record, ['message', 'description', 'remarks', 'status', 'severity', 'value']) ??
    'Active flood alert event'

  return { label, detail }
}

function normalizeFloodAlerts(response: FloodAlertsResponse | null): StoredSingaporeWeather['floodAlerts'] {
  if (!response) {
    return {
      status: 'unavailable',
      timestamp: '',
      updatedAt: '',
      recordCount: 0,
      activeAlertCount: 0,
      alerts: [],
      note: 'Flood alert feed unavailable',
    }
  }

  const latest = response.data.records[0]
  const readings = latest?.item.readings ?? []
  return {
    status: 'ready',
    timestamp: latest?.datetime ?? '',
    updatedAt: latest?.updatedTimestamp ?? '',
    recordCount: response.data.records.length,
    activeAlertCount: readings.length,
    alerts: readings.map(normalizeFloodAlertReading),
    note: 'PUB flood alert events. Flood warning notices are not included in this dataset.',
  }
}

function maybeNumber(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeFourDayOutlook(response: FourDayOutlookResponse | null): StoredSingaporeWeather['fourDayOutlook'] {
  if (!response) {
    return {
      status: 'unavailable',
      updatedAt: '',
      timestamp: '',
      dayCount: 0,
      days: [],
      note: '4-day outlook feed unavailable',
    }
  }

  const latest = response.data.records[0]
  const days = (latest?.forecasts ?? []).map((forecast) => ({
    day: forecast.day,
    timestamp: forecast.timestamp,
    forecastCode: forecast.forecast.code ?? '',
    forecastText: forecast.forecast.text,
    forecastSummary: forecast.forecast.summary,
    tempLowC: maybeNumber(forecast.temperature?.low),
    tempHighC: maybeNumber(forecast.temperature?.high),
    humidityLowPct: maybeNumber(forecast.relativeHumidity?.low),
    humidityHighPct: maybeNumber(forecast.relativeHumidity?.high),
  }))

  return {
    status: 'ready',
    updatedAt: latest?.updatedTimestamp ?? '',
    timestamp: latest?.timestamp ?? '',
    dayCount: days.length,
    days,
    note: 'Islandwide 4-day outlook from data.gov.sg.',
  }
}

async function hydrateCachedFourDayOutlook(
  entry: StoredSingaporeWeather,
  cacheState: WeatherMapCacheState,
  signal?: AbortSignal,
): Promise<SingaporeWeatherMapData> {
  if (hasReadyFourDayOutlook(entry)) {
    return withCacheState(entry, cacheState)
  }

  const fourDayOutlook = await fetchRealtimeOptional<FourDayOutlookResponse>('four-day-outlook', signal)
  if (!fourDayOutlook) {
    return withCacheState(entry, cacheState)
  }

  const hydrated: StoredSingaporeWeather = {
    ...entry,
    fourDayOutlook: normalizeFourDayOutlook(fourDayOutlook),
  }
  memoryCache = hydrated
  writeSessionCache(hydrated)
  return withCacheState(hydrated, cacheState)
}

function normalizeWeatherData(
  forecast: TwoHourForecastResponse,
  temperature: StationReadingResponse,
  rainfall: StationReadingResponse,
  humidity: StationReadingResponse,
  uvIndex: UvIndexResponse,
  fourDayOutlook: FourDayOutlookResponse | null,
  floodAlerts: FloodAlertsResponse | null,
): StoredSingaporeWeather {
  const fetchedAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + SINGAPORE_CACHE_TTL_MS).toISOString()
  const forecastItem = forecast.data.items[0]
  const forecastByArea = new Map((forecastItem?.forecasts ?? []).map((row) => [row.area, row.forecast]))
  const areas = forecast.data.area_metadata.map((area) => ({
    name: area.name,
    lat: area.label_location.latitude,
    lng: area.label_location.longitude,
    forecast: forecastByArea.get(area.name) ?? 'Not available',
  }))
  const temperatureReading = mapStationReadings(temperature)
  const rainfallReading = mapStationReadings(rainfall)
  const humidityReading = mapStationReadings(humidity)
  const tempValues = temperatureReading.stations.map((station) => station.value)
  const rainfallValues = rainfallReading.stations.map((station) => station.value)
  const tempBounds = minMax(tempValues)
  const rainBounds = minMax(rainfallValues)

  return {
    countryCode: 'SG',
    countryLabel: 'Singapore',
    source: 'data.gov.sg',
    cacheKey: SINGAPORE_CACHE_KEY,
    cachedAt: fetchedAt,
    cacheExpiresAt: expiresAt,
    twoHourForecast: {
      updatedAt: forecastItem?.update_timestamp ?? '',
      timestamp: forecastItem?.timestamp ?? '',
      validStart: forecastItem?.valid_period.start ?? '',
      validEnd: forecastItem?.valid_period.end ?? '',
      validText: forecastItem?.valid_period.text ?? 'Not available',
      areaCount: areas.length,
      areas,
    },
    fourDayOutlook: normalizeFourDayOutlook(fourDayOutlook),
    temperature: {
      timestamp: temperatureReading.timestamp,
      unit: 'deg C',
      stationCount: temperatureReading.stations.length,
      minC: tempBounds.min,
      maxC: tempBounds.max,
      avgC: average(tempValues),
      stations: temperatureReading.stations,
    },
    rainfall: {
      timestamp: rainfallReading.timestamp,
      unit: 'mm',
      stationCount: rainfallReading.stations.length,
      activeStationCount: rainfallReading.stations.filter((station) => station.value > 0).length,
      maxMm: rainBounds.max,
      stations: rainfallReading.stations,
    },
    humidity: {
      timestamp: humidityReading.timestamp,
      unit: 'percentage',
      stationCount: humidityReading.stations.length,
      avgPct: average(humidityReading.stations.map((station) => station.value)),
      stations: humidityReading.stations,
    },
    uvIndex: normalizeUvIndex(uvIndex),
    floodAlerts: normalizeFloodAlerts(floodAlerts),
  }
}

export async function getSingaporeWeatherMapData({
  forceRefresh = false,
  signal,
}: {
  forceRefresh?: boolean
  signal?: AbortSignal
} = {}): Promise<SingaporeWeatherMapData> {
  if (!forceRefresh && memoryCache && isFresh(memoryCache)) {
    return hydrateCachedFourDayOutlook(memoryCache, 'memory-cache', signal)
  }

  if (!forceRefresh) {
    const stored = readSessionCache()
    if (stored && isFresh(stored)) {
      memoryCache = stored
      return hydrateCachedFourDayOutlook(stored, 'session-cache', signal)
    }
  }

  const [forecast, temperature, rainfall, humidity, uvIndex, fourDayOutlook, floodAlerts] = await Promise.all([
    fetchRealtime<TwoHourForecastResponse>('two-hr-forecast', signal),
    fetchRealtime<StationReadingResponse>('air-temperature', signal),
    fetchRealtime<StationReadingResponse>('rainfall', signal),
    fetchRealtime<StationReadingResponse>('relative-humidity', signal),
    fetchRealtime<UvIndexResponse>('uv', signal),
    fetchRealtimeOptional<FourDayOutlookResponse>('four-day-outlook', signal),
    fetchRealtimeOptional<FloodAlertsResponse>('weather/flood-alerts', signal),
  ])
  const normalized = normalizeWeatherData(forecast, temperature, rainfall, humidity, uvIndex, fourDayOutlook, floodAlerts)
  memoryCache = normalized
  writeSessionCache(normalized)
  return withCacheState(normalized, 'network')
}

export function isWeatherCountryAvailable(country: WeatherMapCountryCode): boolean {
  return weatherMapCountries.some((item) => item.code === country && item.available)
}

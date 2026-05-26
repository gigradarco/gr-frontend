import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudRain,
  CloudSun,
  Database,
  Globe2,
  MapPin,
  RefreshCw,
  Sun,
  ThermometerSun,
  Waves,
} from 'lucide-react'
import {
  getSingaporeWeatherMapData,
  isWeatherCountryAvailable,
  weatherMapCountries,
  type ForecastAreaWeather,
  type SingaporeWeatherMapData,
  type WeatherMapCountryCode,
  type WeatherStationValue,
} from '../../lib/weather-map-data'
import { getDiscoverMapCityCenter, getDiscoverMapCityDefaultZoom } from '../../lib/discover-map-defaults'
import './admin-weather-map.css'

const WEATHER_COUNTRY_DISCOVER_CITY_ID: Record<WeatherMapCountryCode, string> = {
  SG: 'singapore',
  MY: 'kuala-lumpur',
  ID: 'jakarta',
  TH: 'bangkok',
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type StatFact = {
  label: string
  value: string
}

type WeatherContextRowProps = {
  icon: ReactNode
  title: string
  primary: string
  secondary: string
}

type AdvisoryRowProps = {
  category: WeatherAdvisoryCategory
  title: string
  message: string
  kind?: 'official' | 'derived' | 'source'
  level: WeatherConditionLevel
}

type WeatherConditionLevel = 1 | 2 | 3 | 4 | 5
type WeatherAdvisoryCategory = 'flood' | 'rain' | 'thunder' | 'heat' | 'uv'

type WeatherAdvisorySignal = {
  category: WeatherAdvisoryCategory
  title: string
  message: string
  kind: 'official' | 'derived' | 'source'
  level: WeatherConditionLevel
}

const WEATHER_CONDITION_LEVELS: WeatherConditionLevel[] = [1, 2, 3, 4, 5]

function getWeatherCountryMapDefaults(country: WeatherMapCountryCode): {
  center: [number, number]
  zoom: number
} {
  const cityId = WEATHER_COUNTRY_DISCOVER_CITY_ID[country]
  return {
    center: getDiscoverMapCityCenter(cityId),
    zoom: getDiscoverMapCityDefaultZoom(cityId),
  }
}

function formatTime(value: string): string {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-SG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  }).format(new Date(value))
}

function formatTemperature(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}°C`
}

function formatTemperatureRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'N/A'
  if (min == null || max == null) return formatTemperature(min ?? max)
  return `${min.toFixed(1)} - ${max.toFixed(1)}°C`
}

function formatPercent(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}%`
}

function formatMillimetres(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}mm`
}

function formatRelativeTime(value: string): string {
  if (!value) return 'Not available'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'Not available'
  const diffMs = Date.now() - timestamp
  const absMinutes = Math.max(0, Math.round(Math.abs(diffMs) / 60000))
  if (absMinutes < 1) return diffMs >= 0 ? 'Just now' : 'In less than 1 min'
  if (absMinutes < 60) return diffMs >= 0 ? `${absMinutes}m ago` : `in ${absMinutes}m`
  const hours = Math.round(absMinutes / 60)
  return diffMs >= 0 ? `${hours}h ago` : `in ${hours}h`
}

function formatCacheTtl(expiresAt: string): string {
  if (!expiresAt) return 'No TTL'
  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(expires)) return 'No TTL'
  const remainingMs = expires - Date.now()
  if (remainingMs <= 0) return 'Expired'
  const minutes = Math.ceil(remainingMs / 60000)
  return `${minutes}m left`
}

function formatTemperatureStation(station: WeatherStationValue | null): string {
  if (!station) return 'N/A'
  return `${station.name} ${formatTemperature(station.value)}`
}

function formatRainfallStation(station: WeatherStationValue | null): string {
  if (!station) return 'N/A'
  return `${station.name} ${formatMillimetres(station.value)}`
}

function maxStation(stations: WeatherStationValue[]): WeatherStationValue | null {
  if (stations.length === 0) return null
  return stations.reduce((max, station) => (station.value > max.value ? station : max), stations[0]!)
}

function temperatureLabel(avgC: number | null): string {
  if (avgC == null) return 'No reading'
  if (avgC < 27) return 'Comfortable'
  if (avgC < 30) return 'Warm'
  if (avgC < 33) return 'Hot and humid'
  return 'Very hot'
}

function comfortAdvice(avgC: number | null, humidityPct: number | null): string {
  if (avgC == null) return 'No comfort reading'
  if (avgC >= 33) return 'Heat caution for outdoor plans'
  if (avgC >= 30 && (humidityPct ?? 0) >= 70) return 'Hydrate and dress light'
  if (avgC >= 27 && (humidityPct ?? 0) >= 70) return 'Warm and sticky outdoors'
  if (avgC >= 27) return 'Warm, manageable outdoors'
  return 'Comfortable for most users'
}

function uvLevel(value: number | null): string {
  if (value == null) return 'Not available'
  if (value <= 2) return 'Low'
  if (value <= 5) return 'Moderate'
  if (value <= 7) return 'High'
  if (value <= 10) return 'Very high'
  return 'Extreme'
}

function uvAdvice(value: number | null): string {
  if (value == null) return 'No UV reading available'
  if (value <= 2) return 'Low sun exposure risk'
  if (value <= 5) return 'Use shade for long outdoor queues'
  if (value <= 7) return 'Sunscreen and shade recommended'
  if (value <= 10) return 'Avoid long direct sun exposure'
  return 'Extreme UV: avoid midday exposure'
}

function pluralize(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function conditionLabel(level: WeatherConditionLevel): string {
  if (level === 1) return 'Excellent'
  if (level === 2) return 'Good'
  if (level === 3) return 'Watch'
  if (level === 4) return 'Poor'
  return 'Bad'
}

function conditionTone(level: WeatherConditionLevel): 'normal' | 'watch' | 'active' {
  if (level <= 2) return 'normal'
  if (level === 3) return 'watch'
  return 'active'
}

function hasThunderRisk(areas: ForecastAreaWeather[]): boolean {
  return areas.some((area) => area.forecast.toLowerCase().includes('thunder'))
}

function countForecastAreas(areas: ForecastAreaWeather[], pattern: RegExp): number {
  let count = 0
  for (const area of areas) {
    if (pattern.test(area.forecast)) count += 1
  }
  return count
}

function buildFloodSignal(weather: SingaporeWeatherMapData): WeatherAdvisorySignal {
  if (weather.floodAlerts.status === 'unavailable') {
    return {
      category: 'flood',
      title: 'Flood alerts',
      kind: 'official',
      level: 3,
      message: 'PUB flood alert feed unavailable. Treat as watch until the official feed recovers.',
    }
  }

  if (weather.floodAlerts.activeAlertCount > 0) {
    const labels = weather.floodAlerts.alerts.slice(0, 2).map((alert) => alert.label)
    const suffix = labels.length > 0 ? `: ${labels.join(', ')}` : ''
    return {
      category: 'flood',
      title: 'Flood alerts',
      kind: 'official',
      level: 5,
      message: `${pluralize(weather.floodAlerts.activeAlertCount, 'active PUB flood alert event')}${suffix}.`,
    }
  }

  return {
    category: 'flood',
    title: 'Flood alerts',
    kind: 'official',
    level: 1,
    message: `No active PUB flood alert events · updated ${formatRelativeTime(weather.floodAlerts.updatedAt)}.`,
  }
}

function buildRainSignal(weather: SingaporeWeatherMapData): WeatherAdvisorySignal {
  const maxRain = weather.rainfall.maxMm ?? 0
  const activeStations = weather.rainfall.activeStationCount
  const stationPct = activeStations / Math.max(weather.rainfall.stationCount, 1)
  const rainForecastAreas = countForecastAreas(weather.twoHourForecast.areas, /rain|showers/i)
  const heavyForecastAreas = countForecastAreas(weather.twoHourForecast.areas, /heavy|thundery/i)
  const level: WeatherConditionLevel =
    maxRain >= 20 || stationPct >= 0.4
      ? 5
      : maxRain >= 10 || stationPct >= 0.2 || heavyForecastAreas >= 8
        ? 4
        : maxRain >= 2 || activeStations >= 3 || rainForecastAreas >= 8
          ? 3
          : activeStations > 0 || rainForecastAreas > 0
            ? 2
            : 1

  return {
    category: 'rain',
    title: 'Heavy rain signal',
    kind: 'derived',
    level,
    message:
      level === 1
        ? `No rain signal · ${formatMillimetres(maxRain)} max across ${weather.rainfall.stationCount} stations.`
        : `${formatMillimetres(maxRain)} max · ${pluralize(activeStations, 'station')} reporting rain · ${pluralize(rainForecastAreas, 'forecast area')} mention rain/showers.`,
  }
}

function buildThunderSignal(weather: SingaporeWeatherMapData): WeatherAdvisorySignal {
  const thunderAreas = countForecastAreas(weather.twoHourForecast.areas, /thunder/i)
  const thunderRatio = thunderAreas / Math.max(weather.twoHourForecast.areas.length, 1)
  const level: WeatherConditionLevel =
    thunderAreas === 0
      ? 1
      : thunderRatio >= 0.65
        ? 5
        : thunderRatio >= 0.35
          ? 4
          : thunderRatio >= 0.15
            ? 3
            : 2
  return {
    category: 'thunder',
    title: 'Thunderstorm signal',
    kind: 'derived',
    level,
    message:
      thunderAreas > 0
        ? `${pluralize(thunderAreas, 'forecast area')} mention thunder in the 2-hour nowcast.`
        : 'No thunder wording in current 2-hour nowcast.',
  }
}

function buildHeatSignal(weather: SingaporeWeatherMapData): WeatherAdvisorySignal {
  const avgC = weather.temperature.avgC
  const maxC = weather.temperature.maxC
  const humidity = weather.humidity.avgPct
  const avg = avgC ?? 0
  const max = maxC ?? 0
  const humid = humidity ?? 0
  const level: WeatherConditionLevel =
    avg >= 34 || max >= 35
      ? 5
      : avg >= 32 || max >= 34
        ? 4
        : avg >= 30 || (avg >= 28.5 && humid >= 80)
          ? 3
          : avg >= 27 || humid >= 75
            ? 2
            : 1

  return {
    category: 'heat',
    title: 'Heat signal',
    kind: 'derived',
    level,
    message:
      level <= 2
        ? `${formatTemperature(avgC)} avg · ${formatPercent(humidity)} humidity.`
        : `${temperatureLabel(avgC)} · ${formatTemperature(avgC)} avg · ${formatPercent(humidity)} humidity · ${comfortAdvice(avgC, humidity)}.`,
  }
}

function buildUvSignal(weather: SingaporeWeatherMapData): WeatherAdvisorySignal {
  const latest = weather.uvIndex.latestValue
  const level: WeatherConditionLevel =
    latest == null
      ? 3
      : latest <= 2
        ? 1
        : latest <= 5
          ? 2
          : latest <= 7
            ? 3
            : latest <= 10
              ? 4
              : 5
  return {
    category: 'uv',
    title: 'UV exposure signal',
    kind: 'derived',
    level,
    message: latest == null ? 'No UV reading available.' : `${latest} · ${uvLevel(latest)} · ${uvAdvice(latest)}.`,
  }
}

function forecastColor(forecast: string): string {
  const lower = forecast.toLowerCase()
  if (lower.includes('thunder')) return '#f97316'
  if (lower.includes('showers') || lower.includes('rain')) return '#38bdf8'
  if (lower.includes('cloud')) return '#94a3b8'
  if (lower.includes('fair')) return '#facc15'
  return '#aeb4bf'
}

function temperatureColor(value: number): string {
  if (value >= 33) return '#ef4444'
  if (value >= 30) return '#f97316'
  if (value >= 27) return '#facc15'
  return '#22c55e'
}

function cacheStateLabel(data: SingaporeWeatherMapData): string {
  if (data.cacheState === 'network') return 'Network refresh'
  if (data.cacheState === 'memory-cache') return 'Memory cache'
  return 'Session cache'
}

function forecastConditionSummary(areas: ForecastAreaWeather[]): {
  primary: string
  detail: string
  facts: StatFact[]
} {
  if (areas.length === 0) {
    return {
      primary: 'No forecast areas',
      detail: 'data.gov.sg returned no area-level forecast',
      facts: [],
    }
  }

  const counts = new Map<string, number>()
  for (const area of areas) {
    counts.set(area.forecast, (counts.get(area.forecast) ?? 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [primaryForecast, primaryCount] = ranked[0]!
  const secondary = ranked[1]
  const primaryPct = Math.round((primaryCount / areas.length) * 100)

  return {
    primary: primaryForecast,
    detail: `${primaryCount} of ${areas.length} areas · ${primaryPct}% coverage`,
    facts: [
      { label: 'Areas', value: `${areas.length}` },
      { label: 'Top condition', value: `${primaryPct}%` },
      { label: 'Runner-up', value: secondary ? `${secondary[0]} (${secondary[1]})` : 'None' },
    ],
  }
}

function WeatherContextRow({ icon, title, primary, secondary }: WeatherContextRowProps) {
  return (
    <div className="admin-weather-context-row">
      <span className="admin-weather-context-icon" aria-hidden>
        {icon}
      </span>
      <div className="admin-weather-context-copy">
        <p>{title}</p>
        <strong>{primary}</strong>
        <span>{secondary}</span>
      </div>
    </div>
  )
}

function ScoreBar({ level }: { level: WeatherConditionLevel }) {
  return (
    <div
      className={`admin-weather-scorebar is-level-${level}`}
      role="meter"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={level}
      aria-label={`Condition score ${level} of 5, ${conditionLabel(level)}`}
    >
      {WEATHER_CONDITION_LEVELS.map((segment) => (
        <span
          key={segment}
          className={`admin-weather-scorebar-segment is-level-${segment}${segment <= level ? ' is-active' : ''}`}
        />
      ))}
    </div>
  )
}

function ScoreRuler() {
  return (
    <div className="admin-weather-score-ruler" aria-hidden>
      {WEATHER_CONDITION_LEVELS.map((level) => (
        <span key={level} className={`is-level-${level}`}>
          <i />
          <b>{level}</b>
        </span>
      ))}
    </div>
  )
}

function scoreMetricLabels(category: WeatherAdvisoryCategory): string[] {
  if (category === 'heat') {
    return [
      '<27°C & humidity <75%',
      '27-29.9°C or humidity ≥75%',
      '30-31.9°C or 28.5°C + humidity ≥80%',
      '32-33.9°C or max ≥34°C',
      'avg ≥34°C or max ≥35°C',
    ]
  }

  if (category === 'uv') {
    return ['UV ≤2', 'UV 3-5', 'UV 6-7', 'UV 8-10', 'UV 11+']
  }

  if (category === 'thunder') {
    return ['0 thunder areas', '<15% areas', '15-34% areas', '35-64% areas', '≥65% areas']
  }

  if (category === 'rain') {
    return ['No rain signal', 'Light scattered rain', 'Rain watch', 'Heavy rain risk', 'Severe rain risk']
  }

  return ['No active alerts', 'Monitoring', 'Source unavailable watch', 'Alert watch', 'Active flood alert']
}

function ScoreMetricRuler({
  category,
  level,
}: {
  category: WeatherAdvisoryCategory
  level: WeatherConditionLevel
}) {
  const labels = scoreMetricLabels(category)
  return (
    <div className="admin-weather-score-metric-ruler" aria-label="Score metric thresholds">
      {WEATHER_CONDITION_LEVELS.map((segment, index) => (
        <span key={segment} className={`${segment === level ? 'is-active ' : ''}is-level-${segment}`}>
          {labels[index] ?? ''}
        </span>
      ))}
    </div>
  )
}

function AdvisoryIcon({ category }: { category: WeatherAdvisoryCategory }) {
  if (category === 'flood') return <Waves size={22} strokeWidth={2.35} aria-hidden />
  if (category === 'rain') return <CloudRain size={22} strokeWidth={2.35} aria-hidden />
  if (category === 'heat') return <ThermometerSun size={22} strokeWidth={2.35} aria-hidden />
  if (category === 'uv') return <Sun size={22} strokeWidth={2.35} aria-hidden />
  return <CloudSun size={22} strokeWidth={2.35} aria-hidden />
}

function AdvisoryRow({ category, title, message, kind = 'derived', level }: AdvisoryRowProps) {
  const tone = conditionTone(level)
  return (
    <article className={`admin-weather-advisory-row is-${tone} is-level-${level}`}>
      <div className="admin-weather-advisory-row-head">
        <div className="admin-weather-advisory-title">
          <span className="admin-weather-advisory-icon" aria-hidden>
            <AdvisoryIcon category={category} />
          </span>
          <div>
            <strong>{title}</strong>
            <span>{level}/5 {conditionLabel(level)}</span>
          </div>
        </div>
        <span className={`admin-weather-advisory-badge is-${kind}`}>
          {kind === 'official' ? 'Official' : kind === 'source' ? 'Source' : 'Derived'}
        </span>
      </div>
      <ScoreBar level={level} />
      <ScoreMetricRuler category={category} level={level} />
      <ScoreRuler />
      <div className="admin-weather-advisory-body">
        <p className="admin-weather-alert-message">{message}</p>
      </div>
    </article>
  )
}

function ForecastAreaMarker({ area }: { area: ForecastAreaWeather }) {
  const color = forecastColor(area.forecast)
  return (
    <CircleMarker
      center={[area.lat, area.lng]}
      radius={5}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.32,
        opacity: 0.88,
        weight: 1.5,
      }}
    >
      <Tooltip direction="top" opacity={0.94}>
        <strong>{area.name}</strong>
        <br />
        {area.forecast}
      </Tooltip>
    </CircleMarker>
  )
}

function TemperatureMarker({ station }: { station: WeatherStationValue }) {
  const color = temperatureColor(station.value)
  return (
    <CircleMarker
      center={[station.lat, station.lng]}
      radius={8}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.9,
        opacity: 1,
        weight: 2,
      }}
    >
      <Tooltip direction="top" opacity={0.96}>
        <strong>{station.value.toFixed(1)}°C</strong>
        <br />
        {station.name}
      </Tooltip>
      <Popup>
        <strong>{station.name}</strong>
        <br />
        Temperature: {station.value.toFixed(1)}°C
      </Popup>
    </CircleMarker>
  )
}

function ResetCoordinatesIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

function WeatherMapControls({
  center,
  zoom,
}: {
  center: [number, number]
  zoom: number
}) {
  const map = useMap()
  const prevCenterRef = useRef<[number, number] | null>(null)
  const prevZoomRef = useRef<number | null>(null)

  useEffect(() => {
    const prevCenter = prevCenterRef.current
    const prevZoom = prevZoomRef.current
    const changed =
      !prevCenter ||
      prevCenter[0] !== center[0] ||
      prevCenter[1] !== center[1] ||
      prevZoom !== zoom
    if (!changed) return
    prevCenterRef.current = center
    prevZoomRef.current = zoom
    map.flyTo(center, zoom, { duration: 0.5 })
  }, [center, zoom, map])

  const stopPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <div className="admin-weather-map-controls" onPointerDown={stopPointer}>
      <button
        type="button"
        className="admin-weather-map-control"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => map.zoomIn()}
      >
        +
      </button>
      <button
        type="button"
        className="admin-weather-map-control"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => map.zoomOut()}
      >
        −
      </button>
      <div className="admin-weather-map-control-divider" />
      <button
        type="button"
        className="admin-weather-map-control admin-weather-map-control--reset"
        aria-label="Reset coordinates"
        title="Reset coordinates"
        onClick={() => map.flyTo(center, zoom, { duration: 0.5 })}
      >
        <ResetCoordinatesIcon />
      </button>
    </div>
  )
}

export function AdminWeatherMapPage() {
  const [country, setCountry] = useState<WeatherMapCountryCode>('SG')
  const [countryMenuOpen, setCountryMenuOpen] = useState(false)
  const [weather, setWeather] = useState<SingaporeWeatherMapData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const countryPickerRef = useRef<HTMLDivElement>(null)

  const countryAvailable = isWeatherCountryAvailable(country)
  const selectedCountry = useMemo(
    () => weatherMapCountries.find((item) => item.code === country) ?? weatherMapCountries[0],
    [country],
  )
  const mapDefaults = useMemo(() => getWeatherCountryMapDefaults(country), [country])

  const loadSingaporeWeather = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    setLoadState('loading')
    setError(null)
    try {
      const next = await getSingaporeWeatherMapData({ forceRefresh, signal })
      setWeather(next)
      setLoadState('ready')
    } catch (e) {
      if (signal?.aborted) return
      setLoadState('error')
      setError(e instanceof Error ? e.message : 'Failed to load weather data')
    }
  }, [])

  useEffect(() => {
    if (!countryAvailable) {
      setLoadState('idle')
      setError(null)
      return
    }
    const controller = new AbortController()
    void loadSingaporeWeather(false, controller.signal)
    return () => controller.abort()
  }, [countryAvailable, loadSingaporeWeather])

  useEffect(() => {
    if (!countryMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!countryPickerRef.current?.contains(event.target as Node)) {
        setCountryMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCountryMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [countryMenuOpen])

  const rainSummary = useMemo(() => {
    if (!weather) return 'No rain data'
    if (weather.rainfall.activeStationCount === 0) return 'No active rain stations'
    return `${weather.rainfall.activeStationCount} active rain stations`
  }, [weather])
  const forecastSummary = useMemo(
    () => (weather ? forecastConditionSummary(weather.twoHourForecast.areas) : null),
    [weather],
  )
  const hottestStation = useMemo(
    () => (weather ? maxStation(weather.temperature.stations) : null),
    [weather],
  )
  const wettestStation = useMemo(
    () => (weather ? maxStation(weather.rainfall.stations) : null),
    [weather],
  )
  const advisorySignals = useMemo(
    () => (weather ? [
      buildFloodSignal(weather),
      buildRainSignal(weather),
      buildThunderSignal(weather),
      buildHeatSignal(weather),
      buildUvSignal(weather),
    ] : []),
    [weather],
  )

  return (
    <main className="admin-weather-page">
      <section className="admin-weather-shell" aria-labelledby="admin-weather-title">
        <header className="admin-weather-header">
          <Link to="/admin" className="admin-weather-back" aria-label="Back to admin">
            <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
          </Link>
          <div>
            <p className="admin-weather-kicker">Admin weather</p>
            <h1 id="admin-weather-title">Weather Map</h1>
            <p className="admin-weather-copy">
              Region-cached weather layer for event context.
            </p>
          </div>
          <button
            type="button"
            className="admin-weather-refresh"
            onClick={() => void loadSingaporeWeather(true)}
            disabled={!countryAvailable || loadState === 'loading'}
          >
            <RefreshCw size={16} strokeWidth={2.2} aria-hidden className={loadState === 'loading' ? 'is-spinning' : undefined} />
            Refresh
          </button>
        </header>

        <div className="admin-weather-control-row">
          <div className="admin-weather-country-picker" ref={countryPickerRef}>
            <button
              type="button"
              className="admin-weather-country-trigger"
              aria-haspopup="listbox"
              aria-expanded={countryMenuOpen}
              aria-label={`Country: ${selectedCountry.label}`}
              onClick={() => setCountryMenuOpen((open) => !open)}
            >
              <span className="admin-weather-country-trigger-icon" aria-hidden>
                <Globe2 size={17} strokeWidth={2.25} />
              </span>
              <span className="admin-weather-country-trigger-copy">
                <small>Country</small>
                <strong>{selectedCountry.label}</strong>
              </span>
              <ChevronDown
                className="admin-weather-country-trigger-chevron"
                size={16}
                strokeWidth={2.25}
                aria-hidden
              />
            </button>

            {countryMenuOpen ? (
              <div className="admin-weather-country-menu" role="listbox" aria-label="Choose weather country">
                {weatherMapCountries.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    role="option"
                    aria-selected={country === item.code}
                    className={`admin-weather-country-option${country === item.code ? ' is-active' : ''}${!item.available ? ' is-muted' : ''}`}
                    onClick={() => {
                      setCountry(item.code)
                      setCountryMenuOpen(false)
                    }}
                  >
                    <span className="admin-weather-country-option-icon" aria-hidden>
                      {country === item.code ? (
                        <Check size={15} strokeWidth={2.4} />
                      ) : (
                        <MapPin size={15} strokeWidth={2.25} />
                      )}
                    </span>
                    <span className="admin-weather-country-option-copy">
                      <strong>{item.label}</strong>
                      <small>{item.available ? 'Available' : 'Not available'}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {countryAvailable && weather ? (
          <section className="admin-weather-dashboard" aria-label="Singapore weather overview">
            <article className="admin-weather-nea-panel admin-weather-forecast-panel">
              <div className="admin-weather-forecast-head">
                <span className="admin-weather-panel-icon" aria-hidden>
                  {hasThunderRisk(weather.twoHourForecast.areas) ? (
                    <CloudRain size={52} strokeWidth={2.25} />
                  ) : (
                    <CloudSun size={52} strokeWidth={2.25} />
                  )}
                </span>
                <div>
                  <h2>2-hour weather nowcast</h2>
                  <p>{forecastSummary?.primary ?? weather.twoHourForecast.validText}</p>
                </div>
              </div>

              <div className="admin-weather-forecast-temp">
                {formatTemperatureRange(weather.temperature.minC, weather.temperature.maxC)}
              </div>

              <div className="admin-weather-forecast-foot">
                <span>{weather.twoHourForecast.validText}</span>
                <span>{formatPercent(weather.humidity.avgPct)} humidity</span>
                <span>{weather.twoHourForecast.areaCount} forecast areas</span>
              </div>
            </article>

            <article className="admin-weather-nea-panel admin-weather-context-panel">
              <h2>Event weather context</h2>
              <div className="admin-weather-context-list">
                <WeatherContextRow
                  icon={<ThermometerSun size={36} strokeWidth={2.3} />}
                  title="Outdoor comfort"
                  primary={temperatureLabel(weather.temperature.avgC)}
                  secondary={`${formatTemperature(weather.temperature.avgC)} avg · ${formatPercent(weather.humidity.avgPct)} humidity · hottest ${formatTemperatureStation(hottestStation)}`}
                />
                <WeatherContextRow
                  icon={<CloudRain size={36} strokeWidth={2.3} />}
                  title="Rain areas"
                  primary={rainSummary}
                  secondary={`${formatMillimetres(weather.rainfall.maxMm)} max · ${wettestStation ? formatRainfallStation(wettestStation) : `${weather.rainfall.stationCount} stations`}`}
                />
                <WeatherContextRow
                  icon={<Waves size={36} strokeWidth={2.3} />}
                  title="Flood alerts"
                  primary={weather.floodAlerts.activeAlertCount > 0 ? `${weather.floodAlerts.activeAlertCount} active` : 'No active alerts'}
                  secondary={weather.floodAlerts.status === 'ready'
                    ? `Official PUB feed · updated ${formatRelativeTime(weather.floodAlerts.updatedAt)}`
                    : weather.floodAlerts.note}
                />
                <WeatherContextRow
                  icon={<Sun size={36} strokeWidth={2.3} />}
                  title="UV index"
                  primary={`${weather.uvIndex.latestValue ?? 'N/A'} · ${uvLevel(weather.uvIndex.latestValue)}`}
                  secondary={`${uvAdvice(weather.uvIndex.latestValue)} · latest ${formatTime(weather.uvIndex.latestHour)}`}
                />
                <WeatherContextRow
                  icon={<Database size={36} strokeWidth={2.3} />}
                  title="Region cache"
                  primary="country:SG"
                  secondary={`${cacheStateLabel(weather)} · ${formatCacheTtl(weather.cacheExpiresAt)} · refreshed ${formatRelativeTime(weather.cachedAt)}`}
                />
              </div>
            </article>

            <article className="admin-weather-nea-panel admin-weather-advisory-panel">
              <h2>Alerts & derived signals</h2>
              <div className="admin-weather-advisory-scale" aria-label="Weather condition scale">
                {WEATHER_CONDITION_LEVELS.map((level) => (
                  <span key={level} className={`is-level-${level}`}>
                    <i aria-hidden />
                    {level} {conditionLabel(level)}
                  </span>
                ))}
              </div>
              <div className="admin-weather-advisory-list">
                {advisorySignals.map((signal) => (
                  <AdvisoryRow
                    key={signal.title}
                    category={signal.category}
                    title={signal.title}
                    message={signal.message}
                    kind={signal.kind}
                    level={signal.level}
                  />
                ))}
              </div>
              <p className="admin-weather-advisory-note">
                Flood uses official PUB alert events. Rain, thunder, heat, and UV are scored from data.gov.sg readings and forecasts.
              </p>
            </article>
          </section>
        ) : null}

        {countryAvailable ? (
          <section className="admin-weather-map-card" aria-label="Singapore weather map">
            {loadState === 'error' ? (
              <div className="admin-weather-state" role="alert">
                {error}
              </div>
            ) : null}
            {loadState === 'loading' && !weather ? (
              <div className="admin-weather-state">Loading Singapore weather data...</div>
            ) : null}
            {weather ? (
              <>
                <div className="admin-weather-map-legend">
                  <span><i className="is-temp" /> Temperature station</span>
                  <span><i className="is-forecast" /> Forecast area</span>
                </div>
                <MapContainer
                  center={mapDefaults.center}
                  zoom={mapDefaults.zoom}
                  zoomControl={false}
                  attributionControl={false}
                  className="admin-weather-leaflet"
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    subdomains={['a', 'b', 'c', 'd']}
                    maxZoom={20}
                  />
                  <WeatherMapControls center={mapDefaults.center} zoom={mapDefaults.zoom} />
                  {weather.twoHourForecast.areas.map((area) => (
                    <ForecastAreaMarker key={area.name} area={area} />
                  ))}
                  {weather.temperature.stations.map((station) => (
                    <TemperatureMarker key={station.stationId} station={station} />
                  ))}
                </MapContainer>
              </>
            ) : null}
          </section>
        ) : (
          <section className="admin-weather-unavailable" aria-live="polite">
            <h2>{weatherMapCountries.find((item) => item.code === country)?.label} weather not available</h2>
            <p>Only Singapore is wired for this POC. Other countries need a source contract and normalized cache key.</p>
            <code>weather:country:{country.toLowerCase()}</code>
          </section>
        )}
      </section>
    </main>
  )
}

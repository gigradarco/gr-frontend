import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Link } from 'react-router-dom'
import { divIcon, type DivIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudMoon,
  CloudRain,
  CloudSun,
  Globe2,
  MapPin,
  Moon,
  RefreshCw,
  Sun,
  Table2,
  Wind,
  Zap,
} from 'lucide-react'
import {
  getSingaporeWeatherMapData,
  isWeatherCountryAvailable,
  weatherMapCountries,
  type ForecastAreaWeather,
  type FourDayOutlookDay,
  type SingaporeWeatherMapData,
  type TwentyFourHourForecastPeriod,
  type WeatherMapCountryCode,
  type WeatherStationValue,
} from '../../lib/weather-map-data'
import { buildForecastWeatherAdvice, buildFourDayWeatherAdvice, type WeatherAdvice } from '../../lib/weather-advice'
import { getDiscoverMapCityCenter, getDiscoverMapCityDefaultZoom } from '../../lib/discover-map-defaults'
import {
  mapTwentyFourHourPeriodToAreas,
  pickActiveTwentyFourHourPeriod,
  type MapForecastLayer,
} from '../../lib/weather-map-map-layers'
import './admin-weather-map.css'

const WEATHER_COUNTRY_DISCOVER_CITY_ID: Record<WeatherMapCountryCode, string> = {
  SG: 'singapore',
  MY: 'kuala-lumpur',
  ID: 'jakarta',
  TH: 'bangkok',
}

const SOURCE_TTL = {
  twoHourForecast: 'Source TTL 30m',
  twentyFourHourForecast: 'Source TTL 6h',
  fourDayOutlook: 'Source TTL 12h',
} as const

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type ForecastTableCard = 'nowcast' | 'twentyFour' | null
type StatFact = {
  label: string
  value: string
}

type AdvisoryRowProps = {
  category: WeatherAdvisoryCategory
  title: string
  message: string
  context: string
  kind?: 'official' | 'derived' | 'source'
  level: WeatherConditionLevel
}

type WeatherConditionLevel = 1 | 2 | 3 | 4 | 5
type WeatherAdvisoryCategory = 'flood' | 'rain' | 'thunder' | 'heat' | 'uv'
type ForecastMarkerKind =
  | 'fair'
  | 'fair-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunder'
  | 'heavy-thunder'
  | 'wind'
  | 'haze'

type WeatherAdvisorySignal = {
  category: WeatherAdvisoryCategory
  title: string
  message: string
  kind: 'official' | 'derived' | 'source'
  level: WeatherConditionLevel
}

const WEATHER_CONDITION_LEVELS: WeatherConditionLevel[] = [1, 2, 3, 4, 5]
const forecastIconCache = new Map<string, DivIcon>()

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

function formatForecastTimeRange(start: string, end: string): string {
  const formattedStart = formatTime(start)
  const formattedEnd = formatTime(end)
  if (formattedStart === 'Not available' || formattedEnd === 'Not available') return 'Not available'
  return `${formattedStart} - ${formattedEnd}`
}

function formatForecastDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'Not available'
  const dateFormatter = new Intl.DateTimeFormat('en-SG', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  })
  const timeFormatter = new Intl.DateTimeFormat('en-SG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  })
  const today = new Date()
  const sameSingaporeDay =
    startDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) ===
    today.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const startLabel = sameSingaporeDay ? `Today ${timeFormatter.format(startDate)}` : dateFormatter.format(startDate)
  return `${startLabel} - ${dateFormatter.format(endDate)}`
}

function formatOutlookDate(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-SG', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Singapore',
  }).format(date)
}

function formatTemperature(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}°C`
}

function formatTemperatureRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'N/A'
  if (min == null || max == null) return formatTemperature(min ?? max)
  return `${min.toFixed(1)} - ${max.toFixed(1)}°C`
}

function formatOutlookTemperatureRange(day: FourDayOutlookDay): string {
  if (day.tempLowC == null && day.tempHighC == null) return 'N/A'
  if (day.tempLowC == null || day.tempHighC == null) {
    return `${day.tempLowC ?? day.tempHighC}°C`
  }
  return `${day.tempLowC} - ${day.tempHighC}°C`
}

function formatOutlookHumidityRange(day: FourDayOutlookDay): string {
  if (day.humidityLowPct == null && day.humidityHighPct == null) return 'N/A'
  if (day.humidityLowPct == null || day.humidityHighPct == null) {
    return `${day.humidityLowPct ?? day.humidityHighPct}%`
  }
  return `${day.humidityLowPct} - ${day.humidityHighPct}%`
}

function formatForecastTemperatureRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'N/A'
  if (low == null || high == null) return `${low ?? high}°C`
  return `${low} - ${high}°C`
}

function formatForecastHumidityRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'N/A'
  if (low == null || high == null) return `${low ?? high}%`
  return `${low} - ${high}%`
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

function formatCacheRefreshRate(cachedAt: string, expiresAt: string): string {
  const cached = new Date(cachedAt).getTime()
  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(cached) || Number.isNaN(expires) || expires <= cached) return 'refresh rate unavailable'
  const minutes = Math.max(1, Math.round((expires - cached) / 60000))
  if (minutes < 60) return `refresh every ${minutes}m`
  const hours = Math.round(minutes / 60)
  return `refresh every ${hours}h`
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
    message: 'No active PUB flood alert events.',
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
        ? 'No wet-weather action needed from current rain readings.'
        : level >= 4
          ? 'Heavy rain risk: keep wet-weather routing and sheltered queue plans ready.'
          : `${pluralize(rainForecastAreas, 'forecast area')} mention rain/showers. Monitor if the event has exposed outdoor queues.`,
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
        ? comfortAdvice(avgC, humidity)
        : `${temperatureLabel(avgC)} · ${comfortAdvice(avgC, humidity)}.`,
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

function advisoryContextLine(
  signal: WeatherAdvisorySignal,
  weather: SingaporeWeatherMapData,
  hottestStation: WeatherStationValue | null,
  wettestStation: WeatherStationValue | null,
): string {
  if (signal.category === 'heat') {
    return `Outdoor comfort · ${formatTemperature(weather.temperature.avgC)} avg · ${formatPercent(weather.humidity.avgPct)} humidity · hottest ${formatTemperatureStation(hottestStation)}`
  }

  if (signal.category === 'rain') {
    const activeText = weather.rainfall.activeStationCount === 0
      ? 'No active rain stations'
      : `${weather.rainfall.activeStationCount} active rain stations`
    return `Rain areas · ${activeText} · ${formatMillimetres(weather.rainfall.maxMm)} max · ${wettestStation ? formatRainfallStation(wettestStation) : `${weather.rainfall.stationCount} stations`}`
  }

  if (signal.category === 'flood') {
    return weather.floodAlerts.status === 'ready'
      ? `Official PUB feed · updated ${formatRelativeTime(weather.floodAlerts.updatedAt)}`
      : weather.floodAlerts.note
  }

  if (signal.category === 'uv') {
    return `UV index · latest ${formatTime(weather.uvIndex.latestHour)}`
  }

  const thunderAreas = countForecastAreas(weather.twoHourForecast.areas, /thunder/i)
  return `2-hour nowcast · ${thunderAreas} of ${weather.twoHourForecast.areas.length} areas mention thunder`
}

function forecastMarkerKind(forecast: string): ForecastMarkerKind {
  const lower = forecast.toLowerCase()
  if (lower.includes('heavy') && lower.includes('thunder')) return 'heavy-thunder'
  if (lower.includes('thunder')) return 'thunder'
  if (lower.includes('heavy') && (lower.includes('rain') || lower.includes('showers'))) return 'heavy-rain'
  if (lower.includes('drizzle') || lower.includes('light')) return 'drizzle'
  if (lower.includes('rain') || lower.includes('showers')) return 'rain'
  if (lower.includes('wind')) return 'wind'
  if (lower.includes('haze') || lower.includes('mist') || lower.includes('fog')) return 'haze'
  if (lower.includes('fair') && lower.includes('night')) return 'fair-night'
  if (lower.includes('partly') && lower.includes('night')) return 'partly-cloudy-night'
  if (lower.includes('partly')) return 'partly-cloudy'
  if (lower.includes('cloud')) return 'cloudy'
  if (lower.includes('fair') || lower.includes('sun')) return 'fair'
  return 'cloudy'
}

function ThunderShowerGlyph({
  size = 13,
  strokeWidth = 2.7,
  variant = 'thunder',
}: {
  size?: number
  strokeWidth?: number
  variant?: 'thunder' | 'heavy-thunder'
}) {
  const boltSize = Math.max(8, Math.round(size * 0.5))
  return (
    <span
      className={`admin-weather-thunder-shower-glyph${variant === 'heavy-thunder' ? ' is-heavy' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <CloudRain size={size} strokeWidth={strokeWidth} className="admin-weather-thunder-shower-rain" />
      <Zap
        size={boltSize}
        strokeWidth={strokeWidth + 0.15}
        fill="currentColor"
        className="admin-weather-thunder-shower-bolt"
      />
    </span>
  )
}

function PartlyCloudyGlyph({ size = 13, strokeWidth = 2.7 }: { size?: number; strokeWidth?: number }) {
  return (
    <span
      className="admin-weather-partly-cloudy-glyph"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Sun size={Math.round(size * 0.78)} strokeWidth={strokeWidth} className="admin-weather-partly-cloudy-sun" />
      <Cloud size={Math.round(size * 0.82)} strokeWidth={strokeWidth} className="admin-weather-partly-cloudy-cloud" />
    </span>
  )
}

function ForecastMarkerGlyph({ kind, size = 13 }: { kind: ForecastMarkerKind; size?: number }) {
  const props = { size, strokeWidth: 2.7, 'aria-hidden': true }
  if (kind === 'fair') return <Sun {...props} />
  if (kind === 'fair-night') return <Moon {...props} />
  if (kind === 'partly-cloudy-night') return <CloudMoon {...props} />
  if (kind === 'partly-cloudy') return <PartlyCloudyGlyph size={size} strokeWidth={props.strokeWidth} />
  if (kind === 'cloudy') return <Cloud {...props} />
  if (kind === 'drizzle') return <CloudDrizzle {...props} />
  if (kind === 'rain' || kind === 'heavy-rain') return <CloudRain {...props} />
  if (kind === 'thunder') return <ThunderShowerGlyph size={size} strokeWidth={props.strokeWidth} variant="thunder" />
  if (kind === 'heavy-thunder') {
    return <ThunderShowerGlyph size={size} strokeWidth={props.strokeWidth} variant="heavy-thunder" />
  }
  if (kind === 'wind') return <Wind {...props} />
  if (kind === 'haze') return <CloudFog {...props} />
  return <CloudSun {...props} />
}

function forecastMarkerIcon(kind: ForecastMarkerKind, size: 'area' | 'region' = 'area'): DivIcon {
  const cacheKey = `${kind}:${size}`
  const cached = forecastIconCache.get(cacheKey)
  if (cached) return cached

  const glyphSize = size === 'region' ? 15 : 13
  const markerSize = size === 'region' ? 30 : 24
  const anchor = markerSize / 2
  const icon = divIcon({
    className: `admin-weather-forecast-div-icon is-${kind}${size === 'region' ? ' is-region' : ''}`,
    html: `<span class="admin-weather-forecast-marker">${renderToStaticMarkup(
      <ForecastMarkerGlyph kind={kind} size={glyphSize} />,
    )}</span>`,
    iconAnchor: [anchor, anchor],
    iconSize: [markerSize, markerSize],
    popupAnchor: [0, -anchor - 1],
    tooltipAnchor: [0, -anchor - 1],
  })
  forecastIconCache.set(cacheKey, icon)
  return icon
}

function temperatureColor(value: number): string {
  if (value >= 33) return '#ef4444'
  if (value >= 30) return '#f97316'
  if (value >= 27) return '#facc15'
  return '#22c55e'
}

function cacheStateLabel(data: SingaporeWeatherMapData): string {
  if (data.cacheState === 'network') return 'Network refresh'
  if (data.cacheState === 'kv-cache') return 'Backend KV cache'
  if (data.cacheState === 'stale-cache') return 'Stale KV fallback'
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

function FourDayOutlookPanel({ weather }: { weather: SingaporeWeatherMapData }) {
  return (
    <article className="admin-weather-nea-panel admin-weather-outlook-panel">
      <div className="admin-weather-outlook-head">
        <div>
          <h2>Next few days outlook (Islandwide)</h2>
          <p>
            {weather.fourDayOutlook.status === 'ready'
              ? 'Islandwide 24-hour 4-day forecast'
              : weather.fourDayOutlook.note}
          </p>
          <p className="admin-weather-outlook-cache">
            {SOURCE_TTL.fourDayOutlook}
          </p>
        </div>
        <span>{weather.fourDayOutlook.dayCount || 'N/A'} days</span>
      </div>

      {weather.fourDayOutlook.days.length > 0 ? (
        <div className="admin-weather-outlook-grid">
          {weather.fourDayOutlook.days.map((day) => (
            <article className="admin-weather-outlook-day" key={day.timestamp || day.day}>
              <div className="admin-weather-outlook-day-head">
                <p className="admin-weather-outlook-day-name">{day.day}</p>
                <span className="admin-weather-outlook-day-date">{formatOutlookDate(day.timestamp)}</span>
                <span className={`admin-weather-outlook-icon is-${forecastMarkerKind(day.forecastText)}`} aria-hidden>
                  <ForecastMarkerGlyph kind={forecastMarkerKind(day.forecastText)} size={42} />
                </span>
              </div>

              <strong className="admin-weather-outlook-condition">{day.forecastText}</strong>
              <OutlookAdviceList day={day} />

              <div className="admin-weather-outlook-meta">
                <div className="admin-weather-outlook-stat">
                  <b>Temp</b>
                  <span>{formatOutlookTemperatureRange(day)}</span>
                </div>
                <div className="admin-weather-outlook-stat">
                  <b>Humidity</b>
                  <span>{formatOutlookHumidityRange(day)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-weather-outlook-empty">
          4-day outlook is not available for this refresh.
        </div>
      )}
    </article>
  )
}

function OutlookAdviceList({ day }: { day: FourDayOutlookDay }) {
  return (
    <WeatherAdviceSection
      adviceItems={buildFourDayWeatherAdvice(day)}
      ariaLabel={`Suggested prep for ${day.day}`}
    />
  )
}

function WeatherAdviceSection({ adviceItems, ariaLabel }: { adviceItems: WeatherAdvice[]; ariaLabel: string }) {
  return (
    <section className="admin-weather-outlook-recommendation" aria-label={ariaLabel}>
      <b>Recommendations</b>
      <div className="admin-weather-outlook-advice">
        {adviceItems.map((advice) => (
          <span
            className={`admin-weather-outlook-advice-item is-${advice.level}`}
            key={advice.id}
            title={advice.reason}
          >
            {advice.label}
          </span>
        ))}
      </div>
    </section>
  )
}

function BackendCacheStatus({ weather }: { weather: SingaporeWeatherMapData | null }) {
  if (!weather) return null

  return (
    <div className="admin-weather-backend-cache" aria-label="Backend cache status">
      <small>Backend cache</small>
      <strong>{formatCacheTtl(weather.cacheExpiresAt)}</strong>
      <span>{formatCacheRefreshRate(weather.cachedAt, weather.cacheExpiresAt)}</span>
    </div>
  )
}

function ForecastCountButton({
  count,
  label,
  onClick,
}: {
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="admin-weather-forecast-count-card"
      onClick={onClick}
      aria-label={`View ${count} ${label} as a table`}
    >
      <Table2 size={15} strokeWidth={2.25} aria-hidden />
      <span>{count} {label}</span>
      <small>View table</small>
    </button>
  )
}

function ForecastTableBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="admin-weather-forecast-table-back" onClick={onBack}>
      <ArrowLeft size={15} strokeWidth={2.25} aria-hidden />
      Forecast
    </button>
  )
}

function NowcastAreaTableFace({
  areas,
  validText,
  onBack,
}: {
  areas: ForecastAreaWeather[]
  validText: string
  onBack: () => void
}) {
  const sortedAreas = useMemo(
    () => [...areas].sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  )

  return (
    <div className="admin-weather-forecast-table-face">
      <div className="admin-weather-forecast-table-head">
        <div>
          <h2>2-hour area table</h2>
          <p>{validText || 'Area-level nowcast'}</p>
        </div>
        <ForecastTableBackButton onBack={onBack} />
      </div>

      <div className="admin-weather-forecast-table-scroll">
        <table className="admin-weather-forecast-table">
          <thead>
            <tr>
              <th>Area</th>
              <th>Forecast</th>
            </tr>
          </thead>
          <tbody>
            {sortedAreas.map((area) => (
              <tr key={area.name}>
                <td>{area.name}</td>
                <td>{area.forecast}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TwentyFourHourPeriodTableFace({
  periods,
  onBack,
}: {
  periods: TwentyFourHourForecastPeriod[]
  onBack: () => void
}) {
  return (
    <div className="admin-weather-forecast-table-face">
      <div className="admin-weather-forecast-table-head">
        <div>
          <h2>24-hour period table</h2>
          <p>{periods.length} forecast periods by region</p>
        </div>
        <ForecastTableBackButton onBack={onBack} />
      </div>

      <div className="admin-weather-forecast-table-scroll">
        <table className="admin-weather-forecast-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Regional forecast</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={`${period.validStart}-${period.validEnd}`}>
                <td>
                  {period.validText || formatForecastDateRange(period.validStart, period.validEnd)}
                </td>
                <td>
                  <div className="admin-weather-forecast-region-list">
                    {period.regions.map((region) => (
                      <span key={`${period.validStart}-${region.region}`}>
                        <b>{region.region}</b>
                        {region.forecastText}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

  return ['No active alerts', 'Rain monitor', 'PUB feed offline', 'Flood watch', 'Active PUB alert']
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

function sourceTtlValue(category: WeatherAdvisoryCategory): string {
  if (category === 'flood') return 'Real-time'
  if (category === 'rain') return '5m / 30m'
  if (category === 'thunder') return '30m'
  if (category === 'heat') return '5m'
  return '30m'
}

function sourceTtlDescription(category: WeatherAdvisoryCategory): string {
  if (category === 'flood') return 'PUB flood alerts are event-driven real-time source data.'
  if (category === 'rain') return 'Rainfall readings update every 5 minutes; 2-hour forecast updates every 30 minutes.'
  if (category === 'thunder') return '2-hour weather forecast updates every 30 minutes.'
  if (category === 'heat') return 'Air temperature and relative humidity readings update every 5 minutes.'
  return 'UV index updates every 30 minutes.'
}

const ADVISORY_GLYPH_SIZE = 36
const ADVISORY_GLYPH_STROKE = 2.5

function AdvisoryGlyphFrame({
  className,
  size = ADVISORY_GLYPH_SIZE,
  children,
}: {
  className: string
  size?: number
  children: ReactNode
}) {
  return (
    <span
      className={`admin-weather-advisory-glyph ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {children}
    </span>
  )
}

function FloodAdvisoryGlyph({
  size = ADVISORY_GLYPH_SIZE,
  strokeWidth = ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-flood-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          className="admin-weather-flood-wave admin-weather-flood-wave-1"
          d="M2 8c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"
          {...stroke}
        />
        <path
          className="admin-weather-flood-wave admin-weather-flood-wave-2"
          d="M2 13c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"
          {...stroke}
        />
        <path
          className="admin-weather-flood-wave admin-weather-flood-wave-3"
          d="M2 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"
          {...stroke}
        />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

function RainAdvisoryGlyph({
  size = ADVISORY_GLYPH_SIZE,
  strokeWidth = ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-rain-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="admin-weather-rain-cloud-svg" aria-hidden>
        <path
          className="admin-weather-rain-cloud"
          d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
          {...stroke}
        />
        <line className="admin-weather-rain-drop admin-weather-rain-drop-1" x1="8" y1="19" x2="8" y2="22" {...stroke} />
        <line className="admin-weather-rain-drop admin-weather-rain-drop-2" x1="12" y1="19" x2="12" y2="22" {...stroke} />
        <line className="admin-weather-rain-drop admin-weather-rain-drop-3" x1="16" y1="19" x2="16" y2="22" {...stroke} />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

function ThunderAdvisoryGlyph({
  size = ADVISORY_GLYPH_SIZE,
  strokeWidth = ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const boltSize = Math.max(12, Math.round(size * 0.52))

  return (
    <AdvisoryGlyphFrame className="admin-weather-thunder-advisory-glyph" size={size}>
      <Cloud size={size} strokeWidth={strokeWidth} className="admin-weather-thunder-advisory-cloud" />
      <Zap
        size={boltSize}
        strokeWidth={strokeWidth + 0.1}
        fill="currentColor"
        className="admin-weather-thunder-advisory-bolt"
      />
    </AdvisoryGlyphFrame>
  )
}

function HeatAdvisoryGlyph({
  size = ADVISORY_GLYPH_SIZE,
  strokeWidth = ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const sunSize = Math.max(11, Math.round(size * 0.46))
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-heat-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="admin-weather-heat-tube-svg" aria-hidden>
        <path
          className="admin-weather-heat-tube"
          d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a6.5 6.5 0 1 0 5 0z"
          {...stroke}
        />
        <line className="admin-weather-heat-mercury" x1="11.5" y1="11" x2="11.5" y2="17.5" {...stroke} />
      </svg>
      <Sun size={sunSize} strokeWidth={strokeWidth} className="admin-weather-heat-sun" />
    </AdvisoryGlyphFrame>
  )
}

const UV_SUN_CENTER = 12
const UV_SUN_INNER_RADIUS = 4.25
const UV_SUN_OUTER_RADIUS = 10.25
const UV_SUN_RAY_ANGLES = [-90, -45, 0, 45, 90, 135, 180, 225] as const

function uvSunRayEndpoints(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x1: UV_SUN_CENTER + UV_SUN_INNER_RADIUS * cos,
    y1: UV_SUN_CENTER + UV_SUN_INNER_RADIUS * sin,
    x2: UV_SUN_CENTER + UV_SUN_OUTER_RADIUS * cos,
    y2: UV_SUN_CENTER + UV_SUN_OUTER_RADIUS * sin,
  }
}

function UvAdvisoryGlyph({
  size = ADVISORY_GLYPH_SIZE,
  strokeWidth = ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-uv-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <g className="admin-weather-uv-rays">
          {UV_SUN_RAY_ANGLES.map((angle, index) => {
            const { x1, y1, x2, y2 } = uvSunRayEndpoints(angle)
            return (
              <line
                key={angle}
                className={`admin-weather-uv-ray admin-weather-uv-ray-${index + 1}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                fill="none"
                {...stroke}
              />
            )
          })}
        </g>
        <circle
          className="admin-weather-uv-disc"
          cx={UV_SUN_CENTER}
          cy={UV_SUN_CENTER}
          r="4"
          fill="currentColor"
          fillOpacity={0.2}
          {...stroke}
        />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

function AdvisoryIcon({ category }: { category: WeatherAdvisoryCategory }) {
  if (category === 'flood') return <FloodAdvisoryGlyph />
  if (category === 'rain') return <RainAdvisoryGlyph />
  if (category === 'thunder') return <ThunderAdvisoryGlyph />
  if (category === 'heat') return <HeatAdvisoryGlyph />
  if (category === 'uv') return <UvAdvisoryGlyph />
  return <CloudSun size={ADVISORY_GLYPH_SIZE} strokeWidth={ADVISORY_GLYPH_STROKE} aria-hidden />
}

function AdvisoryRow({ category, title, message, context, kind = 'derived', level }: AdvisoryRowProps) {
  const tone = conditionTone(level)
  return (
    <article className={`admin-weather-advisory-row is-${tone} is-level-${level}`}>
      <div className="admin-weather-advisory-row-head">
        <div className="admin-weather-advisory-title">
          <span className={`admin-weather-advisory-icon is-${category}`} aria-hidden>
            <AdvisoryIcon category={category} />
          </span>
          <div className="admin-weather-advisory-title-copy">
            <strong>{title}</strong>
            <span>{level}/5 {conditionLabel(level)}</span>
            <div
              className="admin-weather-advisory-source-row"
              aria-label={`Source TTL ${sourceTtlValue(category)}`}
              title={sourceTtlDescription(category)}
            >
              <span>Source TTL</span>
              <strong>{sourceTtlValue(category)}</strong>
            </div>
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
        <p className="admin-weather-advisory-context">{context}</p>
        <p className="admin-weather-alert-message">{message}</p>
      </div>
    </article>
  )
}

function ForecastAreaMarker({
  area,
  markerSize = 'area',
}: {
  area: ForecastAreaWeather
  markerSize?: 'area' | 'region'
}) {
  const kind = forecastMarkerKind(area.forecast)
  return (
    <Marker position={[area.lat, area.lng]} icon={forecastMarkerIcon(kind, markerSize)}>
      <Tooltip direction="top" opacity={0.94}>
        <strong>{area.name}</strong>
        <br />
        {area.forecast}
      </Tooltip>
    </Marker>
  )
}

function MapLegendForecastIcon({ kind }: { kind: ForecastMarkerKind }) {
  return (
    <span className={`admin-weather-map-legend-icon is-${kind}`} aria-hidden>
      <ForecastMarkerGlyph kind={kind} size={11} />
    </span>
  )
}

function TemperatureMarker({ station }: { station: WeatherStationValue }) {
  const color = temperatureColor(station.value)
  return (
    <CircleMarker
      center={[station.lat, station.lng]}
      radius={7}
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
  const [forecastTableCard, setForecastTableCard] = useState<ForecastTableCard>(null)
  const [mapForecastLayer, setMapForecastLayer] = useState<MapForecastLayer>('twoHour')
  const [showMapForecast, setShowMapForecast] = useState(true)
  const [showMapTemperature, setShowMapTemperature] = useState(true)
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

  const forecastSummary = useMemo(
    () => (weather ? forecastConditionSummary(weather.twoHourForecast.areas) : null),
    [weather],
  )
  const nowcastCondition = forecastSummary?.primary ?? 'Islandwide forecast'
  const nowcastIconKind: ForecastMarkerKind = useMemo(() => {
    if (!weather) return 'cloudy'
    if (hasThunderRisk(weather.twoHourForecast.areas)) return 'thunder'
    return forecastMarkerKind(nowcastCondition)
  }, [weather, nowcastCondition])
  const twentyFourHourIconKind: ForecastMarkerKind = useMemo(() => {
    if (!weather || weather.twentyFourHourForecast.status !== 'ready') return 'cloudy'
    return forecastMarkerKind(weather.twentyFourHourForecast.forecastText)
  }, [weather])
  const nowcastAdvice = useMemo(
    () => weather ? buildForecastWeatherAdvice({
      forecastText: nowcastCondition,
      tempHighC: weather.temperature.maxC,
      humidityHighPct: weather.humidity.avgPct,
    }) : [],
    [weather, nowcastCondition],
  )
  const twentyFourHourAdvice = useMemo(
    () => weather ? buildForecastWeatherAdvice({
      forecastText: weather.twentyFourHourForecast.forecastText,
      tempHighC: weather.twentyFourHourForecast.tempHighC,
      humidityHighPct: weather.twentyFourHourForecast.humidityHighPct,
    }) : [],
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
  const twentyFourHourMapReady = weather?.twentyFourHourForecast.status === 'ready'
  const activeTwentyFourHourPeriod = useMemo(
    () => (weather && twentyFourHourMapReady
      ? pickActiveTwentyFourHourPeriod(weather.twentyFourHourForecast.periods)
      : null),
    [weather, twentyFourHourMapReady],
  )
  const mapForecastAreas = useMemo(() => {
    if (!weather) return []
    if (mapForecastLayer === 'twoHour') return weather.twoHourForecast.areas
    if (!activeTwentyFourHourPeriod) return []
    return mapTwentyFourHourPeriodToAreas(activeTwentyFourHourPeriod)
  }, [weather, mapForecastLayer, activeTwentyFourHourPeriod])
  const mapForecastMarkerSize: 'area' | 'region' = mapForecastLayer === 'twentyFourHour' ? 'region' : 'area'
  const mapLayerNote = useMemo(() => {
    if (!weather) return ''
    if (mapForecastLayer === 'twoHour') {
      return `2-hour nowcast · ${formatForecastTimeRange(weather.twoHourForecast.validStart, weather.twoHourForecast.validEnd)} · ${weather.twoHourForecast.areaCount} areas`
    }
    if (!twentyFourHourMapReady) return '24-hour forecast unavailable'
    if (!activeTwentyFourHourPeriod) return '24-hour forecast has no active period'
    const regionCount = mapForecastAreas.length
    return `24-hour forecast · ${activeTwentyFourHourPeriod.validText} · ${regionCount} ${regionCount === 1 ? 'region' : 'regions'}`
  }, [weather, mapForecastLayer, twentyFourHourMapReady, activeTwentyFourHourPeriod, mapForecastAreas.length])

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
          <BackendCacheStatus weather={weather} />
        </div>

        {countryAvailable && weather ? (
          <section className="admin-weather-dashboard" aria-label="Singapore weather overview">
            <section className="admin-weather-forecast-comparison" aria-label="2-hour and 24-hour forecast comparison">
              <article className={`admin-weather-nea-panel admin-weather-forecast-panel${forecastTableCard === 'nowcast' ? ' is-table-view' : ''}`}>
                {forecastTableCard === 'nowcast' ? (
                  <NowcastAreaTableFace
                    areas={weather.twoHourForecast.areas}
                    validText={weather.twoHourForecast.validText}
                    onBack={() => setForecastTableCard(null)}
                  />
                ) : (
                  <>
                    <div className="admin-weather-forecast-head">
                      <div className="admin-weather-forecast-copy">
                        <h2>2-hour weather nowcast</h2>
                        <p className="admin-weather-forecast-condition">{nowcastCondition}</p>
                        <p className="admin-weather-forecast-cache">
                          {SOURCE_TTL.twoHourForecast}
                        </p>
                      </div>
                      <div className="admin-weather-forecast-side">
                        <span
                          className={`admin-weather-outlook-icon admin-weather-forecast-icon is-${nowcastIconKind}`}
                          aria-hidden
                        >
                          <ForecastMarkerGlyph kind={nowcastIconKind} size={42} />
                        </span>
                        <WeatherAdviceSection adviceItems={nowcastAdvice} ariaLabel="2-hour weather recommendations" />
                      </div>
                    </div>

                    <div className="admin-weather-forecast-meta" aria-label="2-hour nowcast metrics">
                      <div className="admin-weather-outlook-stat">
                        <b>Temp</b>
                        <span>{formatTemperatureRange(weather.temperature.minC, weather.temperature.maxC)}</span>
                      </div>
                      <div className="admin-weather-outlook-stat">
                        <b>Humidity</b>
                        <span>{formatPercent(weather.humidity.avgPct)}</span>
                      </div>
                    </div>

                    <div className="admin-weather-forecast-foot">
                      <span className="admin-weather-forecast-period">
                        <small>Valid</small>
                        <strong>{formatForecastTimeRange(weather.twoHourForecast.validStart, weather.twoHourForecast.validEnd)}</strong>
                      </span>
                      <ForecastCountButton
                        count={weather.twoHourForecast.areaCount}
                        label={weather.twoHourForecast.areaCount === 1 ? 'area' : 'areas'}
                        onClick={() => setForecastTableCard('nowcast')}
                      />
                    </div>
                  </>
                )}
              </article>

              <article className={`admin-weather-nea-panel admin-weather-forecast-panel${forecastTableCard === 'twentyFour' ? ' is-table-view' : ''}`}>
                {forecastTableCard === 'twentyFour' ? (
                  <TwentyFourHourPeriodTableFace
                    periods={weather.twentyFourHourForecast.periods}
                    onBack={() => setForecastTableCard(null)}
                  />
                ) : (
                  <>
                    <div className="admin-weather-forecast-head">
                      <div className="admin-weather-forecast-copy">
                        <h2>24-hour weather forecast</h2>
                        <p className="admin-weather-forecast-condition">
                          {weather.twentyFourHourForecast.forecastText}
                        </p>
                        <p className="admin-weather-forecast-cache">
                          {SOURCE_TTL.twentyFourHourForecast}
                        </p>
                      </div>
                      <div className="admin-weather-forecast-side">
                        <span
                          className={`admin-weather-outlook-icon admin-weather-forecast-icon is-${twentyFourHourIconKind}`}
                          aria-hidden
                        >
                          <ForecastMarkerGlyph kind={twentyFourHourIconKind} size={42} />
                        </span>
                        <WeatherAdviceSection adviceItems={twentyFourHourAdvice} ariaLabel="24-hour weather recommendations" />
                      </div>
                    </div>

                    <div className="admin-weather-forecast-meta" aria-label="24-hour forecast metrics">
                      <div className="admin-weather-outlook-stat">
                        <b>Temp</b>
                        <span>
                          {formatForecastTemperatureRange(
                            weather.twentyFourHourForecast.tempLowC,
                            weather.twentyFourHourForecast.tempHighC,
                          )}
                        </span>
                      </div>
                      <div className="admin-weather-outlook-stat">
                        <b>Humidity</b>
                        <span>
                          {formatForecastHumidityRange(
                            weather.twentyFourHourForecast.humidityLowPct,
                            weather.twentyFourHourForecast.humidityHighPct,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="admin-weather-forecast-foot">
                      <span className="admin-weather-forecast-period">
                        <small>Valid</small>
                        <strong>
                          {formatForecastDateRange(
                            weather.twentyFourHourForecast.validStart,
                            weather.twentyFourHourForecast.validEnd,
                          )}
                        </strong>
                      </span>
                      <ForecastCountButton
                        count={weather.twentyFourHourForecast.periodCount}
                        label={weather.twentyFourHourForecast.periodCount === 1 ? 'period' : 'periods'}
                        onClick={() => setForecastTableCard('twentyFour')}
                      />
                    </div>
                  </>
                )}
              </article>
            </section>

            <FourDayOutlookPanel weather={weather} />

            <article className="admin-weather-nea-panel admin-weather-advisory-panel">
              <h2>Event Weather Context (Islandwide)</h2>
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
                    context={advisoryContextLine(signal, weather, hottestStation, wettestStation)}
                    kind={signal.kind}
                    level={signal.level}
                  />
                ))}
              </div>
              <p className="admin-weather-advisory-note">
                Flood uses official PUB alert events. Rain, thunder, heat, and UV are scored from data.gov.sg readings and forecasts. Backend cache: {cacheStateLabel(weather)} · refreshed {formatRelativeTime(weather.cachedAt)}.
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
                <div className="admin-weather-map-head">
                  <div className="admin-weather-map-tabs" role="tablist" aria-label="Map forecast layer">
                    <button
                      type="button"
                      role="tab"
                      className="admin-weather-map-tab"
                      aria-selected={mapForecastLayer === 'twoHour'}
                      onClick={() => setMapForecastLayer('twoHour')}
                    >
                      2-hour nowcast
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className="admin-weather-map-tab"
                      aria-selected={mapForecastLayer === 'twentyFourHour'}
                      disabled={!twentyFourHourMapReady}
                      onClick={() => setMapForecastLayer('twentyFourHour')}
                    >
                      24-hour forecast
                    </button>
                  </div>
                  <p className="admin-weather-map-layer-note">{mapLayerNote}</p>
                </div>
                <div className="admin-weather-map-legend">
                  <div className="admin-weather-map-layer-toggles" role="group" aria-label="Map layer visibility">
                    <button
                      type="button"
                      className={`admin-weather-map-layer-toggle${showMapForecast ? ' is-on' : ''}`}
                      aria-pressed={showMapForecast}
                      onClick={() => setShowMapForecast((value) => !value)}
                    >
                      <MapLegendForecastIcon kind="partly-cloudy" />
                      {mapForecastLayer === 'twoHour' ? 'Weather' : 'Weather regions'}
                    </button>
                    <button
                      type="button"
                      className={`admin-weather-map-layer-toggle${showMapTemperature ? ' is-on' : ''}`}
                      aria-pressed={showMapTemperature}
                      onClick={() => setShowMapTemperature((value) => !value)}
                    >
                      <i className="is-temp" aria-hidden />
                      Temperature
                    </button>
                  </div>
                  <div className="admin-weather-map-legend-keys" aria-label="Forecast icon legend">
                    <span><MapLegendForecastIcon kind="rain" /> Rain</span>
                    <span><MapLegendForecastIcon kind="thunder" /> Thunder</span>
                    <span><MapLegendForecastIcon kind="haze" /> Haze / wind</span>
                  </div>
                </div>
                <div className="admin-weather-map-frame">
                  {showMapForecast && mapForecastLayer === 'twentyFourHour' && mapForecastAreas.length === 0 ? (
                    <p className="admin-weather-map-layer-empty" role="status">
                      No regional markers available for the current 24-hour period.
                    </p>
                  ) : null}
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
                    {showMapForecast
                      ? mapForecastAreas.map((area) => (
                          <ForecastAreaMarker
                            key={`${mapForecastLayer}-${area.name}`}
                            area={area}
                            markerSize={mapForecastMarkerSize}
                          />
                        ))
                      : null}
                    {showMapTemperature
                      ? weather.temperature.stations.map((station) => (
                          <TemperatureMarker key={station.stationId} station={station} />
                        ))
                      : null}
                  </MapContainer>
                </div>
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

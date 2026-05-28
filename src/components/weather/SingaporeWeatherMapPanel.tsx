import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { divIcon, type DivIcon } from 'leaflet'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronDown } from 'lucide-react'
import {
  ForecastMarkerGlyph,
  forecastMarkerKind,
  type ForecastMarkerKind,
} from '../../lib/weather-forecast-icons'
import { getDiscoverMapCityCenter, getDiscoverMapCityDefaultZoom } from '../../lib/discover-map-defaults'
import {
  mapTwentyFourHourPeriodToAreas,
  pickActiveTwentyFourHourPeriod,
  type MapForecastLayer,
} from '../../lib/weather-map-map-layers'
import {
  type ForecastAreaWeather,
  type FloodAlertEvent,
  type SingaporeWeatherMapData,
  type WeatherMapCountryCode,
  type WeatherStationValue,
} from '../../lib/weather-map-data'
import '../../views/admin-weather-map/admin-weather-map.css'

const WEATHER_COUNTRY_DISCOVER_CITY_ID: Record<WeatherMapCountryCode, string> = {
  SG: 'singapore',
  MY: 'kuala-lumpur',
  ID: 'jakarta',
  TH: 'bangkok',
}

const MAP_FORECAST_LEGEND: Array<{ kind: ForecastMarkerKind; label: string }> = [
  { kind: 'fair', label: 'Fair' },
  { kind: 'fair-night', label: 'Fair (night)' },
  { kind: 'partly-cloudy', label: 'Partly cloudy' },
  { kind: 'partly-cloudy-night', label: 'Partly cloudy (night)' },
  { kind: 'cloudy', label: 'Cloudy' },
  { kind: 'drizzle', label: 'Drizzle / light' },
  { kind: 'rain', label: 'Rain / showers' },
  { kind: 'heavy-rain', label: 'Heavy rain' },
  { kind: 'thunder', label: 'Thunder' },
  { kind: 'heavy-thunder', label: 'Heavy thunder' },
  { kind: 'wind', label: 'Windy' },
  { kind: 'haze', label: 'Haze / mist' },
]

type TemperatureBucket = 'below-27' | '27-30' | '30-33' | '33-plus'

const TEMPERATURE_LEGEND: Array<{ id: TemperatureBucket; label: string; color: string }> = [
  { id: 'below-27', label: 'Below 27°C', color: '#22c55e' },
  { id: '27-30', label: '27–30°C', color: '#facc15' },
  { id: '30-33', label: '30–33°C', color: '#f97316' },
  { id: '33-plus', label: '33°C and above', color: '#ef4444' },
]

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

function formatForecastTimeRange(start: string, end: string): string {
  const formatTime = (value: string) => {
    if (!value) return 'Not available'
    return new Intl.DateTimeFormat('en-SG', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
    }).format(new Date(value))
  }
  const formattedStart = formatTime(start)
  const formattedEnd = formatTime(end)
  if (formattedStart === 'Not available' || formattedEnd === 'Not available') return 'Not available'
  return `${formattedStart} - ${formattedEnd}`
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

function temperatureBucket(value: number): TemperatureBucket {
  if (value >= 33) return '33-plus'
  if (value >= 30) return '30-33'
  if (value >= 27) return '27-30'
  return 'below-27'
}

function temperatureColor(value: number): string {
  const bucket = TEMPERATURE_LEGEND.find((item) => item.id === temperatureBucket(value))
  return bucket?.color ?? '#22c55e'
}

function activeTemperatureBuckets(stations: WeatherStationValue[]): Set<TemperatureBucket> {
  const buckets = new Set<TemperatureBucket>()
  for (const station of stations) {
    buckets.add(temperatureBucket(station.value))
  }
  return buckets
}

function plottableFloodAlerts(alerts: FloodAlertEvent[]): FloodAlertEvent[] {
  return alerts.filter((alert) => alert.lat != null && alert.lng != null)
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

function MapLegendCollapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section className={`admin-weather-map-legend-panel${open ? ' is-open' : ' is-collapsed'}`}>
      <button
        type="button"
        className="admin-weather-map-legend-header"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="admin-weather-map-legend-title">{title}</span>
        <ChevronDown className="admin-weather-map-legend-chevron" size={16} strokeWidth={2.4} aria-hidden />
      </button>
      <div id={bodyId} className="admin-weather-map-legend-body" aria-hidden={!open}>
        {children}
      </div>
    </section>
  )
}

function MapWeatherLegendPanel({ activeKinds }: { activeKinds: Set<ForecastMarkerKind> }) {
  return (
    <MapLegendCollapsible title="Weather legend">
      <div className="admin-weather-map-legend-keys is-weather" aria-label="Weather forecast icon legend">
        {MAP_FORECAST_LEGEND.map(({ kind, label }) => (
          <span key={kind} className={activeKinds.has(kind) ? 'is-on-map' : ''}>
            <MapLegendForecastIcon kind={kind} />
            {label}
          </span>
        ))}
      </div>
      <p className="admin-weather-map-legend-hint">
        {activeKinds.size === 0
          ? 'No forecast markers on the map for this layer.'
          : activeKinds.size === 1
            ? 'All visible forecast markers use the highlighted icon — conditions are uniform for this layer.'
            : `${activeKinds.size} icon types are on the map now (highlighted).`}
      </p>
    </MapLegendCollapsible>
  )
}

function MapTemperatureLegendPanel({ activeBuckets }: { activeBuckets: Set<TemperatureBucket> }) {
  const activeCount = activeBuckets.size

  return (
    <MapLegendCollapsible title="Temperature legend">
      <div className="admin-weather-map-temp-scale" aria-label="Temperature color scale">
        {TEMPERATURE_LEGEND.map((item) => (
          <span
            key={item.id}
            className={`admin-weather-map-temp-scale-item${activeBuckets.has(item.id) ? ' is-on-map' : ''}`}
          >
            <i className="admin-weather-map-temp-swatch" style={{ background: item.color }} aria-hidden />
            {item.label}
          </span>
        ))}
      </div>
      <p className="admin-weather-map-legend-hint">
        {activeCount === 0
          ? 'No temperature stations on the map.'
          : activeCount === 1
            ? 'All visible station dots use the highlighted range.'
            : `${activeCount} ranges appear on the map now (highlighted).`}
      </p>
    </MapLegendCollapsible>
  )
}

function MapFloodLegendPanel({ activeCount }: { activeCount: number }) {
  return (
    <MapLegendCollapsible title="Flood legend">
      <div className="admin-weather-map-legend-keys is-flood">
        <span className={activeCount > 0 ? 'is-on-map' : undefined}>
          <i className="is-flood" aria-hidden />
          Active PUB flood alert
        </span>
      </div>
      <p className="admin-weather-map-legend-hint">
        {activeCount === 0
          ? 'No active flood alerts on the map.'
          : `${activeCount} active ${activeCount === 1 ? 'alert' : 'alerts'} pinned from PUB.`}
      </p>
    </MapLegendCollapsible>
  )
}

function FloodAlertMarker({ alert }: { alert: FloodAlertEvent }) {
  if (alert.lat == null || alert.lng == null) return null

  const color = '#ef4444'

  return (
    <>
      {alert.radiusM != null && alert.radiusM > 0 ? (
        <Circle
          center={[alert.lat, alert.lng]}
          radius={alert.radiusM}
          pathOptions={{
            color,
            fillColor: color,
            fillOpacity: 0.14,
            opacity: 0.55,
            weight: 2,
          }}
        />
      ) : null}
      <CircleMarker
        center={[alert.lat, alert.lng]}
        radius={8}
        pathOptions={{
          color: '#fff',
          fillColor: color,
          fillOpacity: 0.95,
          opacity: 1,
          weight: 2,
        }}
      >
        <Tooltip direction="top" opacity={0.96}>
          <strong>{alert.label}</strong>
          {alert.detail ? (
            <>
              <br />
              {alert.detail}
            </>
          ) : null}
        </Tooltip>
        <Popup>
          <strong>{alert.label}</strong>
          {alert.detail ? (
            <>
              <br />
              {alert.detail}
            </>
          ) : null}
          {alert.radiusM != null && alert.radiusM > 0 ? (
            <>
              <br />
              Alert radius: {Math.round(alert.radiusM)} m
            </>
          ) : null}
        </Popup>
      </CircleMarker>
    </>
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

type SingaporeWeatherMapPanelProps = {
  weather: SingaporeWeatherMapData | null
  loading?: boolean
  error?: string | null
  country?: WeatherMapCountryCode
}

export function SingaporeWeatherMapPanel({
  weather,
  loading = false,
  error = null,
  country = 'SG',
}: SingaporeWeatherMapPanelProps) {
  const [mapForecastLayer, setMapForecastLayer] = useState<MapForecastLayer>('twoHour')
  const [showMapForecast, setShowMapForecast] = useState(true)
  const [showMapTemperature, setShowMapTemperature] = useState(true)
  const [showMapFlood, setShowMapFlood] = useState(true)

  const mapDefaults = useMemo(() => getWeatherCountryMapDefaults(country), [country])
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
  const mapActiveForecastKinds = useMemo(() => {
    const kinds = new Set<ForecastMarkerKind>()
    for (const area of mapForecastAreas) {
      kinds.add(forecastMarkerKind(area.forecast))
    }
    return kinds
  }, [mapForecastAreas])
  const mapActiveTemperatureBuckets = useMemo(
    () => (weather ? activeTemperatureBuckets(weather.temperature.stations) : new Set<TemperatureBucket>()),
    [weather],
  )
  const mapPlottableFloodAlerts = useMemo(
    () => (weather && weather.floodAlerts.status === 'ready' ? plottableFloodAlerts(weather.floodAlerts.alerts) : []),
    [weather],
  )

  return (
    <section className="admin-weather-map-card" aria-label="Singapore weather map">
      {error ? (
        <div className="admin-weather-state" role="alert">
          {error}
        </div>
      ) : null}
      {loading && !weather ? (
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
              <button
                type="button"
                className={`admin-weather-map-layer-toggle${showMapFlood ? ' is-on' : ''}`}
                aria-pressed={showMapFlood}
                onClick={() => setShowMapFlood((value) => !value)}
              >
                <i className="is-flood" aria-hidden />
                Flood alerts
              </button>
            </div>
            <div className="admin-weather-map-legend-panels">
              <MapWeatherLegendPanel activeKinds={showMapForecast ? mapActiveForecastKinds : new Set()} />
              <MapTemperatureLegendPanel activeBuckets={mapActiveTemperatureBuckets} />
              <MapFloodLegendPanel activeCount={showMapFlood ? mapPlottableFloodAlerts.length : 0} />
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
              {showMapFlood
                ? mapPlottableFloodAlerts.map((alert, index) => (
                    <FloodAlertMarker key={`${alert.label}-${alert.lat}-${alert.lng}-${index}`} alert={alert} />
                  ))
                : null}
            </MapContainer>
          </div>
        </>
      ) : null}
    </section>
  )
}

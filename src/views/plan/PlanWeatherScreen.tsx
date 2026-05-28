import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import {
  fetchCityWeatherSummary,
  type CityWeatherOutlookDay,
  type CityWeatherSummary,
} from '../../lib/event-weather-summary'
import { formatCacheRefreshRate, formatCacheTtl } from '../../lib/weather-cache-format'
import {
  readWeatherAutoRefreshPreference,
  writeWeatherAutoRefreshPreference,
} from '../../lib/weather-cache-preference'
import {
  formatForecastDateRange,
  formatForecastHumidityRange,
  formatForecastTemperatureRange,
  formatOutlookDate,
  formatOutlookHumidityRange,
  formatOutlookTemperatureRange,
} from '../../lib/weather-forecast-format'
import { ForecastMarkerGlyph, forecastMarkerKind } from '../../lib/weather-forecast-icons'
import {
  fetchSingaporeWeatherMapForCity,
  type SingaporeWeatherMapData,
} from '../../lib/weather-map-data'
import { SingaporeWeatherMapPanel } from '../../components/weather/SingaporeWeatherMapPanel'
import { PlanWeatherAlerts } from './PlanWeatherAlerts'

const MIN_REFRESH_SPIN_MS = 650

type PlanWeatherScreenProps = {
  onBack: () => void
}

function formatPercent(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}%`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function PlanWeatherCacheControls({
  summary,
  onForceRefresh,
  isRefreshing,
  autoRefresh,
  onAutoRefreshChange,
}: {
  summary: CityWeatherSummary | null
  onForceRefresh: () => void
  isRefreshing: boolean
  autoRefresh: boolean
  onAutoRefreshChange: (enabled: boolean) => void
}) {
  const cacheMeta = summary?.available
    ? {
        expiresAt: summary.cacheExpiresAt,
        cachedAt: summary.cachedAt,
      }
    : null

  return (
    <div
      className="plan-weather-cache"
      aria-label={
        cacheMeta
          ? `Backend cache ${formatCacheTtl(cacheMeta.expiresAt)} · ${formatCacheRefreshRate(cacheMeta.cachedAt, cacheMeta.expiresAt)}`
          : 'Weather cache controls'
      }
      title={cacheMeta ? formatCacheRefreshRate(cacheMeta.cachedAt, cacheMeta.expiresAt) : undefined}
    >
      {cacheMeta ? (
        <div className="plan-weather-cache-meta">
          <small>Cache</small>
          <strong>{formatCacheTtl(cacheMeta.expiresAt)}</strong>
        </div>
      ) : null}
      <label
        className="plan-weather-cache-auto-refresh"
        title="When enabled, refetch weather after the backend cache expires"
      >
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(event) => onAutoRefreshChange(event.target.checked)}
          disabled={isRefreshing}
        />
        <span>Auto-refresh</span>
      </label>
      <button
        type="button"
        className={`plan-weather-cache-refresh${isRefreshing ? ' is-refreshing' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          if (isRefreshing) return
          onForceRefresh()
        }}
        aria-busy={isRefreshing}
        aria-disabled={isRefreshing}
        aria-label={isRefreshing ? 'Refreshing weather cache' : 'Force backend re-cache'}
        title={isRefreshing ? 'Refreshing weather cache' : 'Force backend re-cache'}
      >
        <RefreshCw
          size={12}
          strokeWidth={2.4}
          aria-hidden
          className={isRefreshing ? 'favorites-refresh-icon is-spinning' : 'favorites-refresh-icon'}
        />
        <span>{isRefreshing ? 'Refreshing' : 'Re-cache'}</span>
      </button>
    </div>
  )
}

function PlanWeatherOutlookDayCard({ day }: { day: CityWeatherOutlookDay }) {
  const iconKind = forecastMarkerKind(day.forecastText)

  return (
    <article className="plan-weather-outlook-day">
      <div className="plan-weather-outlook-day-head">
        <p className="plan-weather-outlook-day-name">{day.day}</p>
        {day.timestamp ? (
          <span className="plan-weather-outlook-day-date">{formatOutlookDate(day.timestamp)}</span>
        ) : null}
        <span className={`plan-weather-forecast-icon is-${iconKind}`} aria-hidden>
          <ForecastMarkerGlyph kind={iconKind} size={36} />
        </span>
      </div>
      <strong className="plan-weather-outlook-condition">{day.forecastText}</strong>
      <p className="plan-weather-card-advice">
        Recommendation: <strong>{day.adviceLabel}</strong>
      </p>
      <dl className="plan-weather-outlook-meta">
        <div>
          <dt>Temp</dt>
          <dd>{formatOutlookTemperatureRange(day)}</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{formatOutlookHumidityRange(day)}</dd>
        </div>
      </dl>
    </article>
  )
}

export function PlanWeatherScreen({ onBack }: PlanWeatherScreenProps) {
  const [summary, setSummary] = useState<CityWeatherSummary | null>(null)
  const [mapWeather, setMapWeather] = useState<SingaporeWeatherMapData | null>(null)
  const [mapLoading, setMapLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(readWeatherAutoRefreshPreference)
  const summaryRef = useRef<CityWeatherSummary | null>(null)
  const mapWeatherRef = useRef<SingaporeWeatherMapData | null>(null)
  const requestIdRef = useRef(0)
  const mapRequestIdRef = useRef(0)
  summaryRef.current = summary
  mapWeatherRef.current = mapWeather

  const loadMapWeather = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    const requestId = ++mapRequestIdRef.current
    const isSubsequentLoad = forceRefresh || mapWeatherRef.current !== null
    if (!isSubsequentLoad) setMapLoading(true)
    setMapError(null)

    try {
      const next = await fetchSingaporeWeatherMapForCity('singapore', { forceRefresh, signal })
      if (signal?.aborted || requestId !== mapRequestIdRef.current) return
      setMapWeather(next)
    } catch (error) {
      if (signal?.aborted || requestId !== mapRequestIdRef.current) return
      setMapWeather(null)
      setMapError(error instanceof Error ? error.message : 'Weather map could not load')
    } finally {
      if (signal?.aborted || requestId !== mapRequestIdRef.current) return
      setMapLoading(false)
    }
  }, [])

  const loadWeather = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    const requestId = ++requestIdRef.current
    const isSubsequentLoad = forceRefresh || summaryRef.current !== null
    const startedAt = Date.now()

    if (isSubsequentLoad) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const next = await fetchCityWeatherSummary('singapore', { forceRefresh, signal })
      if (signal?.aborted || requestId !== requestIdRef.current) return
      setSummary(next)
    } catch {
      if (signal?.aborted || requestId !== requestIdRef.current) return
      setSummary({ available: false, message: 'No data available' })
    } finally {
      if (signal?.aborted || requestId !== requestIdRef.current) return

      if (isSubsequentLoad) {
        const elapsed = Date.now() - startedAt
        if (elapsed < MIN_REFRESH_SPIN_MS) {
          await wait(MIN_REFRESH_SPIN_MS - elapsed)
        }
        if (requestId !== requestIdRef.current) return
        setRefreshing(false)
        return
      }

      setLoading(false)
    }
  }, [])

  const handleAutoRefreshChange = useCallback((enabled: boolean) => {
    setAutoRefresh(enabled)
    writeWeatherAutoRefreshPreference(enabled)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadWeather(false, controller.signal)
    void loadMapWeather(false, controller.signal)
    return () => controller.abort()
  }, [loadMapWeather, loadWeather])

  useEffect(() => {
    if (!autoRefresh) return
    const timers: number[] = []

    if (summary?.available && summary.cacheExpiresAt) {
      const expiresAt = new Date(summary.cacheExpiresAt).getTime()
      if (!Number.isNaN(expiresAt)) {
        timers.push(window.setTimeout(() => {
          void loadWeather(false)
        }, Math.max(0, expiresAt - Date.now())))
      }
    }

    if (mapWeather?.cacheExpiresAt) {
      const expiresAt = new Date(mapWeather.cacheExpiresAt).getTime()
      if (!Number.isNaN(expiresAt)) {
        timers.push(window.setTimeout(() => {
          void loadMapWeather(false)
        }, Math.max(0, expiresAt - Date.now())))
      }
    }

    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [autoRefresh, loadMapWeather, loadWeather, mapWeather?.cacheExpiresAt, summary])

  const nowcastIconKind = useMemo(
    () => (summary?.available ? forecastMarkerKind(summary.condition) : 'cloudy'),
    [summary],
  )

  const twentyFourHourIconKind = useMemo(
    () => (
      summary?.available && summary.twentyFourHourCondition
        ? forecastMarkerKind(summary.twentyFourHourCondition)
        : 'cloudy'
    ),
    [summary],
  )

  return (
    <div className="plan-subscreen">
      <header className="plan-subscreen-header">
        <button
          type="button"
          className="plan-toolbar-btn plan-toolbar-back"
          aria-label="Back to plan"
          onClick={onBack}
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <div className="plan-subscreen-heading">
          <h1 className="plan-home-title">Weather</h1>
          <p className="plan-home-sub">Singapore islandwide briefing from data.gov.sg.</p>
        </div>
      </header>

      {summary || !loading ? (
        <PlanWeatherCacheControls
          summary={summary}
          onForceRefresh={() => {
            void loadWeather(true)
            void loadMapWeather(true)
          }}
          isRefreshing={refreshing || mapLoading}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={handleAutoRefreshChange}
        />
      ) : null}

      {loading && !summary ? (
        <div className="favorites-empty">
          <p className="favorites-empty-title">Loading weather</p>
          <p className="favorites-empty-copy">Fetching the latest cached nowcast.</p>
        </div>
      ) : summary?.available ? (
        <div className="plan-weather-grid">
          <article className="plan-weather-card plan-weather-card--nowcast">
            <div className="plan-weather-card-head">
              <div className="plan-weather-card-copy">
                <p className="plan-weather-card-kicker">2-hour nowcast</p>
                <h2 className="plan-weather-card-title">{summary.condition}</h2>
                <p className="plan-weather-card-detail">{summary.detail}</p>
              </div>
              <span className={`plan-weather-forecast-icon is-${nowcastIconKind}`} aria-hidden>
                <ForecastMarkerGlyph kind={nowcastIconKind} size={42} />
              </span>
            </div>
            <dl className="plan-weather-card-stats">
              <div>
                <dt>Temp</dt>
                <dd>{formatForecastTemperatureRange(summary.temperatureMinC, summary.temperatureMaxC)}</dd>
              </div>
              <div>
                <dt>Humidity</dt>
                <dd>{formatPercent(summary.humidityPct)}</dd>
              </div>
              <div>
                <dt>Valid</dt>
                <dd>{summary.validText}</dd>
              </div>
            </dl>
            <p className="plan-weather-card-advice">
              Recommendation: <strong>{summary.adviceLabel}</strong>
            </p>
          </article>

          <article className="plan-weather-card plan-weather-card--twenty-four">
            <div className="plan-weather-card-head">
              <div className="plan-weather-card-copy">
                <p className="plan-weather-card-kicker">24-hour forecast</p>
                <h2 className="plan-weather-card-title">
                  {summary.twentyFourHourCondition ?? 'No data available'}
                </h2>
                {summary.twentyFourHourValidText ? (
                  <p className="plan-weather-card-detail">{summary.twentyFourHourValidText}</p>
                ) : null}
              </div>
              <span className={`plan-weather-forecast-icon is-${twentyFourHourIconKind}`} aria-hidden>
                <ForecastMarkerGlyph kind={twentyFourHourIconKind} size={42} />
              </span>
            </div>
            {summary.twentyFourHourCondition ? (
              <>
                <dl className="plan-weather-card-stats plan-weather-card-stats--two">
                  <div>
                    <dt>Temp</dt>
                    <dd>
                      {formatForecastTemperatureRange(
                        summary.twentyFourHourTempLowC,
                        summary.twentyFourHourTempHighC,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Humidity</dt>
                    <dd>
                      {formatForecastHumidityRange(
                        summary.twentyFourHourHumidityLowPct,
                        summary.twentyFourHourHumidityHighPct,
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="plan-weather-card-valid">
                  <small>Valid</small>
                  <strong>
                    {summary.twentyFourHourValidStart && summary.twentyFourHourValidEnd
                      ? formatForecastDateRange(
                          summary.twentyFourHourValidStart,
                          summary.twentyFourHourValidEnd,
                        )
                      : summary.twentyFourHourValidText ?? 'N/A'}
                  </strong>
                </p>
                {summary.twentyFourHourAdviceLabel ? (
                  <p className="plan-weather-card-advice">
                    Recommendation: <strong>{summary.twentyFourHourAdviceLabel}</strong>
                  </p>
                ) : null}
              </>
            ) : null}
          </article>

          {summary.fourDayOutlook.status === 'ready' && summary.fourDayOutlook.days.length > 0 ? (
            <section className="plan-weather-outlook" aria-label="4-day outlook">
              <div className="plan-weather-outlook-head">
                <div>
                  <p className="plan-weather-card-kicker">4-day outlook</p>
                  <h2 className="plan-weather-outlook-title">Next few days</h2>
                  <p className="plan-weather-card-detail">Islandwide forecast</p>
                </div>
                <span className="plan-weather-outlook-count">
                  {summary.fourDayOutlook.dayCount} days
                </span>
              </div>
              <div className="plan-weather-outlook-grid">
                {summary.fourDayOutlook.days.map((day) => (
                  <PlanWeatherOutlookDayCard day={day} key={day.timestamp || day.day} />
                ))}
              </div>
            </section>
          ) : null}

          {(summary.alerts?.length ?? 0) > 0 ? (
            <PlanWeatherAlerts alerts={summary.alerts ?? []} />
          ) : null}

          <SingaporeWeatherMapPanel
            weather={mapWeather}
            loading={mapLoading && !mapWeather}
            error={mapError}
          />
        </div>
      ) : (
        <div className="favorites-empty">
          <p className="favorites-empty-title">No data available</p>
          <p className="favorites-empty-copy">Weather is only available for Singapore right now.</p>
        </div>
      )}

      <p className="plan-weather-credit">Weather data: data.gov.sg</p>
    </div>
  )
}

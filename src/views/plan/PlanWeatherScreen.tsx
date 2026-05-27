import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import {
  fetchCityWeatherSummary,
  type CityWeatherSummary,
} from '../../lib/event-weather-summary'
import {
  formatForecastDateRange,
  formatForecastHumidityRange,
  formatForecastTemperatureRange,
} from '../../lib/weather-forecast-format'
import { ForecastMarkerGlyph, forecastMarkerKind } from '../../lib/weather-forecast-icons'

type PlanWeatherScreenProps = {
  onBack: () => void
}

function formatPercent(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}%`
}

function formatPeriodCount(count: number | null): string {
  if (count == null) return 'N/A'
  return `${count} ${count === 1 ? 'period' : 'periods'}`
}

export function PlanWeatherScreen({ onBack }: PlanWeatherScreenProps) {
  const [summary, setSummary] = useState<CityWeatherSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetchCityWeatherSummary('singapore', controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setSummary(next)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setSummary({ available: false, message: 'No data available' })
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setLoading(false)
      })

    return () => controller.abort()
  }, [])

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

      {loading ? (
        <div className="favorites-empty">
          <p className="favorites-empty-title">Loading weather</p>
          <p className="favorites-empty-copy">Fetching the latest cached NEA nowcast.</p>
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
                <dl className="plan-weather-card-stats">
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
                  <div>
                    <dt>Periods</dt>
                    <dd>{formatPeriodCount(summary.twentyFourHourPeriodCount)}</dd>
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
        </div>
      ) : (
        <div className="favorites-empty">
          <p className="favorites-empty-title">No data available</p>
          <p className="favorites-empty-copy">Weather is only available for Singapore right now.</p>
        </div>
      )}

      <p className="plan-weather-credit">Weather data: data.gov.sg / NEA</p>
    </div>
  )
}

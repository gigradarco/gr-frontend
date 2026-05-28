import type { CityWeatherAlert } from '../../lib/event-weather-summary'
import { WeatherAdvisoryIcon } from '../../lib/weather-advisory-glyphs'

const ALERT_SCALE = [
  { level: 1, label: 'Excellent', tone: 'level-1' },
  { level: 2, label: 'Good', tone: 'level-2' },
  { level: 3, label: 'Watch', tone: 'level-3' },
  { level: 4, label: 'Poor', tone: 'level-4' },
  { level: 5, label: 'Bad', tone: 'level-5' },
] as const

const PLAN_ALERT_GLYPH_SIZE = 22
const PLAN_ALERT_GLYPH_STROKE = 2.2

function PlanWeatherAlertCard({ alert }: { alert: CityWeatherAlert }) {
  return (
    <article className={`plan-weather-alert is-${alert.category} is-level-${alert.level}`}>
      <div className="plan-weather-alert-head">
        <span className="plan-weather-alert-icon" aria-hidden>
          <WeatherAdvisoryIcon
            category={alert.category}
            size={PLAN_ALERT_GLYPH_SIZE}
            strokeWidth={PLAN_ALERT_GLYPH_STROKE}
          />
        </span>
        <div className="plan-weather-alert-copy">
          <strong>{alert.title}</strong>
          <span>{alert.level}/5 {alert.levelLabel}</span>
        </div>
        <div className="plan-weather-alert-metric">
          <small>{alert.metricLabel}</small>
          <strong>{alert.metricPrimary}</strong>
          {alert.metricSecondary ? <small>{alert.metricSecondary}</small> : null}
        </div>
      </div>

      <div className="plan-weather-alert-score" aria-hidden>
        {ALERT_SCALE.map((item) => (
          <span
            key={item.level}
            className={`plan-weather-alert-score-segment is-${item.tone}${item.level <= alert.level ? ' is-filled' : ''}`}
          />
        ))}
      </div>

      <p className="plan-weather-alert-message">{alert.message}</p>

      <span className={`plan-weather-alert-badge${alert.kind === 'official' ? ' is-official' : ''}`}>
        {alert.sourceBadge}
      </span>
    </article>
  )
}

type PlanWeatherAlertsProps = {
  alerts: CityWeatherAlert[]
}

export function PlanWeatherAlerts({ alerts }: PlanWeatherAlertsProps) {
  if (alerts.length === 0) return null

  return (
    <section className="plan-weather-alerts" aria-label="Event weather alerts">
      <div className="plan-weather-alerts-head">
        <div>
          <p className="plan-weather-card-kicker">Event weather alerts</p>
          <h2 className="plan-weather-outlook-title">Islandwide</h2>
        </div>
        <div className="plan-weather-alert-scale" aria-label="Alert severity scale">
          {ALERT_SCALE.map((item) => (
            <span key={item.level} className={`plan-weather-alert-scale-item is-${item.tone}`}>
              {item.level} {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="plan-weather-alerts-list">
        {alerts.map((alert) => (
          <PlanWeatherAlertCard alert={alert} key={alert.category} />
        ))}
      </div>
    </section>
  )
}

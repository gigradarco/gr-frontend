import { CalendarDays, CloudSun } from 'lucide-react'

type PlanHubProps = {
  weatherPreview: string
  weatherLoading: boolean
  upcomingCount: number
  pastCount: number
  onOpenWeather: () => void
  onOpenScheduled: () => void
}

export function PlanHub({
  weatherPreview,
  weatherLoading,
  upcomingCount,
  pastCount,
  onOpenWeather,
  onOpenScheduled,
}: PlanHubProps) {
  return (
    <div className="plan-hub">
      <div className="plan-hub-grid" aria-label="Plan shortcuts">
        <button
          type="button"
          className="plan-hub-card plan-hub-card--weather"
          onClick={onOpenWeather}
          aria-label="Open weather"
        >
          <span className="plan-hub-card-shine" aria-hidden />
          <span className="plan-hub-card-icon" aria-hidden>
            <CloudSun size={20} strokeWidth={2.25} />
          </span>
          <span className="plan-hub-card-kicker">Weather</span>
          <strong className="plan-hub-card-title">
            {weatherLoading ? 'Loading…' : weatherPreview}
          </strong>
          <small className="plan-hub-card-meta">2-hour nowcast · Singapore</small>
        </button>

        <button
          type="button"
          className="plan-hub-card plan-hub-card--scheduled"
          onClick={onOpenScheduled}
          aria-label="Open scheduled events"
        >
          <span className="plan-hub-card-shine" aria-hidden />
          <span className="plan-hub-card-icon" aria-hidden>
            <CalendarDays size={20} strokeWidth={2.25} />
          </span>
          <span className="plan-hub-card-kicker">Scheduled</span>
          <strong className="plan-hub-card-title">{upcomingCount}</strong>
          <small className="plan-hub-card-meta">
            Upcoming · {pastCount} past
          </small>
        </button>
      </div>
    </div>
  )
}

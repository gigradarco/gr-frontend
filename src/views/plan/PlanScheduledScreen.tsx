import type { ReactNode } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'

type PlanScheduledScreenProps = {
  refreshedAt: number | null
  refreshing: boolean
  refreshError: string | null
  onBack: () => void
  onRefresh: () => void
  segmentControls: ReactNode
  listContent: ReactNode
}

export function PlanScheduledScreen({
  refreshedAt,
  refreshing,
  refreshError,
  onBack,
  onRefresh,
  segmentControls,
  listContent,
}: PlanScheduledScreenProps) {
  return (
    <div className="plan-subscreen">
      <header className="plan-home-header plan-home-header--scheduled">
        <div className="plan-subscreen-header plan-subscreen-header--scheduled">
          <button
            type="button"
            className="plan-toolbar-btn plan-toolbar-back"
            aria-label="Back to plan"
            onClick={onBack}
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <div className="plan-subscreen-heading">
            <h1 className="plan-home-title">Scheduled</h1>
            <p className="plan-home-sub">Upcoming nights and where you&apos;ve been.</p>
          </div>
          <button
            type="button"
            className="favorites-refresh plan-scheduled-refresh-top"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'favorites-refresh-icon is-spinning' : 'favorites-refresh-icon'} aria-hidden />
            <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
          </button>
        </div>
        <div className="plan-home-header-row">
          <div className="plan-home-header-actions">
            {refreshedAt ? (
              <span
                className="favorites-limit-bubble"
                aria-label={`Plan last updated at ${new Date(refreshedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}`}
              >
                Last updated {new Date(refreshedAt).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </div>
        </div>
        {refreshError ? <p className="favorites-refresh-error" role="alert">{refreshError}</p> : null}
      </header>

      {segmentControls}
      {listContent}
    </div>
  )
}

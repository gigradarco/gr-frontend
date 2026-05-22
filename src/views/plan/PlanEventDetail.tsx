import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Play,
  Share2,
  Ticket,
} from 'lucide-react'
import type { PlanPageEvent } from '../../types'

type PlanEventDetailProps = {
  data: PlanPageEvent
  variant: 'upcoming' | 'past'
  backAriaLabel?: string
  onBack: () => void
  onOpenEvent: (eventId: string) => void
  isFavorited: boolean
  onToggleFavorite: () => void
  /** Past events only: opens post-event review flow. */
  onOpenReview?: () => void
}

const waveformHeights = [
  14, 32, 22, 40, 18, 36, 26, 44, 20, 38, 16, 42, 24, 34, 30, 48, 12, 28, 36, 22, 40, 18,
]

const googleMapsEmbedKey = import.meta.env.GOOGLE_MAPS_EMBED_KEY?.trim() ?? ''

function mapsQueryFromData(data: PlanPageEvent): string {
  return data.mapQuery?.trim() || data.venueLine.trim()
}

function googleMapsEmbedSrc(query: string): string | null {
  if (!googleMapsEmbedKey || !query) return null
  const params = new URLSearchParams({
    key: googleMapsEmbedKey,
    q: query,
  })
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`
}

function googleMapsSearchUrl(query: string): string {
  const params = new URLSearchParams({
    api: '1',
    query,
  })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export function PlanEventDetail({
  data,
  variant,
  backAriaLabel = 'Back to plan list',
  onBack,
  onOpenEvent,
  isFavorited,
  onToggleFavorite,
  onOpenReview,
}: PlanEventDetailProps) {
  const [playing, setPlaying] = useState(false)
  const [vibeAnimated, setVibeAnimated] = useState(false)
  const vibeRef = useRef<HTMLDivElement>(null)
  const hasVibeScore = typeof data.aiVibeScore === 'number' && Number.isFinite(data.aiVibeScore)
  const hasAudioPreview = Boolean(data.audioPreviewLabel)
  const mapQuery = mapsQueryFromData(data)
  const mapEmbedSrc = googleMapsEmbedSrc(mapQuery)
  const mapSearchUrl = googleMapsSearchUrl(mapQuery)

  useEffect(() => {
    const el = vibeRef.current
    if (!el || !hasVibeScore) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVibeAnimated(true); obs.disconnect() } },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasVibeScore])

  const radius = 36
  const circumference = 2 * Math.PI * radius
  const scoreFraction = hasVibeScore ? data.aiVibeScore! / 10 : 0
  const dashOffset = circumference * (1 - (vibeAnimated ? scoreFraction : 0))

  return (
    <div className="screen-content plan-page plan-event-detail">
      <header className="plan-toolbar">
        <button
          type="button"
          className="plan-toolbar-btn"
          aria-label={backAriaLabel}
          onClick={onBack}
        >
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        <p
          className={`plan-toolbar-status plan-toolbar-status--${variant}`}
          role="status"
        >
          {variant === 'upcoming' ? 'Upcoming' : 'Past'}
        </p>
        <button
          type="button"
          className="plan-toolbar-btn"
          aria-label={isFavorited ? 'Remove favorite' : 'Save event'}
          aria-pressed={isFavorited}
          onClick={onToggleFavorite}
        >
          <Heart
            size={20}
            strokeWidth={2}
            className={isFavorited ? 'plan-heart--on' : undefined}
            fill={isFavorited ? 'currentColor' : 'none'}
          />
        </button>
      </header>

      <div className="plan-main">
        <div className="plan-hero">
          <img
            className="plan-hero-img"
            src={data.heroImage}
            alt=""
            decoding="async"
          />
          <div className="plan-hero-scrim" aria-hidden />
          <div className="plan-hero-content">
            <div className="plan-hero-tags">
              <span className="plan-hero-tag">{data.genreTags[0]}</span>
              <span className="plan-hero-tag">{data.genreTags[1]}</span>
            </div>
            <h1 className="plan-hero-title">{data.displayTitle}</h1>
            <p className="plan-hero-artist">{data.artistLine}</p>
          </div>
        </div>

        <div className="plan-body">

          {/* Quick-info strip + vibe arc */}
          <div className="plan-info-strip" ref={vibeRef}>
            <div className="plan-info-pills">
              <div className="plan-info-pill plan-info-pill--location">
                <MapPin size={13} strokeWidth={2.2} aria-hidden />
                <span className="plan-info-pill-text">{data.venueLine}</span>
              </div>
              <div className="plan-info-pill plan-info-pill--time">
                <Clock size={13} strokeWidth={2.2} aria-hidden />
                <span className="plan-info-pill-text">{data.timeRange}</span>
              </div>
              {data.ticketPrice ? (
                <div className="plan-info-pill plan-info-pill--price">
                  <Ticket size={13} strokeWidth={2.2} aria-hidden />
                  <span className="plan-info-pill-text">{data.ticketPrice}</span>
                </div>
              ) : null}
            </div>
            {hasVibeScore ? (
              <div className="plan-vibe-arc" aria-label={`AI Vibe Score ${data.aiVibeScore!.toFixed(1)} out of 10`}>
                <svg viewBox="0 0 96 96" width="72" height="72">
                  <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--stroke)" strokeWidth="7" strokeLinecap="round" />
                  <circle
                    cx="48" cy="48" r={radius}
                    fill="none"
                    stroke="url(#vibeGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: vibeAnimated ? 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.2,0.64,1)' : 'none' }}
                    transform="rotate(-90 48 48)"
                  />
                  <defs>
                    <linearGradient id="vibeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--primary-soft)" />
                      <stop offset="100%" stopColor="var(--primary)" />
                    </linearGradient>
                  </defs>
                  <text x="48" y="46" textAnchor="middle" className="plan-arc-score">{data.aiVibeScore!.toFixed(1)}</text>
                  <text x="48" y="59" textAnchor="middle" className="plan-arc-label">VIBE</text>
                </svg>
              </div>
            ) : null}
          </div>

          {/* Experience quote */}
          <section className="plan-experience-block">
            <h2 className="plan-section-kicker">The Experience</h2>
            <blockquote className="plan-experience-quote">
              <span className="plan-experience-bar" aria-hidden />
              <p className="plan-copy">
                {data.experienceParts.before}
                {data.experienceParts.emphasis ? (
                  <em className="plan-copy-accent">{data.experienceParts.emphasis}</em>
                ) : null}
                {data.experienceParts.after}
              </p>
            </blockquote>
          </section>

          {mapQuery ? (
            <section className="plan-location-block">
              <div className="plan-section-head">
                <h2 className="plan-section-kicker">Location</h2>
                <a
                  className="plan-location-open"
                  href={mapSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink size={14} strokeWidth={2.2} aria-hidden />
                </a>
              </div>
              <div className="plan-location-card">
                {mapEmbedSrc ? (
                  <iframe
                    className="plan-location-map"
                    title={`Map for ${data.displayTitle}`}
                    src={mapEmbedSrc}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                ) : (
                  <a
                    className="plan-location-fallback"
                    href={mapSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={18} strokeWidth={2.2} aria-hidden />
                    <span>Open this location in Google Maps</span>
                    <ExternalLink size={14} strokeWidth={2.2} aria-hidden />
                  </a>
                )}
              </div>
            </section>
          ) : null}

          {hasAudioPreview ? (
            <div className="plan-audio">
              <button
                type="button"
                className="plan-audio-play"
                aria-pressed={playing}
                aria-label={playing ? 'Pause preview' : 'Play preview'}
                onClick={() => setPlaying((p) => !p)}
                disabled={variant === 'past'}
              >
                <Play size={22} fill="currentColor" aria-hidden />
              </button>
              <div className="plan-audio-mid">
                <div className="plan-wave" aria-hidden>
                  {waveformHeights.map((h, i) => (
                    <span
                      key={i}
                      className={`plan-wave-bar${playing && i < 9 ? ' plan-wave-bar--hot' : ''}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="plan-audio-labels">
                  <span className="plan-audio-track">{data.audioPreviewLabel}</span>
                  <span className="plan-audio-time">
                    {data.audioCurrent ?? '0:00'} / {data.audioTotal ?? '0:00'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

        </div>
      </div>

      <div className="plan-cta-rail">
        {variant === 'upcoming' ? (
          <button
            type="button"
            className="plan-cta-primary"
            onClick={() => onOpenEvent(data.eventId)}
          >
            I&apos;M GOING
          </button>
        ) : (
          <button type="button" className="plan-cta-primary plan-cta-primary--disabled" disabled>
            EVENT ENDED
          </button>
        )}
        <button
          type="button"
          className="plan-cta-review"
          disabled={variant === 'upcoming'}
          aria-label={
            variant === 'upcoming'
              ? 'Event review unlocks after the event'
              : 'Write an event review'
          }
          onClick={() => onOpenReview?.()}
        >
          EVENT REVIEW
        </button>
        <button type="button" className="plan-cta-secondary">
          <Share2 size={18} strokeWidth={2} aria-hidden />
          SHARE WITH FRIENDS
        </button>
      </div>
    </div>
  )
}

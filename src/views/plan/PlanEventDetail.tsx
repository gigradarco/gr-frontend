import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Share2,
  Ticket,
} from 'lucide-react'
import { fireGoingCelebration } from '../../components/GoingCelebrationBurst'
import { fallbackImageForEvent, handleEventImageError } from '../../lib/event-image-fallback'
import { fetchDiscoverEventById } from '../../lib/useDiscoverEvents'
import type { EventItem } from '../../types'
import { EventShareSheet } from '../../components/EventShareSheet'
import type { PlanPageEvent } from '../../types'
import { PlanCancelConfirmDialog } from './PlanCancelConfirmDialog'

type PlanEventDetailProps = {
  data: PlanPageEvent
  variant: 'upcoming' | 'past'
  backAriaLabel?: string
  onBack: () => void
  onOpenEvent: (eventId: string) => void
  isFavorited: boolean
  onToggleFavorite: () => void
  isPlanned?: boolean
  onTogglePlan?: () => void
  /** Past events only: opens post-event review flow. */
  onOpenReview?: () => void
}

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

function heroEventItem(data: PlanPageEvent): EventItem {
  return {
    id: data.eventId,
    title: data.displayTitle,
    venue: data.venueLine,
    district: '',
    time: data.timeRange,
    displayDateTimeLabel: data.timeRange,
    genre: data.genreTags[0] ?? 'EVENT',
    exploreCategoryId: 'live-music',
    locationCityId: 'singapore',
    verified: 0,
    image: data.heroImage,
    host: data.artistLine,
    hostPrompt: [
      data.experienceParts.before,
      data.experienceParts.emphasis,
      data.experienceParts.after,
    ].join(''),
    friendsGoing: 0,
    vibeTags: [...data.genreTags],
    ticketPrice: data.ticketPrice ?? '',
  }
}

function compactTicketPriceLabel(ticketPrice: string): string {
  const text = ticketPrice.trim()
  if (!text) return text

  const currency = text.match(/\b(SGD|USD|MYR)\b/i)?.[1].toUpperCase()
  const symbol = currency === 'SGD' ? 'S$' : currency === 'USD' ? 'US$' : currency === 'MYR' ? 'RM' : ''
  if (!symbol) return text

  const amounts = [...text.matchAll(/\d+(?:\.\d+)?/g)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value))

  if (amounts.length === 0) return text

  const formatAmount = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')

  if (amounts.length >= 2) {
    return `${symbol}${formatAmount(amounts[0])} - ${symbol}${formatAmount(amounts[1])}`
  }

  return `${symbol}${formatAmount(amounts[0])}`
}

export function PlanEventDetail({
  data,
  variant,
  backAriaLabel = 'Back to plan list',
  onBack,
  onOpenEvent,
  isFavorited,
  onToggleFavorite,
  isPlanned = false,
  onTogglePlan,
  onOpenReview,
}: PlanEventDetailProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const heroEvent = heroEventItem(data)
  const heroImageSrc = data.heroImage.trim() || fallbackImageForEvent(heroEvent)

  useEffect(() => {
    if (!cancelConfirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCancelConfirmOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancelConfirmOpen])
  const mapQuery = mapsQueryFromData(data)
  const mapEmbedSrc = googleMapsEmbedSrc(mapQuery)
  const mapSearchUrl = googleMapsSearchUrl(mapQuery)

  const openEventSourceInNewTab = async () => {
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer')
    const openTarget = (target: string) => {
      if (popup) popup.location.replace(target)
      else window.open(target, '_blank', 'noopener,noreferrer')
    }

    const directUrl = data.sourceUrl?.trim()
    if (directUrl) {
      openTarget(directUrl)
      return
    }

    try {
      const detail = await fetchDiscoverEventById(data.eventId)
      const resolvedUrl = detail.sourceUrl?.trim()
      if (resolvedUrl) {
        openTarget(resolvedUrl)
        return
      }
    } catch {
      // Fall back below.
    }

    if (popup) popup.close()
    onOpenEvent(data.eventId)
  }

  return (
    <div className="screen-content plan-page plan-event-detail">
      <header className="plan-toolbar">
        <button
          type="button"
          className="plan-toolbar-btn plan-toolbar-back"
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
        <div className="plan-toolbar-actions" aria-label="Event actions">
          <button
            type="button"
            className="plan-toolbar-btn"
            aria-label="Share event"
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={19} strokeWidth={2} />
          </button>
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
        </div>
      </header>

      <div className="plan-main">
        <div className="plan-hero">
          <img
            className="plan-hero-img"
            src={heroImageSrc}
            alt=""
            decoding="async"
            onError={(e) => handleEventImageError(heroEvent, e)}
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

          <div className="plan-info-strip">
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
                  <span className="plan-info-pill-text" title={data.ticketPrice}>
                    {compactTicketPriceLabel(data.ticketPrice)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="plan-cta-rail plan-cta-rail--inline">
            {variant === 'upcoming' ? (
              isPlanned ? (
                <button
                  type="button"
                  className="plan-cta-primary plan-cta-primary--cancel"
                  onClick={() => setCancelConfirmOpen(true)}
                  aria-label="Cancel plan for this event"
                >
                  CANCEL PLAN
                </button>
              ) : (
                <button
                  type="button"
                  className="plan-cta-primary"
                  onClick={(e) => {
                    fireGoingCelebration(e.currentTarget)
                    onTogglePlan?.()
                  }}
                  aria-label="Mark yourself as going to this event"
                >
                  I&apos;M GOING
                </button>
              )
            ) : (
              <button type="button" className="plan-cta-primary plan-cta-primary--disabled" disabled>
                EVENT ENDED
              </button>
            )}
            <button
              type="button"
              className="plan-cta-event-info"
              onClick={openEventSourceInNewTab}
            >
              <ExternalLink size={17} strokeWidth={2} aria-hidden />
              VIEW EVENT SOURCE
            </button>
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

        </div>
      </div>
      {shareOpen ? (
        <EventShareSheet
          title={data.displayTitle}
          venue={data.venueLine}
          when={data.timeRange}
          url={data.sourceUrl}
          fallbackPath={`/discover/${data.eventId}`}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {cancelConfirmOpen ? (
        <PlanCancelConfirmDialog
          eventTitle={data.displayTitle}
          onDismiss={() => setCancelConfirmOpen(false)}
          onConfirm={() => {
            setCancelConfirmOpen(false)
            onTogglePlan?.()
          }}
        />
      ) : null}
    </div>
  )
}

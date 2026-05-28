import type { CSSProperties } from 'react'
import type { EventItem } from '../../../types'

export const CATEGORY_ACCENT: Record<string, string> = {
  'live-music': '#ff3d00',
  'club-nights': '#00aaff',
  'jazz-blues': '#00cc66',
  underground: '#cc00ff',
  arts: '#00e5cc',
  food: '#ffaa00',
  popups: '#0d9488',
  festivals: '#9333ea',
}

export const DEFAULT_ACCENT = '#ff3d00'

const GENRE_TO_CATEGORY: Record<string, string> = {
  Techno: 'club-nights',
  'Club Nights': 'club-nights',
  Jazz: 'jazz-blues',
  Electronic: 'underground',
  'Live Music': 'live-music',
  'Cocktail Bar': 'food',
}

type PinStyle = CSSProperties & { '--pin-accent': string }

export function getAccent(event: EventItem): string {
  const catId = CATEGORY_ACCENT[event.exploreCategoryId]
    ? event.exploreCategoryId
    : GENRE_TO_CATEGORY[event.genre] ?? event.exploreCategoryId
  return CATEGORY_ACCENT[catId] ?? DEFAULT_ACCENT
}

function eventDateTimeLabel(event: EventItem): string {
  return event.displayDateTimeLabel ?? event.time
}

export function compactDateTimeLabel(event: EventItem): string {
  const label = eventDateTimeLabel(event).trim()
  if (!label) return 'TBA'
  if (/^date tba/i.test(label)) return 'TBA'
  const tonight = label.match(/^tonight\s+(.+)$/i)
  if (tonight?.[1]) return tonight[1]
  return label
}

export function EventPin({ event, isSelected }: { event: EventItem; isSelected: boolean }) {
  const accent = getAccent(event)
  const markerLabel = compactDateTimeLabel(event)
  const style = { '--pin-accent': accent } as PinStyle

  return (
    <div className="mv-pin-stack">
      <div className={`mv-pin-bubble${isSelected ? ' mv-pin-bubble--active' : ''}`} style={style}>
        <span className="mv-pin-time">{markerLabel}</span>
      </div>
      <div className="mv-pin-tail" style={style} />
    </div>
  )
}

export function ClusterPin({
  count,
  accent,
  compact = false,
}: {
  count: number
  accent: string
  compact?: boolean
}) {
  const style = { '--pin-accent': accent } as PinStyle
  const label = compact ? String(count) : count === 1 ? '1 event' : `${count} events`

  return (
    <div className={`mv-pin-stack${compact ? ' mv-pin-stack--compact-cluster' : ''}`}>
      <div className={`mv-pin-bubble mv-pin-bubble--cluster${compact ? ' mv-pin-bubble--compact-cluster' : ''}`} style={style}>
        <span className="mv-pin-time">{label}</span>
      </div>
      <div className="mv-pin-tail mv-pin-tail--cluster" style={style} />
    </div>
  )
}

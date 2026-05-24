import { ExternalLink, Facebook, Link2, MessageCircle, Radio, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'

type EventShareSheetProps = {
  title: string
  venue?: string
  when?: string
  url?: string | null
  fallbackPath?: string
  onClose: () => void
}

function absoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function WhatsAppIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function shareText(title: string, venue?: string, when?: string): string {
  const lines = [title.trim()]
  if (when?.trim()) lines.push(`When: ${when.trim()}`)
  if (venue?.trim()) lines.push(`Where: ${venue.trim()}`)
  return lines.join('\n')
}

export function EventShareSheet({
  title,
  venue,
  when,
  url,
  fallbackPath,
  onClose,
}: EventShareSheetProps) {
  const sourceUrl = url?.trim() && /^https?:\/\//i.test(url.trim()) ? url.trim() : null
  const buzoUrl = absoluteUrl(fallbackPath ?? '/discover')
  const [linkMode, setLinkMode] = useState<'source' | 'buzo'>(sourceUrl ? 'source' : 'buzo')
  const targetUrl = linkMode === 'source' ? (sourceUrl ?? buzoUrl) : buzoUrl
  const text = shareText(title, venue, when)
  const encodedUrl = encodeURIComponent(targetUrl)
  const encodedText = encodeURIComponent(text)
  const smsBody = encodeURIComponent(`${text}\n${targetUrl}`)
  const sourceHost = useMemo(() => {
    if (!sourceUrl) return ''
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      return 'source'
    }
  }, [sourceUrl])

  const openShareTarget = (shareUrl: string) => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  const onCopy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(targetUrl)
      return
    }
    window.prompt('Copy event link', targetUrl)
  }

  const onOpen = () => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="event-share-backdrop" onClick={onClose}>
      <div className="event-share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="event-share-head">
          <div>
            <h3>Share Event</h3>
            <p className="event-share-sub">Send this gig to your friends in one tap.</p>
          </div>
          <button type="button" className="event-share-close" aria-label="Close share sheet" onClick={onClose}>
            <X size={20} strokeWidth={2.4} />
          </button>
        </div>

        <div className="event-share-preview">
          <p className="event-share-preview-title">{title}</p>
          <p className="event-share-preview-meta">{when || 'Time TBA'} · {venue || 'Venue TBA'}</p>
        </div>

        <div className="event-share-mode-row" role="radiogroup" aria-label="Link type">
          {sourceUrl ? (
            <button
              type="button"
              className={`event-share-mode${linkMode === 'source' ? ' is-active' : ''}`}
              onClick={() => setLinkMode('source')}
              aria-pressed={linkMode === 'source'}
            >
              <Radio size={14} strokeWidth={2} />
              <span>Source ({sourceHost})</span>
            </button>
          ) : null}
          <button
            type="button"
            className={`event-share-mode${linkMode === 'buzo' ? ' is-active' : ''}`}
            onClick={() => setLinkMode('buzo')}
            aria-pressed={linkMode === 'buzo'}
          >
            <Link2 size={14} strokeWidth={2} />
            <span>Buzo page</span>
          </button>
        </div>

        <div className="event-share-grid" role="group" aria-label="Share targets">
          <button
            type="button"
            className="event-share-target"
            aria-label="Share to WhatsApp"
            title="WhatsApp"
            onClick={() => openShareTarget(`https://wa.me/?text=${encodedText}%20${encodedUrl}`)}
          >
            <span className="event-share-target-dot event-share-target-dot--wa">
              <WhatsAppIcon />
            </span>
            <span className="event-share-target-label">WhatsApp</span>
          </button>
          <button
            type="button"
            className="event-share-target"
            aria-label="Share to Telegram"
            title="Telegram"
            onClick={() => openShareTarget(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`)}
          >
            <span className="event-share-target-dot event-share-target-dot--tg">
              <Send size={24} strokeWidth={2.2} />
            </span>
            <span className="event-share-target-label">Telegram</span>
          </button>
          <button
            type="button"
            className="event-share-target"
            aria-label="Share to Facebook"
            title="Facebook"
            onClick={() => openShareTarget(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
          >
            <span className="event-share-target-dot event-share-target-dot--fb">
              <Facebook size={22} strokeWidth={2.3} />
            </span>
            <span className="event-share-target-label">Facebook</span>
          </button>
          <button
            type="button"
            className="event-share-target"
            aria-label="Share to X"
            title="X"
            onClick={() => openShareTarget(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`)}
          >
            <span className="event-share-target-dot event-share-target-dot--x">X</span>
            <span className="event-share-target-label">X</span>
          </button>
          <button
            type="button"
            className="event-share-target"
            aria-label="Share by Messages or SMS"
            title="Messages / SMS"
            onClick={() => {
              window.location.href = `sms:?&body=${smsBody}`
            }}
          >
            <span className="event-share-target-dot event-share-target-dot--sms">
              <MessageCircle size={24} strokeWidth={2.2} />
            </span>
            <span className="event-share-target-label">Messages</span>
          </button>
        </div>

        <div className="event-share-link-row">
          <input type="text" value={targetUrl} readOnly aria-label="Share link" />
          <div className="event-share-link-actions">
            <button type="button" className="event-share-open" onClick={onOpen}>
              <ExternalLink size={14} strokeWidth={2.2} />
              <span>Open</span>
            </button>
            <button type="button" className="event-share-copy" onClick={() => { void onCopy() }}>
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

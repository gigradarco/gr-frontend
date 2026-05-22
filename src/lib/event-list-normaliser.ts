import type { EventItem } from '../types'
import { resolveEventImagePlaceholder } from './resolve-event-image'

function dateFromUnknown(value: unknown): Date | null {
  if (value == null || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Turso NUMERIC may be Unix seconds or JavaScript milliseconds.
    const ms = value > 1_000_000_000_000 ? value : value * 1000
    const d = new Date(ms)
    return Number.isFinite(d.getTime()) ? d : null
  }

  const text = String(value).trim()
  if (!text) return null
  if (/^\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text)
    if (Number.isFinite(numeric)) return dateFromUnknown(numeric)
  }

  const d = new Date(text)
  return Number.isFinite(d.getTime()) ? d : null
}

function formatDateTimeLabel(value: unknown): string {
  const d = dateFromUnknown(value)
  if (d) {
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return ''
}

/** Legacy export kept for callers that used the old Supabase mapper name. */
export function mapDbEventToEventItem(row: Record<string, unknown>): EventItem {
  return mapRemoteEventRowToEventItem(row)
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue
    const text = String(value).trim()
    if (text.length > 0) return text
  }
  return ''
}

/** Parse Turso `category` into display tags (JSON array, delimited text, or single value). */
export function parseCategoryTags(value: unknown): string[] {
  if (value == null || value === '') return []

  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => String(entry).trim()).filter(Boolean))]
  }

  const text = String(value).trim()
  if (!text) return []

  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((entry) => String(entry).trim()).filter(Boolean))]
      }
    } catch {
      // Fall through to delimiter / single-value parsing.
    }
  }

  if (text.includes(',') || text.includes('|')) {
    return [
      ...new Set(
        text
          .split(/[,|]/)
          .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean),
      ),
    ]
  }

  return [text]
}

function numberFromUnknown(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(n) ? n : null
}

function booleanFromUnknown(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
  }
  return false
}

function formatPriceAmount(value: unknown): string | null {
  const n = numberFromUnknown(value)
  return n == null ? null : n.toFixed(2)
}

function formatTicketPrice(row: Record<string, unknown>): string {
  const minPrice = formatPriceAmount(row.min_price)
  if (minPrice) {
    const currency = firstText(row.currencyId)
    const suffix = currency ? ` ${currency}` : ''
    if (booleanFromUnknown(row.is_price_range)) {
      const maxPrice = formatPriceAmount(row.max_price)
      return maxPrice ? `FROM ${minPrice} - ${maxPrice}${suffix}` : `FROM ${minPrice}${suffix}`
    }
    return `${minPrice}${suffix}`
  }

  const legacy = firstText(row.ticket_price)
  if (legacy) return legacy

  if (row.price == null || row.price === '') return 'Not available'
  const price = String(row.price).trim()
  const currency = firstText(row.currencyId)
  return currency ? `${price} ${currency}` : price
}

/**
 * `/api/events` Turso-backed rows using the current Turso schema.
 */
export function mapRemoteEventRowToEventItem(row: Record<string, unknown>): EventItem {
  const id = firstText(row.event_id)
  const time = formatDateTimeLabel(row.event_datetime)
  const categoryTags = parseCategoryTags(row.category)
  const category = categoryTags[0] ?? ''
  const tasteTags = parseCategoryTags(row.taste_and_recommendations)
  const cityId = firstText(row.location_city_id) || 'unknown'
  const title = String(row.title ?? '')
  const image = resolveEventImagePlaceholder(row, { id, title, genre: category })

  return {
    id,
    title,
    venue: firstText(row.location),
    district: firstText(row.address),
    time,
    genre: category,
    exploreCategoryId: category,
    locationCityId: cityId,
    verified: Number(row.verified ?? 0),
    image,
    host: String(row.host ?? ''),
    hostPrompt: firstText(row.the_experience),
    friendsGoing: 0,
    vibeTags: tasteTags,
    ticketPrice: formatTicketPrice(row),
    bpReward: undefined,
    buzzPct: undefined,
    lat: row.lat != null ? Number(row.lat) : undefined,
    lng: row.lon != null ? Number(row.lon) : undefined,
  }
}

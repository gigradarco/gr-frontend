import { parseCategoryTags } from './event-list-normaliser'
import type { EventItem } from '../types'

const SPLASH_IMAGE_BUCKETS = {
  liveMusic: [
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=80',
  ],
  clubNight: [
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
  ],
  artsCulture: [
    'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  ],
  foodDrink: [
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
  ],
  popUpFestival: [
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=1200&q=80',
  ],
  generic: [
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
  ],
} as const

type SplashBucket = keyof typeof SPLASH_IMAGE_BUCKETS

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue
    const text = String(value).trim()
    if (text.length > 0) return text
  }
  return ''
}

function stableIndex(seed: string, size: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return size === 0 ? 0 : hash % size
}

export function isSplashImageUrl(url: string): boolean {
  return url.includes('images.unsplash.com/')
}

function textFromEvent(row: Record<string, unknown>, item?: Pick<EventItem, 'title' | 'genre'>): string {
  return [
    ...parseCategoryTags(row.category),
    row.taste_and_recommendations,
    row.the_experience,
    row.title,
    row.host,
    row.platform,
    item?.genre,
    item?.title,
  ]
    .map((value) => (value == null ? '' : String(value).toLowerCase()))
    .join(' ')
}

function splashBucketForEvent(row: Record<string, unknown>, item?: Pick<EventItem, 'title' | 'genre'>): SplashBucket {
  const text = textFromEvent(row, item)

  if (/\b(jazz|blues|band|singer|acoustic|concert|orchestra|gig|live music|capitol)\b/.test(text)) {
    return 'liveMusic'
  }
  if (/\b(club|dj|techno|house|dance|nightlife|rave|electronic|underground)\b/.test(text)) {
    return 'clubNight'
  }
  if (/\b(art|arts|culture|gallery|exhibition|museum|theatre|theater|film|comedy|performance)\b/.test(text)) {
    return 'artsCulture'
  }
  if (/\b(food|drink|cocktail|bar|wine|beer|dining|restaurant|tasting|brunch|coffee)\b/.test(text)) {
    return 'foodDrink'
  }
  if (/\b(festival|market|pop[- ]?up|fair|outdoor|community|workshop|bazaar)\b/.test(text)) {
    return 'popUpFestival'
  }

  return 'generic'
}

export function splashImageForEventRow(
  row: Record<string, unknown>,
  item?: Pick<EventItem, 'id' | 'title' | 'genre'>,
): string {
  const bucket = splashBucketForEvent(row, item)
  const images = SPLASH_IMAGE_BUCKETS[bucket]
  const seed = firstText(row.event_id, item?.id, row.title, item?.title, row.category, row.source_url, row.location)
  return images[stableIndex(`${bucket}:${seed || 'event'}`, images.length)]
}

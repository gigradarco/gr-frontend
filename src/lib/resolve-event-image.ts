import type { EventItem } from '../types'
import { isSplashImageUrl, splashImageForEventRow } from './splash-images'

export type ImageSourceFilter = 'all' | 'event-img' | 'fallback-img' | 'splash-img' | 'failed-load'
export type RenderedImageSource = 'event-img' | 'fallback-img' | 'splash-img' | null

export type EventImageRow = {
  item: EventItem
  raw: Record<string, unknown>
}

export type ResolvedEventImage = {
  url: string
  source: RenderedImageSource
}

export type EventImagePillState = {
  active: boolean
  available: boolean
}

export type EventImageState = {
  displayUrl: string
  failedCandidateUrls: string[]
  failedLoad: boolean
  pills: {
    eventImg: EventImagePillState
    fallbackImg: EventImagePillState
    splashImg: EventImagePillState
    failedLoad: EventImagePillState
  }
  resolved: ResolvedEventImage
  source: RenderedImageSource
  triedUrls: string[]
}

const EMPTY_FAILED_IMAGE_URLS = new Set<string>()

function firstImageUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function sourceForEventImg(url: string): Extract<RenderedImageSource, 'event-img' | 'splash-img'> {
  return isSplashImageUrl(url) ? 'splash-img' : 'event-img'
}

export function resolveListImage(
  raw: Record<string, unknown>,
  item: EventItem,
  failedImageUrls: ReadonlySet<string> = EMPTY_FAILED_IMAGE_URLS,
): ResolvedEventImage {
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackImg = firstImageUrl(raw.fallback_event_img)

  if (eventImg && !failedImageUrls.has(eventImg)) {
    if (isSplashImageUrl(eventImg)) {
      const splashImg = splashImageForEventRow(raw, item)
      if (!failedImageUrls.has(splashImg)) {
        return { url: splashImg, source: 'splash-img' }
      }
    } else {
      return { url: eventImg, source: sourceForEventImg(eventImg) }
    }
  }

  if (fallbackImg && !failedImageUrls.has(fallbackImg)) {
    return { url: fallbackImg, source: 'fallback-img' }
  }

  const placeholder = item.image?.trim() ?? ''
  if (placeholder && !failedImageUrls.has(placeholder)) {
    return {
      url: placeholder,
      source: isSplashImageUrl(placeholder) ? 'splash-img' : null,
    }
  }

  return { url: '', source: null }
}

export function resolveTableThumbUrl(
  raw: Record<string, unknown>,
  item: EventItem,
  failedImageUrls: ReadonlySet<string> = EMPTY_FAILED_IMAGE_URLS,
): string {
  return resolveListImage(raw, item, failedImageUrls).url
}

export function imageUrlsForRow(row: EventImageRow): string[] {
  const { raw, item } = row
  const urls: string[] = []
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackImg = firstImageUrl(raw.fallback_event_img)
  const placeholder = item.image?.trim() ?? ''

  if (eventImg) {
    urls.push(eventImg)
    if (isSplashImageUrl(eventImg)) urls.push(splashImageForEventRow(raw, item))
  }
  if (fallbackImg) urls.push(fallbackImg)
  if (placeholder) urls.push(placeholder)

  return [...new Set(urls.filter(Boolean))]
}

export function rowHasFailedImageLoad(row: EventImageRow, failedImageUrls: ReadonlySet<string>): boolean {
  if (failedImageUrls.size === 0) return false

  const displayUrl = resolveListImage(row.raw, row.item, failedImageUrls).url
  if (displayUrl) return failedImageUrls.has(displayUrl)

  const candidates = imageUrlsForRow(row)
  if (candidates.length === 0) return false
  return candidates.every((url) => failedImageUrls.has(url))
}

export function rowMatchesImageSourceFilter(
  row: EventImageRow,
  filter: ImageSourceFilter,
  failedImageUrls: ReadonlySet<string>,
): boolean {
  if (filter === 'all') return true
  if (filter === 'failed-load') return rowHasFailedImageLoad(row, failedImageUrls)

  return resolveListImage(row.raw, row.item, failedImageUrls).source === filter
}

export function describeImageState(
  row: EventImageRow,
  failedImageUrls: ReadonlySet<string> = EMPTY_FAILED_IMAGE_URLS,
): EventImageState {
  const { raw, item } = row
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackImg = firstImageUrl(raw.fallback_event_img)
  const placeholder = item.image?.trim() ?? ''
  const resolved = resolveListImage(raw, item, failedImageUrls)
  const triedUrls = imageUrlsForRow(row)
  const failedLoad = rowHasFailedImageLoad(row, failedImageUrls)

  return {
    displayUrl: resolved.url,
    failedCandidateUrls: triedUrls.filter((url) => failedImageUrls.has(url)),
    failedLoad,
    pills: {
      eventImg: {
        active: resolved.source === 'event-img',
        available: eventImg.length > 0 && !isSplashImageUrl(eventImg),
      },
      fallbackImg: {
        active: resolved.source === 'fallback-img',
        available: fallbackImg.length > 0,
      },
      splashImg: {
        active: resolved.source === 'splash-img',
        available: (eventImg.length > 0 && isSplashImageUrl(eventImg)) || isSplashImageUrl(placeholder),
      },
      failedLoad: {
        active: failedLoad,
        available: triedUrls.length > 0,
      },
    },
    resolved,
    source: resolved.source,
    triedUrls,
  }
}

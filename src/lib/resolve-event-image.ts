import type { EventItem } from '../types'
import { isSplashImageUrl, splashImageForEventRow } from './splash-images'

export type ImageSourceFilter = 'all' | 'event-img' | 'fallback-img' | 'splash-img' | 'failed-load'
export type RenderedImageSource = 'event-img' | 'fallback-img' | 'splash-img' | null
export type EventImageDiagnosticSeverity = 'error' | 'warning'
export type EventImageDiagnosticSource = 'event-img' | 'fallback-img' | 'splash-img' | 'placeholder'

export type EventImageRow = {
  item: EventItem
  raw: Record<string, unknown>
}

type EventImagePlaceholderContext = Pick<EventItem, 'genre' | 'id' | 'title'>

export type ResolvedEventImage = {
  url: string
  source: RenderedImageSource
}

export type EventImagePillState = {
  active: boolean
  available: boolean
}

export type EventImageState = {
  diagnostics: EventImageDiagnostic[]
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

export type EventImageDiagnostic = {
  detail?: string
  message: string
  severity: EventImageDiagnosticSeverity
  source: EventImageDiagnosticSource
  url?: string
}

const EMPTY_FAILED_IMAGE_URLS = new Set<string>()

function firstImageUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isHttpImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function fallbackImageUrl(value: unknown): string {
  const url = firstImageUrl(value)
  return isHttpImageUrl(url) ? url : ''
}

function pushFailedUrlDiagnostic(
  diagnostics: EventImageDiagnostic[],
  diagnosedUrls: Set<string>,
  diagnostic: EventImageDiagnostic & { url: string },
): void {
  if (diagnosedUrls.has(diagnostic.url)) return
  diagnosedUrls.add(diagnostic.url)
  diagnostics.push(diagnostic)
}

function imageDiagnosticsForRow(
  row: EventImageRow,
  failedImageUrls: ReadonlySet<string>,
): EventImageDiagnostic[] {
  const { raw, item } = row
  const diagnostics: EventImageDiagnostic[] = []
  const diagnosedUrls = new Set<string>()
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackRaw = firstImageUrl(raw.fallback_event_img)
  const fallbackImg = fallbackImageUrl(raw.fallback_event_img)
  const placeholder = resolveEventImagePlaceholder(raw, item)

  if (!eventImg) {
    diagnostics.push({
      message: 'No event_img URL is stored for this row.',
      severity: 'warning',
      source: 'event-img',
    })
  } else if (isSplashImageUrl(eventImg)) {
    const splashImg = splashImageForEventRow(raw, item)
    if (failedImageUrls.has(splashImg)) {
      pushFailedUrlDiagnostic(diagnostics, diagnosedUrls, {
        detail: 'The DB event_img is an Unsplash URL, so the resolver tried the generated bucket splash instead.',
        message: 'Generated splash image failed to load.',
        severity: 'error',
        source: 'splash-img',
        url: splashImg,
      })
    }
  } else if (failedImageUrls.has(eventImg)) {
    pushFailedUrlDiagnostic(diagnostics, diagnosedUrls, {
      message: 'event_img failed to load.',
      severity: 'error',
      source: 'event-img',
      url: eventImg,
    })
  }

  if (!fallbackRaw) {
    diagnostics.push({
      message: 'No fallback_event_img value is stored for this row.',
      severity: 'warning',
      source: 'fallback-img',
    })
  } else if (!fallbackImg) {
    diagnostics.push({
      detail: fallbackRaw,
      message: 'fallback_event_img is not an http(s) URL, so it was skipped.',
      severity: 'warning',
      source: 'fallback-img',
    })
  } else if (failedImageUrls.has(fallbackImg)) {
    pushFailedUrlDiagnostic(diagnostics, diagnosedUrls, {
      message: 'fallback_event_img failed to load.',
      severity: 'error',
      source: 'fallback-img',
      url: fallbackImg,
    })
  }

  if (failedImageUrls.has(placeholder)) {
    pushFailedUrlDiagnostic(diagnostics, diagnosedUrls, {
      message: isSplashImageUrl(placeholder)
        ? 'Splash placeholder failed to load.'
        : 'Mapped item.image placeholder failed to load.',
      severity: 'error',
      source: isSplashImageUrl(placeholder) ? 'splash-img' : 'placeholder',
      url: placeholder,
    })
  }

  return diagnostics
}

function sourceForEventImg(url: string): Extract<RenderedImageSource, 'event-img' | 'splash-img'> {
  return isSplashImageUrl(url) ? 'splash-img' : 'event-img'
}

export function resolveEventImagePlaceholder(
  raw: Record<string, unknown>,
  item?: EventImagePlaceholderContext,
): string {
  const eventImg = firstImageUrl(raw.event_img)
  return eventImg && !isSplashImageUrl(eventImg) ? eventImg : splashImageForEventRow(raw, item)
}

export function resolveListImage(
  raw: Record<string, unknown>,
  item: EventItem,
  failedImageUrls: ReadonlySet<string> = EMPTY_FAILED_IMAGE_URLS,
): ResolvedEventImage {
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackImg = fallbackImageUrl(raw.fallback_event_img)

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

  const placeholder = resolveEventImagePlaceholder(raw, item)
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
  const fallbackImg = fallbackImageUrl(raw.fallback_event_img)
  const placeholder = resolveEventImagePlaceholder(raw, item)

  if (eventImg) {
    urls.push(isSplashImageUrl(eventImg) ? splashImageForEventRow(raw, item) : eventImg)
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
  const fallbackImg = fallbackImageUrl(raw.fallback_event_img)
  const placeholder = resolveEventImagePlaceholder(raw, item)
  const resolved = resolveListImage(raw, item, failedImageUrls)
  const triedUrls = imageUrlsForRow(row)
  const failedLoad = rowHasFailedImageLoad(row, failedImageUrls)

  return {
    diagnostics: imageDiagnosticsForRow(row, failedImageUrls),
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

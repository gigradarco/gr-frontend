/**
 * Persists the user's avatar as a base64 data URL in localStorage so it renders
 * instantly on the next page load / sign-in without waiting for the network.
 *
 * Only one entry is kept at a time (the current user's avatar).
 */

import { AVATAR_CACHE_MAX_DATA_URL_BYTES } from '../config/avatar'
import { AVATAR_CACHE_STORAGE_KEY } from '../config/storage'

interface AvatarCacheEntry {
  url: string
  dataUrl: string
}

function readEntry(): AvatarCacheEntry | null {
  try {
    const raw = localStorage.getItem(AVATAR_CACHE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AvatarCacheEntry
  } catch {
    return null
  }
}

function writeEntry(entry: AvatarCacheEntry): void {
  if (entry.dataUrl.length > AVATAR_CACHE_MAX_DATA_URL_BYTES) return
  try {
    localStorage.setItem(AVATAR_CACHE_STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // Quota exceeded or storage unavailable — silent fail
  }
}

/**
 * Synchronous read. Returns the cached data URL when the given remote URL matches
 * what was last stored, otherwise null.
 */
export function getCachedAvatarDataUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const entry = readEntry()
  if (!entry || entry.url !== url.trim()) return null
  return entry.dataUrl
}

/**
 * Called from an img `onLoad` handler after the remote image renders.
 * Draws the image to an off-screen canvas and saves the result to localStorage.
 * Falls back silently if the canvas is cross-origin tainted.
 */
export function persistAvatarToLocalCache(url: string, img: HTMLImageElement): void {
  const src = url.trim()
  if (!src) return
  const existing = readEntry()
  if (existing?.url === src && existing.dataUrl) return
  try {
    const w = img.naturalWidth || img.width
    const h = img.naturalHeight || img.height
    if (!w || !h) return
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    writeEntry({ url: src, dataUrl })
  } catch {
    // Canvas tainted by cross-origin image — warmAvatarCacheIfEmpty covers this path
  }
}

/**
 * Fetch-based warm: downloads the image via XHR so it can bypass cross-origin canvas
 * restrictions. No-ops if the URL is already cached. Returns true if a new entry was written.
 */
export async function warmAvatarCacheIfEmpty(url: string): Promise<boolean> {
  const src = url.trim()
  if (!src) return false
  const existing = readEntry()
  if (existing?.url === src && existing.dataUrl) return false
  try {
    const resp = await fetch(src)
    if (!resp.ok) return false
    const blob = await resp.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    writeEntry({ url: src, dataUrl })
    return true
  } catch {
    return false
  }
}

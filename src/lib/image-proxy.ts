import { apiBase } from './api-base'

type ImageProxyOptions = {
  quality?: number
  width?: number
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value as number), min), max)
}

export function proxiedEventImageUrl(url: string, options: ImageProxyOptions = {}): string {
  const raw = url.trim()
  if (!/^https?:\/\//i.test(raw)) return raw

  const params = new URLSearchParams()
  params.set('url', raw)
  params.set('w', String(clampInt(options.width, 1200, 160, 2400)))
  params.set('q', String(clampInt(options.quality, 80, 40, 95)))

  const path = `/api/image-proxy?${params.toString()}`
  const base = apiBase()
  return base ? `${base}${path}` : path
}

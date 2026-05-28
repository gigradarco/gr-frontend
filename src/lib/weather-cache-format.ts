export function formatCacheTtl(expiresAt: string): string {
  if (!expiresAt) return 'No TTL'
  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(expires)) return 'No TTL'
  const remainingMs = expires - Date.now()
  if (remainingMs <= 0) return 'Expired'
  const minutes = Math.ceil(remainingMs / 60000)
  return `${minutes}m left`
}

export function formatCacheRefreshRate(cachedAt: string, expiresAt: string): string {
  const cached = new Date(cachedAt).getTime()
  const expires = new Date(expiresAt).getTime()
  if (Number.isNaN(cached) || Number.isNaN(expires) || expires <= cached) return 'refresh rate unavailable'
  const minutes = Math.max(1, Math.round((expires - cached) / 60000))
  if (minutes < 60) return `refresh every ${minutes}m`
  const hours = Math.round(minutes / 60)
  return `refresh every ${hours}h`
}

import type { SubscriptionTier } from '../store/appStore'

export const FAVORITES_CONFIG = {
  cacheFreshMs: 24 * 60 * 60 * 1000,
  refreshBatchSize: 10,
  limits: {
    free: 5,
    pro: 50,
  },
} as const

export function favoriteLimitForTier(tier: SubscriptionTier): number {
  return FAVORITES_CONFIG.limits[tier]
}

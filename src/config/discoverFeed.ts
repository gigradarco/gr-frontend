/**
 * Discover feed runtime tuning.
 *
 * Keep product/feed mechanics here instead of scattering magic numbers through
 * the hook and card feed. These values are client-side only; backend API limits
 * still live in gr-backend.
 */
export const DISCOVER_FEED_CONFIG = {
  pageSize: 30,
  appendLoadingMinMs: 450,
  appendLoadCooldownMs: 300,
  loadMoreCardBuffer: 6,
  loadMoreScrollBufferScreens: 2,
  hardRenderedEventCount: 180,
  softRenderedEventCount: 120,
} as const

export const DISCOVER_EVENTS_SOURCE_CONFIG = {
  defaultSource: 'live',
  demoFallbackEnvValue: 'true',
} as const

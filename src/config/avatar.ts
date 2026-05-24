/** JPG, JPEG, PNG only — matches picker filter and validation. */
export const ATTACH_IMAGE_ACCEPT = 'image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png'

export const AVATAR_CACHE_MAX_DATA_URL_BYTES = 400 * 1024

export const AVATAR_RESIZE_CONFIG = {
  maxDimensionPx: 1024,
  maxBytes: 2 * 1024 * 1024,
  initialJpegQuality: 0.88,
  maxEncodeAttempts: 6,
  qualityStep: 0.12,
} as const

export const AVATAR_CROP_CONFIG = {
  viewportPx: 280,
  outputPx: 640,
  zoomMin: 1,
  zoomMax: 3,
  jpegQuality: 0.92,
} as const

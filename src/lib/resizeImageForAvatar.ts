import { AVATAR_RESIZE_CONFIG } from '../config/avatar'

/**
 * Downscale and encode as JPEG so uploads stay under typical Storage limits.
 */
export async function resizeImageForAvatar(source: File): Promise<File> {
  const bitmap = await createImageBitmap(source)
  try {
    let { width, height } = bitmap
    const scale = Math.min(1, AVATAR_RESIZE_CONFIG.maxDimensionPx / Math.max(width, height))
    width = Math.round(width * scale)
    height = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Could not prepare image')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)

    let quality = AVATAR_RESIZE_CONFIG.initialJpegQuality
    let blob: Blob | null = null
    for (let i = 0; i < AVATAR_RESIZE_CONFIG.maxEncodeAttempts; i++) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      })
      if (!blob) break
      if (blob.size <= AVATAR_RESIZE_CONFIG.maxBytes) break
      quality -= AVATAR_RESIZE_CONFIG.qualityStep
    }

    if (!blob || blob.size === 0) {
      throw new Error('Could not encode image')
    }
    if (blob.size > AVATAR_RESIZE_CONFIG.maxBytes) {
      throw new Error('Image is still too large after resizing — try another photo')
    }

    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
  } finally {
    bitmap.close()
  }
}

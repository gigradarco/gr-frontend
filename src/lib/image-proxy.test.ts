import { describe, expect, it } from 'vitest'
import { proxiedEventImageUrl } from './image-proxy'

describe('proxiedEventImageUrl', () => {
  it('wraps http image URLs in the backend proxy path', () => {
    const proxied = proxiedEventImageUrl('https://images.unsplash.com/photo-123?utm_source=test', {
      quality: 70,
      width: 800,
    })

    expect(proxied).toContain(
      '/api/image-proxy?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-123%3Futm_source%3Dtest&w=800&q=70',
    )
  })

  it('leaves non-http values untouched', () => {
    expect(proxiedEventImageUrl('')).toBe('')
    expect(proxiedEventImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
  })
})

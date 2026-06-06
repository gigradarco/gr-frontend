import { describe, expect, it } from 'vitest'
import { formatEventPriceLabel } from './event-price-label'

describe('formatEventPriceLabel', () => {
  it('makes the generic fallback price-specific', () => {
    expect(formatEventPriceLabel('Not available')).toBe('Price not available')
  })

  it('leaves real price labels unchanged', () => {
    expect(formatEventPriceLabel('FROM 42.00 SGD')).toBe('FROM 42.00 SGD')
    expect(formatEventPriceLabel('Free')).toBe('Free')
  })
})

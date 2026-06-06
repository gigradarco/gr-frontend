export function formatEventPriceLabel(ticketPrice: string): string {
  const text = ticketPrice.trim()
  if (!text) return text
  return /^not available$/i.test(text) ? 'Price not available' : text
}

import { describe, expect, it } from 'vitest'
import { mapRemoteEventRowToEventItem, parseCategoryTags } from './event-list-normaliser'

describe('parseCategoryTags', () => {
  it('accepts JSON arrays and delimited source text', () => {
    expect(parseCategoryTags('["Techno", "House", "Techno"]')).toEqual(['Techno', 'House'])
    expect(parseCategoryTags('Techno | House, Jazz')).toEqual(['Techno', 'House', 'Jazz'])
  })
})

describe('mapRemoteEventRowToEventItem', () => {
  it('uses event_id and event_datetime without legacy id/time fallbacks', () => {
    const item = mapRemoteEventRowToEventItem({
      id: 'legacy-id',
      event_id: 'event-1',
      title: 'Warehouse Techno',
      location: 'Marquee',
      address: 'Marina Bay',
      event_datetime: '2026-05-22T14:30:00.000Z',
      event_time_raw: 'raw crawler text',
      category: 'Club Nights',
      location_city_id: 'singapore',
      taste_and_recommendations: '["Tech House"]',
      currencyId: 'SGD',
      min_price: 42,
    })

    expect(item.id).toBe('event-1')
    expect(item.eventDateTime).toBe('2026-05-22T14:30:00.000Z')
    expect(item.displayDateTimeLabel).not.toBe('raw crawler text')
    expect(item.genre).toBe('Club Nights')
    expect(item.vibeTags).toEqual(['Tech House'])
    expect(item.ticketPrice).toBe('42.00 SGD')
  })

  it('does not fall back to legacy id when event_id is missing', () => {
    const item = mapRemoteEventRowToEventItem({
      id: 'legacy-id',
      title: 'No Stable Id',
    })

    expect(item.id).toBe('')
  })
})

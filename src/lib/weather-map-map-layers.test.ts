import { describe, expect, it } from 'vitest'
import {
  mapTwentyFourHourPeriodToAreas,
  normalizeForecastRegionKey,
  pickActiveTwentyFourHourPeriod,
} from './weather-map-map-layers'
import type { TwentyFourHourForecastPeriod } from './weather-map-data'

const samplePeriods: TwentyFourHourForecastPeriod[] = [
  {
    validStart: '2026-05-27T08:00:00+08:00',
    validEnd: '2026-05-27T12:00:00+08:00',
    validText: 'Morning',
    regions: [{ region: 'west', forecastCode: 'FA', forecastText: 'Fair' }],
  },
  {
    validStart: '2026-05-27T12:00:00+08:00',
    validEnd: '2026-05-27T18:00:00+08:00',
    validText: 'Midday to 6 pm',
    regions: [
      { region: 'Central', forecastCode: 'PC', forecastText: 'Partly Cloudy (Day)' },
      { region: 'east', forecastCode: 'PC', forecastText: 'Partly Cloudy (Day)' },
    ],
  },
]

describe('weather-map-map-layers', () => {
  it('normalizes region keys', () => {
    expect(normalizeForecastRegionKey(' Central ')).toBe('central')
  })

  it('picks the period that contains the current time', () => {
    const active = pickActiveTwentyFourHourPeriod(
      samplePeriods,
      new Date('2026-05-27T14:30:00+08:00'),
    )
    expect(active?.validText).toBe('Midday to 6 pm')
  })

  it('falls back to the first period when none match', () => {
    const active = pickActiveTwentyFourHourPeriod(
      samplePeriods,
      new Date('2026-05-28T00:00:00+08:00'),
    )
    expect(active?.validText).toBe('Morning')
  })

  it('maps known 24-hour regions to forecast areas with centroids', () => {
    const areas = mapTwentyFourHourPeriodToAreas(samplePeriods[1]!)
    expect(areas).toHaveLength(2)
    expect(areas[0]).toMatchObject({
      name: 'Central',
      forecast: 'Partly Cloudy (Day)',
    })
    expect(areas[1]?.name).toBe('East')
  })
})

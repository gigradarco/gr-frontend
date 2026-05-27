import type { ForecastAreaWeather, TwentyFourHourForecastPeriod } from './weather-map-data'

export type MapForecastLayer = 'twoHour' | 'twentyFourHour'

export const SINGAPORE_FORECAST_REGION_CENTROIDS = {
  west: { lat: 1.35, lng: 103.705, label: 'West' },
  east: { lat: 1.345, lng: 103.94, label: 'East' },
  central: { lat: 1.304, lng: 103.832, label: 'Central' },
  north: { lat: 1.43, lng: 103.79, label: 'North' },
  south: { lat: 1.265, lng: 103.82, label: 'South' },
} as const

export type SingaporeForecastRegionKey = keyof typeof SINGAPORE_FORECAST_REGION_CENTROIDS

export function normalizeForecastRegionKey(region: string): string {
  return region.trim().toLowerCase()
}

export function pickActiveTwentyFourHourPeriod(
  periods: TwentyFourHourForecastPeriod[],
  now: Date = new Date(),
): TwentyFourHourForecastPeriod | null {
  if (periods.length === 0) return null

  const nowMs = now.getTime()
  for (const period of periods) {
    const start = Date.parse(period.validStart)
    const end = Date.parse(period.validEnd)
    if (Number.isFinite(start) && Number.isFinite(end) && nowMs >= start && nowMs < end) {
      return period
    }
  }

  return periods[0] ?? null
}

export function mapTwentyFourHourPeriodToAreas(period: TwentyFourHourForecastPeriod): ForecastAreaWeather[] {
  return period.regions.flatMap((row) => {
    const key = normalizeForecastRegionKey(row.region)
    const centroid = SINGAPORE_FORECAST_REGION_CENTROIDS[key as SingaporeForecastRegionKey]
    if (!centroid) return []

    return [
      {
        name: centroid.label,
        lat: centroid.lat,
        lng: centroid.lng,
        forecast: row.forecastText,
      },
    ]
  })
}

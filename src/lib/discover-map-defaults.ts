import { getLocationCityCentroid } from '../data/locationRegions'

export function getDiscoverMapCityCenter(cityId: string): [number, number] {
  if (cityId === 'singapore') return [1.316, 103.8198]
  return getLocationCityCentroid(cityId) ?? [1.3521, 103.8198]
}

export function getDiscoverMapCityDefaultZoom(cityId: string): number {
  if (cityId === 'singapore') return 10.8
  return 14
}

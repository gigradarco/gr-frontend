export const DATE_FILTER = ['All', 'Tonight', 'Tomorrow', 'Next 7 Days', 'This Month', 'Next 90 Days', 'Custom Range'] as const
export const TIME_FILTER = ['All', 'Early Evening (6-9PM)', 'Prime (9-11PM)', 'Late Night (11PM+)'] as const
export const AREA_FILTER = [
  'All',
  'Clarke Quay',
  'Marina Bay',
  'Tiong Bahru',
  'Raffles Place',
  'Downtown Core',
] as const
export const PRICE_FILTER = ['All', 'Free', 'Under $20', '$20-$50', '$50+'] as const

export type DiscoverDateFilter = (typeof DATE_FILTER)[number]
export type DiscoverTimeFilter = (typeof TIME_FILTER)[number]
export type DiscoverAreaFilter = (typeof AREA_FILTER)[number]
export type DiscoverPriceFilter = (typeof PRICE_FILTER)[number]

export type DiscoverEventFilters = {
  categories: 'All' | string[]
  date: DiscoverDateFilter
  time: DiscoverTimeFilter
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  area: DiscoverAreaFilter
  price: DiscoverPriceFilter
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverEventFilters = {
  categories: 'All',
  date: 'All',
  time: 'All',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  area: 'All',
  price: 'All',
}

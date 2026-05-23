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

export const DISCOVER_CATEGORY_STORAGE_KEY = 'buzo-feed-category-ids'

export function readInitialDiscoverFilters(): DiscoverEventFilters {
  if (typeof window === 'undefined') return DEFAULT_DISCOVER_FILTERS
  try {
    const raw = window.localStorage.getItem(DISCOVER_CATEGORY_STORAGE_KEY)
    if (!raw) return DEFAULT_DISCOVER_FILTERS
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_DISCOVER_FILTERS
    const categoryIds = parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    return {
      ...DEFAULT_DISCOVER_FILTERS,
      categories: categoryIds.length > 0 ? categoryIds : 'All',
    }
  } catch {
    return DEFAULT_DISCOVER_FILTERS
  }
}

export function persistDiscoverCategoryFilters(categories: DiscoverEventFilters['categories']): void {
  if (typeof window === 'undefined') return
  const categoryIds = categories === 'All' ? [] : categories
  try {
    window.localStorage.setItem(DISCOVER_CATEGORY_STORAGE_KEY, JSON.stringify(categoryIds))
  } catch {
    // ignore storage errors
  }
}

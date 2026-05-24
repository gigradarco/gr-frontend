import {
  AREA_FILTER,
  DATE_FILTER,
  DEFAULT_DISCOVER_FILTERS,
  PRICE_FILTER,
  TIME_FILTER,
  type DiscoverAreaFilter,
  type DiscoverDateFilter,
  type DiscoverEventFilters,
  type DiscoverPriceFilter,
  type DiscoverTimeFilter,
} from '../config/discoverFilters'
import { DISCOVER_CATEGORY_STORAGE_KEY } from '../config/storage'

export { AREA_FILTER, DATE_FILTER, DEFAULT_DISCOVER_FILTERS, PRICE_FILTER, TIME_FILTER }
export type {
  DiscoverAreaFilter,
  DiscoverDateFilter,
  DiscoverEventFilters,
  DiscoverPriceFilter,
  DiscoverTimeFilter,
}

export { DISCOVER_CATEGORY_STORAGE_KEY }

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

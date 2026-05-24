import { DISCOVER_FEED_CATEGORY_FILTER_OPTIONS } from '../data/exploreCategories'
import { LOCATION_REGIONS } from '../data/locationRegions'
import type { ImageSourceFilter } from '../lib/resolve-event-image'

export type EventListViewMode = 'list' | 'table'
export type EventListFilterMode = 'basic' | 'advanced'
export type EventListTableColumnPreset = 'overview' | 'timing' | 'taste' | 'price' | 'images' | 'all'
export type EventListTableSortDirection = 'asc' | 'desc'

export type EventListDebugFilters = {
  cityId: string
  categoryId: string
  startDate: string
  endDate: string
  limit: string
  search: string
  minPrice: string
  maxPrice: string
}

export type EventListCityOption = {
  id: string
  name: string
  regionId: string
  regionLabel: string
}

export type EventListCategoryOption = {
  id: string
  label: string
  queryValue: string
}

export type EventListFilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'nlike' | 'in' | 'isnull' | 'notnull'

export type EventListAdvancedCondition = {
  id: string
  column: (typeof TURSO_EVENT_SCHEMA_FIELDS)[number]
  operator: EventListFilterOperator
  value: string
}

export type EventListOperatorOption = {
  id: EventListFilterOperator
  label: string
}

export type EventListActiveFilterChip = {
  id: string
  label: string
  value: string
}

export const TURSO_EVENT_SCHEMA_FIELDS = [
  'event_id',
  'title',
  'location',
  'address',
  'host',
  'platform',
  'event_datetime',
  'event_time_raw',
  'the_experience',
  'taste_and_recommendations',
  'category',
  'is_price_range',
  'currencyId',
  'min_price',
  'max_price',
  'source_url',
  'event_img',
  'fallback_event_img',
  'lat',
  'lon',
  'ingestion_datetime',
  'location_city_id',
  'verified',
  'is_deleted',
] as const

export const HIDDEN_TURSO_FIELDS = new Set(['vibe_tags'])
export const BOOLEAN_TURSO_FIELDS = new Set(['is_price_range', 'is_deleted'])

/** Synthetic table column — thumbnail preview, inserted after `event_id`. */
export const TABLE_THUMB_COLUMN = '__thumb'

export const EVENT_LIST_LIMITS = {
  default: 100,
  min: 1,
  max: 1000,
} as const

export const DEFAULT_DEBUG_FILTERS: EventListDebugFilters = {
  cityId: '',
  categoryId: '',
  startDate: '',
  endDate: '',
  limit: String(EVENT_LIST_LIMITS.default),
  search: '',
  minPrice: '',
  maxPrice: '',
}

export const IMAGE_SOURCE_FILTERS: Array<{ id: ImageSourceFilter; label: string }> = [
  { id: 'all', label: 'All images' },
  { id: 'event-img', label: 'event-img' },
  { id: 'fallback-img', label: 'fallback-img' },
  { id: 'splash-img', label: 'splash-img' },
  { id: 'failed-load', label: 'failed load' },
]

export const TABLE_COLUMN_PRESETS: Array<{
  id: EventListTableColumnPreset
  label: string
  columns: string[] | null
}> = [
  {
    id: 'overview',
    label: 'Overview',
    columns: [
      'event_id',
      TABLE_THUMB_COLUMN,
      'title',
      'event_time_raw',
      'location',
      'category',
      'taste_and_recommendations',
      'is_price_range',
      'min_price',
      'max_price',
      'source_url',
    ],
  },
  {
    id: 'timing',
    label: 'Timing',
    columns: ['event_id', 'title', 'event_datetime', 'event_time_raw', 'ingestion_datetime'],
  },
  {
    id: 'taste',
    label: 'Taste',
    columns: [
      'event_id',
      'title',
      'category',
      'taste_and_recommendations',
      'the_experience',
      'host',
      'platform',
    ],
  },
  {
    id: 'price',
    label: 'Price',
    columns: ['event_id', 'title', 'is_price_range', 'currencyId', 'min_price', 'max_price', 'source_url'],
  },
  {
    id: 'images',
    label: 'Images',
    columns: ['event_id', TABLE_THUMB_COLUMN, 'title', 'event_img', 'fallback_event_img', 'source_url'],
  },
  { id: 'all', label: 'Raw all', columns: null },
]

export const DEFAULT_ADVANCED_CONDITION: EventListAdvancedCondition = {
  id: 'rule-1',
  column: 'category',
  operator: 'eq',
  value: '',
}

export const ADVANCED_RULE_PRESETS: Array<{ label: string; rule: Omit<EventListAdvancedCondition, 'id'> }> = [
  { label: 'Missing datetime', rule: { column: 'event_datetime', operator: 'isnull', value: '' } },
  { label: 'Has source URL', rule: { column: 'source_url', operator: 'notnull', value: '' } },
  { label: 'Missing price', rule: { column: 'min_price', operator: 'isnull', value: '' } },
  { label: 'Deleted only', rule: { column: 'is_deleted', operator: 'eq', value: '1' } },
  { label: 'Tech House taste', rule: { column: 'taste_and_recommendations', operator: 'like', value: 'Tech House' } },
]

export const OTHERS_CATEGORY_VALUE = '__others__'

export const OPERATOR_OPTIONS: EventListOperatorOption[] = [
  { id: 'eq', label: 'equals (=)' },
  { id: 'neq', label: 'not equals (!=)' },
  { id: 'gt', label: 'greater (>)' },
  { id: 'gte', label: 'greater or equals (>=)' },
  { id: 'lt', label: 'less (<)' },
  { id: 'lte', label: 'less or equals (<=)' },
  { id: 'like', label: 'like' },
  { id: 'nlike', label: 'not like' },
  { id: 'in', label: 'in (comma-separated)' },
  { id: 'isnull', label: 'is null' },
  { id: 'notnull', label: 'is not null' },
]

export const OPERATOR_LABEL_BY_ID = new Map(OPERATOR_OPTIONS.map((option) => [option.id, option.label]))

export const CITY_OPTIONS: EventListCityOption[] = LOCATION_REGIONS.flatMap((region) =>
  region.cities.map((city) => ({
    id: city.id,
    name: city.name,
    regionId: region.id,
    regionLabel: region.label,
  })),
)

export const CATEGORY_OPTIONS: EventListCategoryOption[] = [
  ...DISCOVER_FEED_CATEGORY_FILTER_OPTIONS.map((option) => ({
    id: option.id === 'All' ? '' : option.id,
    label: option.label,
    queryValue: option.id === 'All' ? '' : option.label,
  })),
  {
    id: OTHERS_CATEGORY_VALUE,
    label: 'Others',
    queryValue: OTHERS_CATEGORY_VALUE,
  },
]

export const CATEGORY_LABEL_BY_ID = new Map(
  CATEGORY_OPTIONS.filter((option) => option.id.length > 0).map((option) => [option.id.toLowerCase(), option.label]),
)

export const WIDE_TURSO_FIELDS = new Set([
  'title',
  'location',
  'address',
  'the_experience',
  'taste_and_recommendations',
  'source_url',
  'event_img',
  'fallback_event_img',
])

export const WRAP_TURSO_FIELDS = new Set(['event_datetime', 'event_time_raw', 'ingestion_datetime'])

const TURSO_FACT_ROW_GROUPS = [
  {
    id: 'datetime',
    className: 'event-list-fact-pair event-list-fact-pair--triple',
    keys: ['event_datetime', 'event_time_raw', 'ingestion_datetime'],
  },
  {
    id: 'taste',
    className: 'event-list-fact-stack',
    keys: ['taste_and_recommendations'],
  },
  {
    id: 'host-platform',
    className: 'event-list-fact-pair',
    keys: ['host', 'platform'],
  },
  {
    id: 'price',
    className: 'event-list-fact-pair event-list-fact-pair--quad',
    keys: ['is_price_range', 'currencyId', 'min_price', 'max_price'],
  },
  {
    id: 'images',
    className: 'event-list-fact-stack',
    keys: ['event_img', 'fallback_event_img'],
  },
  {
    id: 'location-geo',
    className: 'event-list-fact-pair event-list-fact-pair--triple',
    keys: ['location_city_id', 'lat', 'lon'],
  },
  {
    id: 'flags',
    className: 'event-list-fact-pair event-list-fact-pair--compact',
    keys: ['verified', 'is_deleted'],
  },
] as const

export const TURSO_FACT_GROUP_BY_KEY = new Map<string, (typeof TURSO_FACT_ROW_GROUPS)[number]>(
  TURSO_FACT_ROW_GROUPS.flatMap((group) => group.keys.map((key) => [key, group] as const)),
)

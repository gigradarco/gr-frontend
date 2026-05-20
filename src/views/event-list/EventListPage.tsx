import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react'
import { apiBase } from '../../lib/api-base'
import { DISCOVER_FEED_CATEGORY_FILTER_OPTIONS } from '../../data/exploreCategories'
import { LOCATION_REGIONS } from '../../data/locationRegions'
import { mapRemoteEventRowToEventItem, parseCategoryTags } from '../../lib/map-event'
import { isSplashImageUrl, splashImageForEventRow } from '../../lib/splash-images'
import type { EventItem } from '../../types'
import './event-list.css'

type EventRow = {
  item: EventItem
  raw: Record<string, unknown>
  sourceUrl?: string
}

type ViewMode = 'list' | 'table'
type FilterMode = 'basic' | 'advanced'
type ImageSourceFilter = 'all' | 'event-img' | 'fallback-img' | 'splash-img' | 'failed-load'
type TableSortDirection = 'asc' | 'desc'
type TableSortState = { column: string; direction: TableSortDirection } | null

type DebugFilters = {
  cityId: string
  categoryId: string
  limit: string
  search: string
  minPrice: string
  maxPrice: string
}

type CityOption = {
  id: string
  name: string
  regionId: string
  regionLabel: string
}

type CategoryOption = {
  id: string
  label: string
  queryValue: string
}

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'nlike' | 'in' | 'isnull' | 'notnull'

type AdvancedCondition = {
  id: string
  column: (typeof TURSO_EVENT_SCHEMA_FIELDS)[number]
  operator: FilterOperator
  value: string
}

type OperatorOption = {
  id: FilterOperator
  label: string
}

const TURSO_EVENT_SCHEMA_FIELDS = [
  'event_id',
  'title',
  'location',
  'address',
  'host',
  'platform',
  'event_datetime',
  'event_time_raw',
  'the_experience',
  'vibe_tags',
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

/** Synthetic table column — thumbnail preview, inserted after `event_id`. */
const TABLE_THUMB_COLUMN = '__thumb'
const DEFAULT_DEBUG_FILTERS: DebugFilters = {
  cityId: '',
  categoryId: '',
  limit: '100',
  search: '',
  minPrice: '',
  maxPrice: '',
}
const IMAGE_SOURCE_FILTERS: Array<{ id: ImageSourceFilter; label: string }> = [
  { id: 'all', label: 'All images' },
  { id: 'event-img', label: 'event-img' },
  { id: 'fallback-img', label: 'fallback-img' },
  { id: 'splash-img', label: 'splash-img' },
  { id: 'failed-load', label: 'failed load' },
]
const DEFAULT_ADVANCED_CONDITION: AdvancedCondition = {
  id: 'rule-1',
  column: 'category',
  operator: 'eq',
  value: '',
}
const OTHERS_CATEGORY_VALUE = '__others__'
const OPERATOR_OPTIONS: OperatorOption[] = [
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

const CITY_OPTIONS: CityOption[] = LOCATION_REGIONS.flatMap((region) =>
  region.cities.map((city) => ({
    id: city.id,
    name: city.name,
    regionId: region.id,
    regionLabel: region.label,
  })),
)

const CATEGORY_OPTIONS: CategoryOption[] = [
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

const CATEGORY_LABEL_BY_ID = new Map(
  CATEGORY_OPTIONS.filter((option) => option.id.length > 0).map((option) => [option.id.toLowerCase(), option.label]),
)

function resolveCategoryQuery(rawCategory: string): string {
  const t = rawCategory.trim()
  if (!t) return ''
  if (t === OTHERS_CATEGORY_VALUE) return OTHERS_CATEGORY_VALUE
  return CATEGORY_LABEL_BY_ID.get(t.toLowerCase()) ?? t
}

function findMatchedCategoryOptionId(rawCategoryValue: unknown): string | null {
  const rawCategory = normalizeComparable(rawCategoryValue)
  if (!rawCategory) return null
  const matched = CATEGORY_OPTIONS.find(
    (option) =>
      option.id.length > 0 &&
      option.id !== OTHERS_CATEGORY_VALUE &&
      (normalizeComparable(option.label) === rawCategory ||
        normalizeComparable(option.queryValue) === rawCategory ||
        normalizeComparable(option.id) === rawCategory),
  )
  return matched?.id ?? null
}

function normalizeAdvancedRules(rules: AdvancedCondition[]): AdvancedCondition[] {
  return rules
    .map((rule) => ({ ...rule, value: rule.value.trim() }))
    .filter((rule) => rule.operator === 'isnull' || rule.operator === 'notnull' || rule.value.length > 0)
}

function appendEventsQueryParams(
  params: URLSearchParams,
  mode: FilterMode,
  filters: DebugFilters,
  advanced: AdvancedCondition[],
) {
  params.set('mode', mode)
  params.set('limit', filters.limit.trim() || '100')

  if (mode === 'basic') {
    if (filters.cityId.trim()) params.set('cityId', filters.cityId.trim())
    if (filters.categoryId.trim()) {
      params.set('categoryId', resolveCategoryQuery(filters.categoryId))
    }
    if (filters.search.trim()) params.set('search', filters.search.trim())
    if (filters.minPrice.trim()) params.set('minPrice', filters.minPrice.trim())
    if (filters.maxPrice.trim()) params.set('maxPrice', filters.maxPrice.trim())
    return
  }

  const rules = normalizeAdvancedRules(advanced).map(({ column, operator, value }) => ({
    column,
    operator,
    value,
  }))
  if (rules.length > 0) params.set('rules', JSON.stringify(rules))
}

function eventsApiPath(
  path: '/api/events' | '/api/events/count',
  mode: FilterMode,
  filters: DebugFilters,
  advanced: AdvancedCondition[],
): string {
  const params = new URLSearchParams()
  appendEventsQueryParams(params, mode, filters, advanced)
  const query = params.toString()
  const base = apiBase()
  const fullPath = `${path}${query ? `?${query}` : ''}`
  if (!base) return fullPath
  return `${base}${fullPath}`
}

function isMissingValue(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim().length === 0)
}

function tursoExtraColumnKeys(row: Record<string, unknown>): string[] {
  const known = new Set<string>(TURSO_EVENT_SCHEMA_FIELDS)
  return Object.keys(row)
    .filter((key) => !known.has(key))
    .sort((a, b) => a.localeCompare(b))
}

/** Known Turso fields first, then any extra keys present on the row (e.g. live DB drift). */
function tursoColumnKeysFromRows(rows: EventRow[]): string[] {
  const extra = new Set<string>()
  for (const { raw } of rows) {
    for (const key of tursoExtraColumnKeys(raw)) extra.add(key)
  }
  return [...TURSO_EVENT_SCHEMA_FIELDS, ...extra]
}

function tableColumnsWithThumb(rows: EventRow[]): string[] {
  const cols = tursoColumnKeysFromRows(rows)
  const eventIdIdx = cols.indexOf('event_id')
  const insertAt = eventIdIdx >= 0 ? eventIdIdx + 1 : 0
  return [...cols.slice(0, insertAt), TABLE_THUMB_COLUMN, ...cols.slice(insertAt)]
}

function tableColumnHeaderLabel(col: string): string {
  return col === TABLE_THUMB_COLUMN ? 'Thumb' : col
}

function firstImageUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveTableThumbUrl(
  raw: Record<string, unknown>,
  item: EventItem,
  failedImageUrls: Set<string> = new Set(),
): string {
  return resolveListImage(raw, item, failedImageUrls).url
}

function imageUrlsForRow(row: EventRow): string[] {
  const { raw, item } = row
  const urls: string[] = []
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackImg = firstImageUrl(raw.fallback_event_img)
  const placeholder = item.image?.trim() ?? ''

  if (eventImg) {
    urls.push(eventImg)
    if (isSplashImageUrl(eventImg)) urls.push(splashImageForEventRow(raw, item))
  }
  if (fallbackImg) urls.push(fallbackImg)
  if (placeholder) urls.push(placeholder)

  return [...new Set(urls.filter(Boolean))]
}

function rowHasFailedImageLoad(row: EventRow, failedImageUrls: Set<string>): boolean {
  if (failedImageUrls.size === 0) return false

  const displayUrl = resolveListImage(row.raw, row.item, failedImageUrls).url
  if (displayUrl) return failedImageUrls.has(displayUrl)

  const candidates = imageUrlsForRow(row)
  if (candidates.length === 0) return false
  return candidates.every((url) => failedImageUrls.has(url))
}

type RenderedImageSource = 'event-img' | 'fallback-img' | 'splash-img' | null

function sourceForEventImg(url: string): Extract<RenderedImageSource, 'event-img' | 'splash-img'> {
  return isSplashImageUrl(url) ? 'splash-img' : 'event-img'
}

function imageSourcePillClassName(
  active: boolean,
  available: boolean,
  variant?: 'failed',
): string {
  return [
    'event-list-image-source-pill',
    variant === 'failed' ? 'event-list-image-source-pill--failed' : '',
    active ? 'is-active' : '',
    !available ? 'is-unavailable' : '',
    available && !active ? 'is-standby' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function imageSourcePillTitle(
  label: string,
  active: boolean,
  available: boolean,
): string {
  if (!available) return `${label}: not available for this event`
  if (active) return `${label}: currently shown on this card`
  return `${label}: available as backup (not shown right now)`
}

function rowMatchesImageSourceFilter(
  row: EventRow,
  filter: ImageSourceFilter,
  failedImageUrls: Set<string>,
): boolean {
  if (filter === 'all') return true
  if (filter === 'failed-load') return rowHasFailedImageLoad(row, failedImageUrls)

  return resolveListImage(row.raw, row.item, failedImageUrls).source === filter
}

function resolveListImage(
  raw: Record<string, unknown>,
  item: EventItem,
  failedImageUrls: Set<string>,
): { url: string; source: RenderedImageSource } {
  const eventImg = firstImageUrl(raw.event_img)
  const fallbackImg = firstImageUrl(raw.fallback_event_img)

  if (eventImg && !failedImageUrls.has(eventImg)) {
    if (isSplashImageUrl(eventImg)) {
      const splashImg = splashImageForEventRow(raw, item)
      if (!failedImageUrls.has(splashImg)) {
        return { url: splashImg, source: 'splash-img' }
      }
    } else {
      return { url: eventImg, source: sourceForEventImg(eventImg) }
    }
  }

  if (fallbackImg && !failedImageUrls.has(fallbackImg)) {
    return { url: fallbackImg, source: 'fallback-img' }
  }

  const placeholder = item.image?.trim() ?? ''
  if (placeholder && !failedImageUrls.has(placeholder)) {
    return {
      url: placeholder,
      source: isSplashImageUrl(placeholder) ? 'splash-img' : null,
    }
  }

  return { url: '', source: null }
}

function EventListCardImage({
  url,
  onLoad,
  onError,
}: {
  url: string
  onLoad: (url: string) => void
  onError: (url: string) => void
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useLayoutEffect(() => {
    setLoaded(false)
    setFailed(false)
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
      onLoad(url)
    }
  }, [onLoad, url])

  const showLoader = !loaded && !failed

  return (
    <>
      {showLoader ? (
        <div className="event-list-thumb-loading" aria-live="polite" aria-busy="true">
          <div className="event-list-thumb-loading-shimmer" aria-hidden="true" />
          <div className="event-list-thumb-loading-spinner" aria-hidden="true" />
          <span className="event-list-thumb-loading-label">Loading image…</span>
        </div>
      ) : null}
      <img
        ref={imgRef}
        src={url}
        alt=""
        className={['event-list-thumb', loaded ? 'is-loaded' : 'is-loading'].filter(Boolean).join(' ')}
        loading="lazy"
        decoding="async"
        onLoad={() => {
          setLoaded(true)
          onLoad(url)
        }}
        onError={() => {
          setFailed(true)
          onError(url)
        }}
      />
    </>
  )
}

function EventListTableThumb({
  url,
  title,
  href,
  onLoad,
  onError,
}: {
  url: string
  title: string
  href: string
  onLoad: (url: string) => void
  onError: (url: string) => void
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)

  useLayoutEffect(() => {
    setLoaded(false)
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
      onLoad(url)
    }
  }, [onLoad, url])

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="event-list-table-img-link"
      title={title}
    >
      <span className="event-list-table-thumb-frame">
        {!loaded ? <span className="event-list-table-thumb-loading" aria-hidden="true" /> : null}
        <img
          ref={imgRef}
          src={url}
          alt=""
          className={['event-list-table-thumb', loaded ? 'is-loaded' : 'is-loading'].filter(Boolean).join(' ')}
          loading="lazy"
          decoding="async"
          onLoad={() => {
            setLoaded(true)
            onLoad(url)
          }}
          onError={() => onError(url)}
        />
      </span>
    </a>
  )
}

function renderThumbCell(
  raw: Record<string, unknown>,
  item: EventItem,
  failedImageUrls: Set<string>,
  onImageError: (url: string) => void,
  onImageLoad: (url: string) => void,
): ReactNode {
  const url = resolveTableThumbUrl(raw, item, failedImageUrls)
  if (!url) return <span className="event-list-table-empty">-</span>
  const href =
    typeof raw.source_url === 'string' && raw.source_url.trim() ? raw.source_url.trim() : url
  return (
    <EventListTableThumb
      url={url}
      title={item.title || 'Event'}
      href={href}
      onLoad={onImageLoad}
      onError={onImageError}
    />
  )
}

function tursoSchemaRows(row: Record<string, unknown>): Array<{ key: string; value: unknown }> {
  const keys = [...TURSO_EVENT_SCHEMA_FIELDS, ...tursoExtraColumnKeys(row)]
  return keys.map((key) => ({
    key,
    value: row[key],
  }))
}

const WIDE_TURSO_FIELDS = new Set([
  'title',
  'location',
  'address',
  'the_experience',
  'taste_and_recommendations',
  'vibe_tags',
  'source_url',
  'event_img',
  'fallback_event_img',
])

const WRAP_TURSO_FIELDS = new Set(['event_datetime', 'event_time_raw', 'ingestion_datetime'])

const TURSO_FACT_ROW_GROUPS = [
  {
    id: 'datetime',
    className: 'event-list-fact-pair event-list-fact-pair--triple',
    keys: ['event_datetime', 'event_time_raw', 'ingestion_datetime'],
  },
  {
    id: 'taste-vibe',
    className: 'event-list-fact-stack',
    keys: ['vibe_tags', 'taste_and_recommendations'],
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

const TURSO_FACT_GROUP_BY_KEY = new Map<string, (typeof TURSO_FACT_ROW_GROUPS)[number]>(
  TURSO_FACT_ROW_GROUPS.flatMap((group) => group.keys.map((key) => [key, group] as const)),
)

function tursoFieldLabel(key: string): string {
  return key.replace(/_/g, ' ')
}

function renderTursoFactValue(key: string, value: unknown): ReactNode {
  if (key === 'category' || key === 'vibe_tags') {
    const tags = parseCategoryTags(value)
    if (tags.length === 0) return <strong>—</strong>
    return (
      <div className="event-list-category-tags">
        {tags.map((tag) => (
          <span key={tag} className="event-list-category-tag">
            {tag}
          </span>
        ))}
      </div>
    )
  }

  if (key === 'source_url' && typeof value === 'string' && value.trim()) {
    const url = value.trim()
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="event-list-fact-link"
        title={url}
      >
        {url}
      </a>
    )
  }

  if (isMissingValue(value)) return <strong>—</strong>

  const text = formatRawValue(value)
  const valueClass = [
    WIDE_TURSO_FIELDS.has(key) ? 'event-list-fact-value--wide' : '',
    WRAP_TURSO_FIELDS.has(key) ? 'event-list-fact-value--wrap' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <strong className={valueClass || undefined} title={text}>
      {text}
    </strong>
  )
}

function tursoFactTileClassName(key: string, value: unknown): string {
  const tagged = key === 'category' || key === 'vibe_tags'
  const missing =
    isMissingValue(value) || (tagged && parseCategoryTags(value).length === 0)
  const wide = WIDE_TURSO_FIELDS.has(key)
  const priceMissing =
    missing &&
    (key === 'min_price' ||
      key === 'max_price' ||
      key === 'ticket_price' ||
      key === 'price')

  return [
    'event-list-fact',
    missing ? 'event-list-fact--missing' : '',
    priceMissing ? 'event-list-fact--price' : '',
    WRAP_TURSO_FIELDS.has(key) ? 'event-list-fact--wrap' : '',
    wide || tagged ? 'event-list-fact--wide' : '',
    tagged ? 'event-list-fact--tags' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function renderTursoFactTile(key: string, value: unknown): ReactNode {
  return (
    <div key={`turso-${key}`} className={tursoFactTileClassName(key, value)}>
      <span>
        <small>{tursoFieldLabel(key)}</small>
        {renderTursoFactValue(key, value)}
      </span>
    </div>
  )
}

function renderTursoFacts(schemaRows: Array<{ key: string; value: unknown }>): ReactNode {
  const rows = schemaRows.filter(({ key }) => key !== 'event_id')
  const valueByKey = new Map(rows.map(({ key, value }) => [key, value]))
  const renderedGroups = new Set<string>()
  const nodes: ReactNode[] = []

  for (const { key, value } of rows) {
    const group = TURSO_FACT_GROUP_BY_KEY.get(key)
    if (group) {
      if (renderedGroups.has(group.id)) continue
      renderedGroups.add(group.id)
      nodes.push(
        <div key={`turso-${group.id}`} className={group.className}>
          {group.keys.map((groupKey) =>
            renderTursoFactTile(groupKey, valueByKey.get(groupKey)),
          )}
        </div>,
      )
      continue
    }

    nodes.push(renderTursoFactTile(key, value))
  }

  return nodes
}

function renderTableCell(key: string, value: unknown): ReactNode {
  if (isMissingValue(value)) {
    return <span className="event-list-table-empty">-</span>
  }

  if (key === 'source_url' && typeof value === 'string') {
    const url = value.trim()
    if (!url) return <span className="event-list-table-empty">-</span>
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="event-list-source event-list-table-link"
        title={url}
      >
        {url}
      </a>
    )
  }

  if (key === 'event_img' && typeof value === 'string' && value.trim()) {
    const url = value.trim()
    return (
      <a href={url} target="_blank" rel="noreferrer" className="event-list-table-img-link" title={url}>
        <img src={url} alt="" className="event-list-table-thumb" loading="lazy" />
      </a>
    )
  }

  if (key === 'fallback_event_img') {
    const label =
      typeof value === 'string'
        ? value.length > 48
          ? `${value.slice(0, 48)}…`
          : value
        : '(blob)'
    return (
      <span className="event-list-table-cell-text event-list-table-cell-text--muted" title={formatRawValue(value)}>
        {label}
      </span>
    )
  }

  const text = formatRawValue(value)
  if (key === 'event_id') {
    return (
      <span className="event-list-table-cell-text event-list-table-cell-text--id" title={text}>
        {text}
      </span>
    )
  }

  if (key === 'title') {
    return (
      <span className="event-list-table-cell-text event-list-table-cell-text--title" title={text}>
        {text}
      </span>
    )
  }

  if (key === 'the_experience') {
    return (
      <span className="event-list-table-cell-text event-list-table-cell-text--experience" title={text}>
        {text}
      </span>
    )
  }

  if (text.length > 160) {
    return (
      <span className="event-list-table-cell-text" title={text}>
        {text.slice(0, 160)}…
      </span>
    )
  }

  return <span className="event-list-table-cell-text">{text}</span>
}

function formatRawValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function normalizeComparable(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim().toLowerCase()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase()
  return JSON.stringify(value).toLowerCase()
}

function numericComparable(value: unknown): number | null {
  if (value == null || value === '') return null
  const text = typeof value === 'number' ? String(value) : String(value).trim()
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

function dateComparable(value: unknown): number | null {
  if (value == null || value === '') return null
  const numeric = numericComparable(value)
  if (numeric != null) {
    const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000
    return Number.isFinite(ms) ? ms : null
  }

  const parsed = Date.parse(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

function compareTableValues(a: unknown, b: unknown): number {
  const aMissing = isMissingValue(a)
  const bMissing = isMissingValue(b)
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1

  const aNumeric = numericComparable(a)
  const bNumeric = numericComparable(b)
  if (aNumeric != null && bNumeric != null) return aNumeric - bNumeric

  const aDate = dateComparable(a)
  const bDate = dateComparable(b)
  if (aDate != null && bDate != null) return aDate - bDate

  return formatRawValue(a).localeCompare(formatRawValue(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function rowMatchesTableFilters(row: EventRow, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([column, rawQuery]) => {
    const query = rawQuery.trim().toLowerCase()
    if (!query) return true
    return normalizeComparable(row.raw[column]).includes(query)
  })
}

export function EventListPage() {
  const [rows, setRows] = useState<EventRow[] | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [draftFilters, setDraftFilters] = useState<DebugFilters>(DEFAULT_DEBUG_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<DebugFilters>(DEFAULT_DEBUG_FILTERS)
  const [appliedFilterMode, setAppliedFilterMode] = useState<FilterMode>('basic')
  const [filterEditorMode, setFilterEditorMode] = useState<FilterMode>('basic')
  const [imageSourceFilter, setImageSourceFilter] = useState<ImageSourceFilter>('all')
  const [draftAdvanced, setDraftAdvanced] = useState<AdvancedCondition[]>([
    DEFAULT_ADVANCED_CONDITION,
  ])
  const [appliedAdvanced, setAppliedAdvanced] = useState<AdvancedCondition[]>([])
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set())
  const [globalFactsExpanded, setGlobalFactsExpanded] = useState(true)
  const [collapsedFactsCards, setCollapsedFactsCards] = useState<Set<string>>(() => new Set())
  const [tableSort, setTableSort] = useState<TableSortState>(null)
  const [tableColumnFilters, setTableColumnFilters] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const toggleAllCardFacts = useCallback(() => {
    setGlobalFactsExpanded((current) => {
      const next = !current
      if (next) setCollapsedFactsCards(new Set())
      return next
    })
  }, [])

  const toggleCardFacts = useCallback((cardKey: string) => {
    setCollapsedFactsCards((current) => {
      const next = new Set(current)
      if (next.has(cardKey)) next.delete(cardKey)
      else next.add(cardKey)
      return next
    })
  }, [])

  const markImageUrlFailed = useCallback((url: string) => {
    if (!url.trim()) return
    setFailedImageUrls((current) => {
      if (current.has(url)) return current
      const next = new Set(current)
      next.add(url)
      return next
    })
  }, [])

  const markImageUrlLoaded = useCallback((url: string) => {
    if (!url.trim()) return
    setFailedImageUrls((current) => {
      if (!current.has(url)) return current
      const next = new Set(current)
      next.delete(url)
      return next
    })
  }, [])

  const toggleTableSort = useCallback((column: string) => {
    if (column === TABLE_THUMB_COLUMN) return
    setTableSort((current) => {
      if (!current || current.column !== column) return { column, direction: 'asc' }
      if (current.direction === 'asc') return { column, direction: 'desc' }
      return null
    })
  }, [])

  const updateTableColumnFilter = useCallback((column: string, value: string) => {
    setTableColumnFilters((current) => {
      const next = { ...current }
      const trimmed = value.trim()
      if (trimmed) next[column] = value
      else delete next[column]
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, countRes] = await Promise.all([
        fetch(eventsApiPath('/api/events', appliedFilterMode, appliedFilters, appliedAdvanced), {
          credentials: 'include',
        }),
        fetch(eventsApiPath('/api/events/count', appliedFilterMode, appliedFilters, appliedAdvanced), {
          credentials: 'include',
        }),
      ])
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setRows(null)
        setTotalCount(null)
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const data = (await res.json()) as Record<string, unknown>[]
      if (!Array.isArray(data)) {
        setRows(null)
        setTotalCount(null)
        setError('Invalid response: expected a JSON array')
        return
      }
      if (countRes.ok) {
        const countData = (await countRes.json()) as { total?: unknown }
        const n = Number(countData.total ?? 0)
        setTotalCount(Number.isFinite(n) ? n : null)
      } else {
        setTotalCount(null)
      }
      setRows(
        data.map((r) => ({
          item: mapRemoteEventRowToEventItem(r),
          raw: r,
          sourceUrl: typeof r.source_url === 'string' ? r.source_url : undefined,
        })),
      )
    } catch (e) {
      setRows(null)
      setTotalCount(null)
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [appliedAdvanced, appliedFilterMode, appliedFilters])

  useEffect(() => {
    void load()
  }, [load])

  const applyBasicFilters = useCallback(() => {
    setAppliedFilterMode('basic')
    setAppliedFilters({ ...draftFilters, limit: draftFilters.limit.trim() || '100' })
    setAppliedAdvanced([])
    setFailedImageUrls(new Set())
  }, [draftFilters])

  const applyAdvancedFilters = useCallback(() => {
    setAppliedFilterMode('advanced')
    setAppliedFilters({
      ...DEFAULT_DEBUG_FILTERS,
      limit: draftFilters.limit.trim() || '100',
    })
    setAppliedAdvanced(normalizeAdvancedRules(draftAdvanced))
    setFailedImageUrls(new Set())
  }, [draftAdvanced, draftFilters.limit])

  const resetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_DEBUG_FILTERS)
    setAppliedFilters(DEFAULT_DEBUG_FILTERS)
    setAppliedFilterMode('basic')
    setFilterEditorMode('basic')
    setImageSourceFilter('all')
    setDraftAdvanced([{ ...DEFAULT_ADVANCED_CONDITION, id: `rule-${Date.now()}` }])
    setAppliedAdvanced([])
    setFailedImageUrls(new Set())
    setTableSort(null)
    setTableColumnFilters({})
  }, [])

  const imageSourceCounts = useMemo(() => {
    const counts = new Map<ImageSourceFilter, number>()
    for (const option of IMAGE_SOURCE_FILTERS) counts.set(option.id, 0)
    counts.set('all', rows?.length ?? 0)

    for (const row of rows ?? []) {
      for (const option of IMAGE_SOURCE_FILTERS) {
        if (option.id === 'all') continue
        if (rowMatchesImageSourceFilter(row, option.id, failedImageUrls)) {
          counts.set(option.id, (counts.get(option.id) ?? 0) + 1)
        }
      }
    }

    return counts
  }, [failedImageUrls, rows])
  const imageFilteredRows = useMemo(
    () =>
      (rows ?? []).filter((row) =>
        rowMatchesImageSourceFilter(row, imageSourceFilter, failedImageUrls),
      ),
    [failedImageUrls, imageSourceFilter, rows],
  )
  const totalRows = imageFilteredRows.length
  const cityQuery = draftFilters.cityId.trim().toLowerCase()
  const filteredCityOptions = CITY_OPTIONS.filter((city) => {
    if (!cityQuery) return true
    return (
      city.id.toLowerCase().includes(cityQuery) ||
      city.name.toLowerCase().includes(cityQuery) ||
      city.regionLabel.toLowerCase().includes(cityQuery)
    )
  })
  const cityGroups = LOCATION_REGIONS.map((region) => ({
    region,
    options: filteredCityOptions.filter((city) => city.regionId === region.id),
  })).filter((group) => group.options.length > 0)
  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const city of CITY_OPTIONS) counts.set(city.id, 0)
    for (const row of rows ?? []) {
      const key = normalizeComparable(row.raw.location_city_id)
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [rows])
  const totalCityCount = rows?.length ?? 0
  const categoryQuery = draftFilters.categoryId.trim().toLowerCase()
  const filteredCategoryOptions = CATEGORY_OPTIONS.filter((option) => {
    if (!categoryQuery) return true
    return (
      option.id.toLowerCase().includes(categoryQuery) ||
      option.label.toLowerCase().includes(categoryQuery) ||
      option.queryValue.toLowerCase().includes(categoryQuery)
    )
  })
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const option of CATEGORY_OPTIONS) counts.set(option.id, 0)
    for (const row of rows ?? []) {
      const matchedId = findMatchedCategoryOptionId(row.raw.category)
      if (matchedId) counts.set(matchedId, (counts.get(matchedId) ?? 0) + 1)
      else if (!isMissingValue(row.raw.category)) counts.set(OTHERS_CATEGORY_VALUE, (counts.get(OTHERS_CATEGORY_VALUE) ?? 0) + 1)
    }
    return { counts }
  }, [rows])
  const totalCategoryCount = rows?.length ?? 0
  const advancedValueOptions = useMemo(() => {
    const out: Partial<Record<(typeof TURSO_EVENT_SCHEMA_FIELDS)[number], string[]>> = {}
    if (!rows) return out
    for (const col of TURSO_EVENT_SCHEMA_FIELDS) {
      const values = Array.from(
        new Set(
          rows
            .map((row) => row.raw[col])
            .filter((v) => !isMissingValue(v))
            .map((v) => formatRawValue(v)),
        ),
      ).slice(0, 80)
      out[col] = values
    }
    return out
  }, [rows])
  const tableColumns = useMemo(
    () => (imageFilteredRows.length > 0 ? tableColumnsWithThumb(imageFilteredRows) : []),
    [imageFilteredRows],
  )
  const tableFilteredRows = useMemo(
    () => imageFilteredRows.filter((row) => rowMatchesTableFilters(row, tableColumnFilters)),
    [imageFilteredRows, tableColumnFilters],
  )
  const sortedTableRows = useMemo(() => {
    if (!tableSort) return tableFilteredRows
    return tableFilteredRows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const comparison = compareTableValues(a.row.raw[tableSort.column], b.row.raw[tableSort.column])
        const directed = tableSort.direction === 'asc' ? comparison : -comparison
        return directed || a.index - b.index
      })
      .map(({ row }) => row)
  }, [tableFilteredRows, tableSort])
  const activeTableFilterCount = Object.values(tableColumnFilters).filter((value) => value.trim()).length
  return (
    <div
      className="event-list-root"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 'max(1rem, env(safe-area-inset-top)) 1rem 2rem',
      }}
    >
      <div className="event-list-inner">
        <header className="event-list-header">
          <div className="event-list-title-row">
            <Link to="/" className="event-list-back" aria-label="Back to app">
              <ArrowLeft size={20} strokeWidth={2} />
            </Link>
            <div>
              <h1 className="event-list-h1">Events</h1>
              <p className="event-list-sub">
                From <code className="event-list-code">/api/events</code> (Turso)
                {` · ${appliedFilterMode} filters`}
                {rows
                  ? totalCount != null
                    ? ` · ${totalCount} total${rows.length !== totalCount ? ` · ${rows.length} loaded` : ''}`
                    : ` · ${rows.length} loaded`
                  : ''}
                {rows && imageSourceFilter !== 'all' ? ` · ${totalRows} shown` : ''}
              </p>
            </div>
          </div>
          <div className="event-list-header-actions">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="event-list-refresh"
            >
              <RefreshCw size={16} className={loading ? 'spin' : undefined} />
              Refresh
            </button>
          </div>
        </header>
        <section className="event-list-filters" aria-label="Debug filters">
          <div className="event-list-filters-toolbar">
            <div className="event-list-filter-mode-toggle" role="group" aria-label="Search mode">
              <button
                type="button"
                className={`event-list-filter-mode-btn${filterEditorMode === 'basic' ? ' is-active' : ''}`}
                onClick={() => setFilterEditorMode('basic')}
              >
                Basic search
              </button>
              <button
                type="button"
                className={`event-list-filter-mode-btn${filterEditorMode === 'advanced' ? ' is-active' : ''}`}
                onClick={() => setFilterEditorMode('advanced')}
              >
                Advanced search
              </button>
            </div>
            <div className="event-list-filters-toolbar-right">
              <label className="event-list-filter-label event-list-filter-label--limit">
                <span>limit</span>
                <input
                  className="event-list-filter-input"
                  value={draftFilters.limit}
                  inputMode="numeric"
                  placeholder="100"
                  onChange={(e) => setDraftFilters((f) => ({ ...f, limit: e.target.value }))}
                />
              </label>
              <div className="event-list-view-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={`event-list-view-btn${viewMode === 'list' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
                <button
                  type="button"
                  className={`event-list-view-btn${viewMode === 'table' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          <div className="event-list-image-filterbar" role="group" aria-label="Image source filter">
            <span className="event-list-image-filter-label">Image source</span>
            {IMAGE_SOURCE_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={[
                  'event-list-image-filter-btn',
                  option.id === 'failed-load' ? 'event-list-image-filter-btn--failed' : '',
                  imageSourceFilter === option.id ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setImageSourceFilter(option.id)
                }}
              >
                {option.label}
                <span>{imageSourceCounts.get(option.id) ?? 0}</span>
              </button>
            ))}
          </div>

          {filterEditorMode === 'basic' ? (
          <div className="event-list-filters-panel">
            <div className="event-list-filters-grid">
            <label className="event-list-filter-label">
              <span>cityId</span>
              <div
                className="event-list-combobox"
                onBlur={() => setTimeout(() => setCityDropdownOpen(false), 100)}
              >
                <input
                  className="event-list-filter-input event-list-combobox-input"
                  value={draftFilters.cityId}
                  placeholder="type city id/name or pick below"
                  onFocus={() => setCityDropdownOpen(true)}
                  onChange={(e) => {
                    setDraftFilters((f) => ({ ...f, cityId: e.target.value }))
                    setCityDropdownOpen(true)
                  }}
                />
                {draftFilters.cityId.trim().length > 0 ? (
                  <button
                    type="button"
                    className="event-list-combobox-clear"
                    onClick={() => {
                      setDraftFilters((f) => ({ ...f, cityId: '' }))
                      setCityDropdownOpen(false)
                    }}
                    aria-label="Clear city filter"
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  className="event-list-combobox-toggle"
                  onClick={() => setCityDropdownOpen((v) => !v)}
                  aria-label="Toggle city options"
                >
                  ▾
                </button>
                {cityDropdownOpen && (
                  <div className="event-list-combobox-menu">
                    <button
                      type="button"
                      className={`event-list-combobox-option${draftFilters.cityId === '' ? ' is-active' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setDraftFilters((f) => ({ ...f, cityId: '' }))
                        setCityDropdownOpen(false)
                      }}
                    >
                      All cities ({totalCityCount})
                    </button>
                    {cityGroups.length === 0 ? (
                      <div className="event-list-combobox-empty">No city matches your search.</div>
                    ) : (
                      cityGroups.map(({ region, options }) => (
                        <div key={region.id} className="event-list-combobox-group">
                          <div className="event-list-combobox-group-title">{region.label}</div>
                          {options.map((city) => (
                            <button
                              type="button"
                              key={city.id}
                              className={`event-list-combobox-option${draftFilters.cityId === city.id ? ' is-active' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                setDraftFilters((f) => ({ ...f, cityId: city.id }))
                                setCityDropdownOpen(false)
                              }}
                            >
                              <span>{city.name} ({cityCounts.get(city.id) ?? 0})</span>
                              <code>{city.id}</code>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </label>
            <label className="event-list-filter-label">
              <span>categoryId</span>
              <div
                className="event-list-combobox"
                onBlur={() => setTimeout(() => setCategoryDropdownOpen(false), 100)}
              >
                <input
                  className="event-list-filter-input event-list-combobox-input"
                  value={draftFilters.categoryId}
                  placeholder="type category id/label or pick below"
                  onFocus={() => setCategoryDropdownOpen(true)}
                  onChange={(e) => {
                    setDraftFilters((f) => ({ ...f, categoryId: e.target.value }))
                    setCategoryDropdownOpen(true)
                  }}
                />
                {draftFilters.categoryId.trim().length > 0 ? (
                  <button
                    type="button"
                    className="event-list-combobox-clear"
                    onClick={() => {
                      setDraftFilters((f) => ({ ...f, categoryId: '' }))
                      setCategoryDropdownOpen(false)
                    }}
                    aria-label="Clear category filter"
                  >
                    ×
                  </button>
                ) : null}
                <button
                  type="button"
                  className="event-list-combobox-toggle"
                  onClick={() => setCategoryDropdownOpen((v) => !v)}
                  aria-label="Toggle category options"
                >
                  ▾
                </button>
                {categoryDropdownOpen && (
                  <div className="event-list-combobox-menu">
                    {filteredCategoryOptions.length === 0 ? (
                      <div className="event-list-combobox-empty">No category matches your search.</div>
                    ) : (
                      filteredCategoryOptions.map((option) => (
                        <button
                          type="button"
                          key={option.id || 'all-categories'}
                          className={`event-list-combobox-option${draftFilters.categoryId === (option.queryValue || option.id) ? ' is-active' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setDraftFilters((f) => ({ ...f, categoryId: option.queryValue || option.id }))
                            setCategoryDropdownOpen(false)
                          }}
                        >
                          <span>
                            {option.id === ''
                              ? `${option.label} (${totalCategoryCount})`
                              : `${option.label} (${categoryCounts.counts.get(option.id) ?? 0})`}
                          </span>
                          <code>{option.id || 'all'}</code>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </label>
            <label className="event-list-filter-label event-list-filter-label--wide">
              <span>search(raw JSON)</span>
              <input
                className="event-list-filter-input"
                value={draftFilters.search}
                placeholder="keyword across all Turso fields"
                onChange={(e) => setDraftFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </label>
            <label className="event-list-filter-label">
              <span>min price</span>
              <input
                className="event-list-filter-input"
                value={draftFilters.minPrice}
                inputMode="decimal"
                placeholder="0.00"
                onChange={(e) => setDraftFilters((f) => ({ ...f, minPrice: e.target.value }))}
              />
            </label>
            <label className="event-list-filter-label">
              <span>max price</span>
              <input
                className="event-list-filter-input"
                value={draftFilters.maxPrice}
                inputMode="decimal"
                placeholder="50.00"
                onChange={(e) => setDraftFilters((f) => ({ ...f, maxPrice: e.target.value }))}
              />
            </label>
          </div>
          </div>
          ) : (
          <div className="event-list-filters-panel event-list-advanced">
            {draftAdvanced.map((rule) => {
              const listId = `event-list-values-${rule.id}`
              const disableValue = rule.operator === 'isnull' || rule.operator === 'notnull'
              return (
                <div key={rule.id} className="event-list-advanced-row">
                  <select
                    className="event-list-filter-input event-list-filter-select"
                    value={rule.column}
                    onChange={(e) =>
                      setDraftAdvanced((rows) =>
                        rows.map((r) =>
                          r.id === rule.id
                            ? { ...r, column: e.target.value as AdvancedCondition['column'] }
                            : r,
                        ),
                      )
                    }
                  >
                    {TURSO_EVENT_SCHEMA_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {field}
                      </option>
                    ))}
                  </select>
                  <select
                    className="event-list-filter-input event-list-filter-select"
                    value={rule.operator}
                    onChange={(e) =>
                      setDraftAdvanced((rows) =>
                        rows.map((r) =>
                          r.id === rule.id
                            ? { ...r, operator: e.target.value as FilterOperator }
                            : r,
                        ),
                      )
                    }
                  >
                    {OPERATOR_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="event-list-filter-input"
                    list={listId}
                    value={rule.value}
                    placeholder={disableValue ? 'no value needed' : 'value'}
                    disabled={disableValue}
                    onChange={(e) =>
                      setDraftAdvanced((rows) =>
                        rows.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r)),
                      )
                    }
                  />
                  <datalist id={listId}>
                    {(advancedValueOptions[rule.column] ?? []).map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    className="event-list-filter-btn ghost"
                    disabled={draftAdvanced.length <= 1}
                    onClick={() =>
                      setDraftAdvanced((rows) => rows.filter((r) => r.id !== rule.id))
                    }
                  >
                    Remove
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              className="event-list-filter-btn ghost"
              onClick={() =>
                setDraftAdvanced((rows) => [
                  ...rows,
                  {
                    ...DEFAULT_ADVANCED_CONDITION,
                    id: `rule-${Date.now()}-${rows.length}`,
                  },
                ])
              }
            >
              + Add rule
            </button>
          </div>
          )}

          <div className="event-list-filter-actions">
            <button
              type="button"
              className="event-list-filter-btn"
              onClick={() => {
                if (filterEditorMode === 'basic') applyBasicFilters()
                else applyAdvancedFilters()
              }}
            >
              Apply filters
            </button>
            <button type="button" className="event-list-filter-btn ghost" onClick={resetFilters}>
              Reset all
            </button>
          </div>
        </section>

        {error && (
          <div className="event-list-alert" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <p className="event-list-h1" style={{ fontSize: '0.9rem' }}>
                Could not load events
              </p>
              <p className="event-list-muted" style={{ marginTop: '0.25rem' }}>
                {error}
              </p>
            </div>
          </div>
        )}

        {loading && !rows && !error && <p className="event-list-muted">Loading…</p>}

        {rows && rows.length === 0 && !loading && (
          <p className="event-list-muted">No events returned.</p>
        )}

        {rows && rows.length > 0 && totalRows === 0 && !loading && (
          <p className="event-list-muted">
            {imageSourceFilter === 'failed-load'
              ? 'No events with a broken visible image. Failed load only flags rows where the image on screen could not load.'
              : 'No events match the selected image source filter.'}
          </p>
        )}

        {rows && totalRows > 0 && viewMode === 'list' && (
          <>
            <div className="event-list-facts-toolbar">
              <span className="event-list-facts-toolbar-label">Override fields</span>
              <button
                type="button"
                className="event-list-filter-btn ghost"
                onClick={toggleAllCardFacts}
                aria-pressed={globalFactsExpanded}
              >
                {globalFactsExpanded ? 'Hide all' : 'Show all'}
              </button>
            </div>
            <ul className="event-list-list" aria-live="polite">
            {imageFilteredRows.map(({ item, raw }, idx) => {
              const eventId =
                typeof raw.event_id === 'string' && raw.event_id.trim()
                  ? raw.event_id
                  : item.id || ''
              const venueText = [item.venue, item.district].filter(Boolean).join(' · ') || 'Venue TBC'
              const schemaRows = tursoSchemaRows(raw)
              const resolvedImage = resolveListImage(
                raw,
                item,
                failedImageUrls,
              )
              const displayedImageSource = resolvedImage.source
              const eventImgAvailable =
                firstImageUrl(raw.event_img).length > 0 &&
                !isSplashImageUrl(firstImageUrl(raw.event_img))
              const fallbackImgAvailable =
                firstImageUrl(raw.fallback_event_img).length > 0
              const splashImgAvailable =
                (firstImageUrl(raw.event_img).length > 0 &&
                  isSplashImageUrl(firstImageUrl(raw.event_img))) ||
                isSplashImageUrl(item.image?.trim() ?? '')
              const eventRow: EventRow = { item, raw }
              const failedLoadActive = rowHasFailedImageLoad(eventRow, failedImageUrls)
              const failedLoadAvailable = imageUrlsForRow(eventRow).length > 0
              const image = resolvedImage.url
              const factsCardKey = eventId || `row-${idx}`
              const factsExpanded =
                globalFactsExpanded && !collapsedFactsCards.has(factsCardKey)
              const factsPanelId = `event-facts-${factsCardKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`

              return <li
                key={`${item.id ?? 'no-id'}-${idx}`}
                className="event-list-card"
              >
                <div className="event-list-row">
                  <div className="event-list-thumb-wrap">
                    {image ? (
                      <EventListCardImage
                        url={image}
                        onLoad={markImageUrlLoaded}
                        onError={markImageUrlFailed}
                      />
                    ) : (
                      <div className="event-list-thumb-empty">No image</div>
                    )}
                    <div className="event-list-image-source-row" aria-label="Image source">
                      <span
                        className={imageSourcePillClassName(
                          displayedImageSource === 'event-img',
                          eventImgAvailable,
                        )}
                        title={imageSourcePillTitle(
                          'event-img',
                          displayedImageSource === 'event-img',
                          eventImgAvailable,
                        )}
                      >
                        event-img
                      </span>
                      <span
                        className={imageSourcePillClassName(
                          displayedImageSource === 'fallback-img',
                          fallbackImgAvailable,
                        )}
                        title={imageSourcePillTitle(
                          'fallback-img',
                          displayedImageSource === 'fallback-img',
                          fallbackImgAvailable,
                        )}
                      >
                        fallback-img
                      </span>
                      <span
                        className={imageSourcePillClassName(
                          displayedImageSource === 'splash-img',
                          splashImgAvailable,
                        )}
                        title={imageSourcePillTitle(
                          'splash-img',
                          displayedImageSource === 'splash-img',
                          splashImgAvailable,
                        )}
                      >
                        splash-img
                      </span>
                      <span
                        className={imageSourcePillClassName(
                          failedLoadActive,
                          failedLoadAvailable,
                          'failed',
                        )}
                        title={
                          failedLoadActive
                            ? 'failed load: the visible image could not load'
                            : failedLoadAvailable
                              ? 'failed load: image loaded successfully'
                              : 'failed load: no image URL on this event'
                        }
                      >
                        failed load
                      </span>
                    </div>
                  </div>
                  <div className="event-list-body">
                    <h2 className="event-list-h2">{item.title || 'Untitled event'}</h2>
                    <p className="event-list-meta">{venueText}</p>

                    <div className="event-list-id-toolbar">
                      {eventId ? (
                        <div className="event-list-id-row">
                          <span>ID</span>
                          <code>{eventId}</code>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="event-list-filter-btn ghost event-list-facts-toggle"
                        onClick={() => toggleCardFacts(factsCardKey)}
                        aria-expanded={factsExpanded}
                        aria-controls={factsPanelId}
                      >
                        {factsExpanded ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    {factsExpanded ? (
                      <div
                        id={factsPanelId}
                        className="event-list-facts"
                        aria-label="All Turso fields"
                      >
                        {renderTursoFacts(schemaRows)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            })}
          </ul>
          </>
        )}
        {rows && totalRows > 0 && viewMode === 'table' && (
          <>
            <div className="event-list-table-toolbar">
              <span className="event-list-facts-toolbar-label">
                Table filters
                {activeTableFilterCount > 0 ? ` · ${activeTableFilterCount} active` : ''}
                {tableSort ? ` · sorted by ${tableSort.column} ${tableSort.direction}` : ''}
                {` · ${sortedTableRows.length}/${imageFilteredRows.length} shown`}
              </span>
              <div className="event-list-table-toolbar-actions">
                {tableSort ? (
                  <button
                    type="button"
                    className="event-list-filter-btn ghost"
                    onClick={() => setTableSort(null)}
                  >
                    Clear sort
                  </button>
                ) : null}
                {activeTableFilterCount > 0 ? (
                  <button
                    type="button"
                    className="event-list-filter-btn ghost"
                    onClick={() => setTableColumnFilters({})}
                  >
                    Clear table filters
                  </button>
                ) : null}
              </div>
            </div>
            <div className="event-list-table-wrap" aria-live="polite">
              <table className="event-list-table event-list-table--full">
                <thead>
                  <tr>
                    {tableColumns.map((col) => {
                      const sortable = col !== TABLE_THUMB_COLUMN
                      const sorted = tableSort?.column === col ? tableSort.direction : null
                      return (
                        <th
                          key={col}
                          data-col={col}
                          aria-sort={
                            sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : undefined
                          }
                        >
                          {sortable ? (
                            <button
                              type="button"
                              className="event-list-table-sort-btn"
                              onClick={() => toggleTableSort(col)}
                              title={`Sort by ${tableColumnHeaderLabel(col)}`}
                            >
                              <span>{tableColumnHeaderLabel(col)}</span>
                              <span className="event-list-table-sort-mark">
                                {sorted === 'asc' ? 'asc' : sorted === 'desc' ? 'desc' : 'sort'}
                              </span>
                            </button>
                          ) : (
                            <span className="event-list-table-heading-static">
                              {tableColumnHeaderLabel(col)}
                            </span>
                          )}
                          {sortable ? (
                            <input
                              className="event-list-table-filter-input"
                              value={tableColumnFilters[col] ?? ''}
                              placeholder="filter"
                              aria-label={`Filter ${tableColumnHeaderLabel(col)}`}
                              onChange={(e) => updateTableColumnFilter(col, e.target.value)}
                            />
                          ) : null}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedTableRows.length === 0 ? (
                    <tr>
                      <td className="event-list-table-empty-row" colSpan={tableColumns.length}>
                        No rows match the table filters.
                      </td>
                    </tr>
                  ) : (
                    sortedTableRows.map(({ item, raw }, idx) => (
                      <tr key={`${item.id || 'row'}-${idx}`}>
                        {tableColumns.map((col) => (
                          <td key={col} data-col={col}>
                            {col === TABLE_THUMB_COLUMN
                              ? renderThumbCell(
                                  raw,
                                  item,
                                  failedImageUrls,
                                  markImageUrlFailed,
                                  markImageUrlLoaded,
                                )
                              : renderTableCell(col, raw[col])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

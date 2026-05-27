export type Tab = 'discover' | 'ask' | 'plan' | 'favorites' | 'profile'
export type Theme = 'dark' | 'light'

export type GigEntry = {
  id: string
  venue: string
  when: string
  description: string
  attended: boolean
  images: string[]
}

export type EventItem = {
  id: string
  title: string
  venue: string
  district: string
  /** Legacy display label used by older app surfaces. Prefer `displayDateTimeLabel` for Discover. */
  time: string
  /** Machine-readable event datetime when available. */
  eventDateTime?: string | null
  /** User-facing date/time label such as `Tonight 22:30` or `Date TBA`. */
  displayDateTimeLabel?: string
  genre: string
  /** Plan explore category id: tech, food, ai, arts, climate, fitness, wellness, crypto */
  exploreCategoryId: string
  /** Matches `LocationCity.id` in `locationRegions.ts` (city / market). */
  locationCityId: string
  verified: number
  image: string
  host: string
  hostPrompt: string
  friendsGoing: number
  vibeTags: string[]
  ticketPrice: string
  /** Top-right BP badge on event sheet hero (optional). */
  bpReward?: number
  /** Top-right BUZZ % badge on event sheet hero (optional). */
  buzzPct?: number
  /** Venue latitude (optional — falls back to district centroid). */
  lat?: number
  /** Venue longitude (optional — falls back to district centroid). */
  lng?: number
  /** Source event page URL (when available). */
  sourceUrl?: string | null
}

/** Rich mock for the Plan tab event-detail layout (wireframe). */
export type PlanPageFriend = {
  id: string
  name: string
  avatar: string
  /** Orange ring (e.g. close friends). */
  ring?: boolean
}

/** Row in Plan tab “Past” list (gig history style). */
export type PlanPastEvent = {
  id: string
  title: string
  venue: string
  whenLabel: string
  image: string
}

export type PlanPageEvent = {
  /** Matches `EventItem.id` for upcoming (global sheet). Past rows use `past-*` ids. */
  eventId: string
  /** Source event page URL (when available). */
  sourceUrl?: string | null
  heroImage: string
  displayTitle: string
  artistLine: string
  genreTags: [string, string]
  venueLine: string
  /** Venue latitude for weather lookup (optional). */
  lat?: number
  /** Venue longitude for weather lookup (optional). */
  lng?: number
  /** Matches `LocationCity.id` for weather source selection. */
  locationCityId?: string
  /** Google Maps Embed/search query, usually venue + full address or future `place_id:...`. */
  mapQuery?: string
  timeRange: string
  /** Machine-readable event datetime for weather horizon checks. */
  eventDateTime?: string | null
  ticketPrice?: string
  aiVibeScore?: number | null
  eliteVerifiedCount: number
  eliteStackExtra: number
  experienceParts: {
    before: string
    emphasis: string
    after: string
  }
  audioPreviewLabel?: string | null
  audioCurrent?: string
  audioTotal?: string
  friendsAttendingCount: number
  friends: PlanPageFriend[]
}

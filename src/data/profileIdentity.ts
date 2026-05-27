import type { LucideIcon } from 'lucide-react'
import { Building2, Crown, Flame, Headphones, Moon, Music, Star, Trophy, Zap } from 'lucide-react'

export type TasteIdentityItem = {
  label: string
}

/** Profile section, full-screen list, and Settings — keep in sync. */
export const TASTE_AND_RECOMMENDATIONS_TITLE = 'Taste & recommendations'

/** Full taste map — profile preview shows a slice. */
export const tasteIdentityTags: TasteIdentityItem[] = [
  { label: 'DARK DISCO' },
  { label: 'MINIMAL TECHNO' },
  { label: 'INDUSTRIAL' },
  { label: 'EBM' },
  { label: 'POST-PUNK' },
  { label: 'ACID HOUSE' },
  { label: 'ITALO DISCO' },
  { label: 'NEW BEAT' },
  { label: 'SYNTHWAVE' },
  { label: 'TECH HOUSE' },
  { label: 'DEEP HOUSE' },
  { label: 'BREAKBEAT' },
  { label: 'DRUM & BASS' },
  { label: 'GABBER' },
]

export function getDefaultTasteIdentityItems(): TasteIdentityItem[] {
  return tasteIdentityTags.map((t) => ({ ...t }))
}

/** Row from `taste_categories` or session `taste_categories`. */
export type TasteCategoryRow = { label: string }

/** Catalog order; `saved` kept for API compatibility (ignored). */
export function mergeCatalogWithSavedTastes(
  catalog: TasteCategoryRow[],
  _saved: Array<{ label: string }> | null | undefined,
): TasteIdentityItem[] {
  const ordered = [...catalog].sort((a, b) => a.label.localeCompare(b.label))
  return ordered.map((row) => ({ label: row.label }))
}

/** Session hydration: prefer API catalog; if missing, still apply saved tastes from profile. */
export function buildTasteIdentityItemsFromSession(
  isRealUser: boolean,
  catalog: TasteCategoryRow[],
  saved: Array<{ label: string }> | null | undefined,
): TasteIdentityItem[] {
  if (!isRealUser) return getDefaultTasteIdentityItems()
  if (catalog.length > 0) {
    return mergeCatalogWithSavedTastes(catalog, saved)
  }
  const rawSaved = (saved ?? []).filter((s) => s?.label)
  if (rawSaved.length > 0) {
    const byLabel = new Map<string, TasteIdentityItem>()
    for (const s of rawSaved) {
      byLabel.set(s.label, { label: s.label })
    }
    for (const d of getDefaultTasteIdentityItems()) {
      if (!byLabel.has(d.label)) byLabel.set(d.label, d)
    }
    return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label))
  }
  return getDefaultTasteIdentityItems()
}

export type ReputationBadgeStatus = 'locked' | 'in_progress' | 'earned'

export type ReputationBadgeItem = {
  id: string
  code: string
  icon: LucideIcon
  label: string
  status: ReputationBadgeStatus
  unlockHint: string
  progressValue: number
  progressTarget: number
  earnedAt: string | null
}

export type ReputationBadgeApiRow = {
  id: string
  code: string
  name: string
  icon_key: string
  status: ReputationBadgeStatus
  unlock_hint: string
  progress_value: number
  progress_target: number
  earned_at: string | null
}

const defaultReputationIcon = Star

const reputationIconByKey: Record<string, LucideIcon> = {
  star: Star,
  'star-outline': Star,
  building2: Building2,
  moon: Moon,
  zap: Zap,
  trophy: Trophy,
  crown: Crown,
  flame: Flame,
  headphones: Headphones,
  music: Music,
}

/** Fallback list while backend data loads or is unavailable. */
export const reputationBadgesFallback: ReputationBadgeItem[] = [
  {
    id: 'first-checkin',
    code: 'first_checkin',
    icon: Star,
    label: 'FIRST\nCHECK-IN',
    status: 'earned',
    unlockHint: 'Attend your first gig to unlock this badge.',
    progressValue: 1,
    progressTarget: 1,
    earnedAt: null,
  },
  {
    id: 'city-curator',
    code: 'city_curator',
    icon: Building2,
    label: 'CITY\nCURATOR',
    status: 'locked',
    unlockHint: 'Attend 3 gigs in the same city.',
    progressValue: 0,
    progressTarget: 3,
    earnedAt: null,
  },
  {
    id: 'night-owl',
    code: 'night_owl',
    icon: Moon,
    label: 'NIGHT\nOWL',
    status: 'earned',
    unlockHint: 'Attend 5 gigs that start at 11 PM or later.',
    progressValue: 5,
    progressTarget: 5,
    earnedAt: null,
  },
  {
    id: 'streak-master',
    code: 'streak_master',
    icon: Zap,
    label: 'STREAK\nMASTER',
    status: 'locked',
    unlockHint: 'Attend gigs in 3 consecutive weeks.',
    progressValue: 0,
    progressTarget: 3,
    earnedAt: null,
  },
  {
    id: 'legend',
    code: 'legend',
    icon: Trophy,
    label: 'LEGEND',
    status: 'locked',
    unlockHint: 'Attend 50 gigs in total.',
    progressValue: 0,
    progressTarget: 50,
    earnedAt: null,
  },
  {
    id: 'scene-royalty',
    code: 'scene_royalty',
    icon: Crown,
    label: 'SCENE\nROYALTY',
    status: 'locked',
    unlockHint: 'Earn 5 reputation badges.',
    progressValue: 0,
    progressTarget: 5,
    earnedAt: null,
  },
  {
    id: 'dancefloor-vip',
    code: 'dancefloor_vip',
    icon: Flame,
    label: 'DANCEFLOOR\nVIP',
    status: 'locked',
    unlockHint: 'Attend 10 gigs in any rolling 30-day window.',
    progressValue: 0,
    progressTarget: 10,
    earnedAt: null,
  },
  {
    id: 'lineup-sage',
    code: 'lineup_sage',
    icon: Headphones,
    label: 'LINEUP\nSAGE',
    status: 'locked',
    unlockHint: 'Attend gigs across 5 different genres.',
    progressValue: 0,
    progressTarget: 5,
    earnedAt: null,
  },
  {
    id: 'record-vulture',
    code: 'record_vulture',
    icon: Music,
    label: 'RECORD\nVULTURE',
    status: 'locked',
    unlockHint: 'Attend 5 gigs featuring the same artist or promoter.',
    progressValue: 0,
    progressTarget: 5,
    earnedAt: null,
  },
]

export function mapReputationBadgeFromApi(row: ReputationBadgeApiRow): ReputationBadgeItem {
  return {
    id: row.id,
    code: row.code,
    icon: reputationIconByKey[row.icon_key] ?? defaultReputationIcon,
    label: row.name,
    status: row.status,
    unlockHint: row.unlock_hint,
    progressValue: row.progress_value,
    progressTarget: row.progress_target,
    earnedAt: row.earned_at,
  }
}

export const PROFILE_REPUTATION_PREVIEW_COUNT = 5

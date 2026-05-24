import { create } from 'zustand'
import {
  buildTasteIdentityItemsFromSession,
  getDefaultTasteIdentityItems,
  type TasteCategoryRow,
  type TasteIdentityItem,
} from '../data/profileIdentity'
import { DEFAULT_LOCATION_CITY_ID, getLocationCityById } from '../data/locationRegions'
import { postProfileDefaultCity } from '../lib/auth-api'
import { navigateShellToPath } from '../lib/tabRoutes'
import { persistSignupOnboardingDismissed, readSignupOnboardingDismissed, setOnboardingFlagUserId } from '../lib/signup-onboarding-flag'
import { saveLastUsedAccount } from '../lib/last-used-account'
import {
  DEFAULT_CITY_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  WELCOME_SESSION_STORAGE_KEY,
} from '../config/storage'
import { favoriteLimitForTier } from '../config/favorites'
import type { Tab, Theme } from '../types'

function readWelcomeDismissed(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.sessionStorage.getItem(WELCOME_SESSION_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function readPersistedDefaultCityId(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCATION_CITY_ID
  try {
    const cityId = window.localStorage.getItem(DEFAULT_CITY_STORAGE_KEY)
    if (cityId && getLocationCityById(cityId)) return cityId
  } catch {
    /* ignore storage failure */
  }
  return DEFAULT_LOCATION_CITY_ID
}

function persistDefaultCityId(cityId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEFAULT_CITY_STORAGE_KEY, cityId)
  } catch {
    /* ignore quota / private mode */
  }
}

function clearPersistedDefaultCityId() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DEFAULT_CITY_STORAGE_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export type FavoriteEvent = {
  id: string
  title: string
  venueLine: string
  timeLabel: string
  image: string
  variant: 'upcoming' | 'past'
}

type PersistedFavorites = {
  ids: string[]
  snapshots: FavoriteEvent[]
}

function uniqueFavoriteIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, favoriteLimitForTier('pro'))
}

function persistFavoriteEventIds(ids: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(uniqueFavoriteIds(ids)))
  } catch {
    /* ignore quota / private mode */
  }
}

function favoriteSnapshotFromUnknown(row: unknown): FavoriteEvent | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.venueLine === 'string' &&
    typeof r.timeLabel === 'string' &&
    typeof r.image === 'string' &&
    (r.variant === 'upcoming' || r.variant === 'past')
  ) {
    return {
      id: r.id,
      title: r.title,
      venueLine: r.venueLine,
      timeLabel: r.timeLabel,
      image: r.image,
      variant: r.variant,
    }
  }
  return null
}

function readPersistedFavorites(): PersistedFavorites {
  if (typeof window === 'undefined') return { ids: [], snapshots: [] }
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return { ids: [], snapshots: [] }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { ids: [], snapshots: [] }

    const ids: string[] = []
    const snapshots: FavoriteEvent[] = []
    let sawLegacySnapshot = false

    for (const row of parsed) {
      if (typeof row === 'string') {
        ids.push(row)
        continue
      }
      const snapshot = favoriteSnapshotFromUnknown(row)
      if (snapshot) {
        ids.push(snapshot.id)
        snapshots.push(snapshot)
        sawLegacySnapshot = true
      }
    }

    const uniqueIds = uniqueFavoriteIds(ids)
    if (sawLegacySnapshot) persistFavoriteEventIds(uniqueIds)
    const allowed = new Set(uniqueIds)
    return {
      ids: uniqueIds,
      snapshots: snapshots.filter((item) => allowed.has(item.id)).slice(0, favoriteLimitForTier('pro')),
    }
  } catch {
    return { ids: [], snapshots: [] }
  }
}

const persistedFavorites = readPersistedFavorites()

function persistWelcomeDismissed() {
  try {
    window.sessionStorage.setItem(WELCOME_SESSION_STORAGE_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

function clearWelcomeDismissedPersisted() {
  try {
    window.sessionStorage.removeItem(WELCOME_SESSION_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export type UserProfile = {
  displayName: string
  /** Handle without leading @ */
  username: string
  bio: string
  avatarUrl: string
}

const defaultUserProfile: UserProfile = {
  displayName: 'Vincenzo K',
  username: 'vincenzo_k',
  bio: '',
  avatarUrl:
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
}

export type PendingPlanDetail = {
  id: string
  kind: 'upcoming' | 'past'
  /** If set, leaving this detail (back) restores this tab instead of staying on Plan. */
  returnTab?: Tab
}

export type FavoriteNotice = {
  id: number
  message: string
}

export type SubscriptionTier = 'free' | 'pro'
export type LocationPreferenceMode = 'precise' | 'city'
export type LocationPermissionState = 'unknown' | 'granted' | 'denied'
export type OnboardingSource = 'signup' | 'settings'

/** Auth user from `GET /api/auth/session` (no Supabase client in the browser). */
export type AuthUserPayload = {
  id: string
  email?: string | null
  is_anonymous?: boolean
  user_metadata?: Record<string, unknown>
}

type AppState = {
  userProfile: UserProfile
  /** After the Layla-style welcome, user can explore before optional sign-in. */
  welcomeDismissed: boolean
  /** Show "Welcome Back" transition screen after successful sign-in */
  showWelcomeBack: boolean
  /** Demo flag — replace with real session. */
  isAuthenticated: boolean
  /**
   * True after the first `AuthSync` session fetch attempt finishes (success or failure).
   * Used to avoid treating the initial `isAuthenticated: false` as “logged out” before hydration.
   */
  authSessionHydrated: boolean
  /** Email from auth session for signed-in (non-anonymous) users; null otherwise. */
  authEmail: string | null
  tab: Tab
  theme: Theme
  /** Which plan the signed-in user is on (drives subscription screen highlights). */
  subscriptionTier: SubscriptionTier
  activeEventId: string | null
  /** When set, Plan tab opens this detail (same as tapping a plan list card). */
  pendingPlanDetail: PendingPlanDetail | null
  /** Persisted favorite ids. The localStorage value is `string[]`, not event snapshots. */
  favoriteEventIds: string[]
  /** Session-only display cache for favorites saved before their details are reloaded. */
  favoriteEvents: FavoriteEvent[]
  favoriteNotice: FavoriteNotice | null
  /** Feed location pill — Plan explore detail defaults country/city filter to this. */
  feedLocationCityId: string
  /** Nullable profile-level default city preference from local storage / profiles.default_city_id. */
  profileDefaultCityId: string | null
  /** Location preference for discovery when precise position is available. */
  locationPreferenceMode: LocationPreferenceMode
  /** Radius used when locationPreferenceMode = 'precise'. */
  nearbyRadiusKm: number
  /** Browser location permission state tracked from settings flow. */
  locationPermission: LocationPermissionState
  showBuzzPoints: boolean
  /** Full catalog of taste tags — drives the chip grid order in edit mode. */
  tasteIdentityItems: TasteIdentityItem[]
  /** Labels the user has explicitly selected (subset of catalog). Used to seed edit state. */
  savedTasteLabels: Set<string>
  showProfileTasteAll: boolean
  showProfileReputationAll: boolean
  showSettings: boolean
  showLanguage: boolean
  showPrivacySafety: boolean
  showFeedback: boolean
  showEmailLogin: boolean
  /** Pre-app sign-in sheet from the welcome screen. */
  showSignIn: boolean
  /** Set when magic link / OAuth redirect returns #error (shown in the sign-in sheet). */
  signInRedirectError: string | null
  showEditProfile: boolean
  showSubscription: boolean
  /** True when the subscription screen should open directly on the success view (post-Stripe redirect). */
  stripeSuccessOverlay: boolean
  /** Quick setup: city + genre picks (matches gr-frontend-new onboarding). */
  showOnboarding: boolean
  onboardingSource: OnboardingSource | null
  /** Bumps when onboarding opens so the screen remounts with fresh local state. */
  onboardingMountKey: number
  dismissWelcome: () => void
  dismissWelcomeBack: () => void
  openSignIn: () => void
  closeSignIn: () => void
  /** Demo only — call after OAuth / email auth succeeds. */
  completeSignInDemo: () => void
  /**
   * Sync UI from auth user + optional `profiles` row (from backend).
   * `isAuthenticated` is true only for non-anonymous users (Google / email).
   */
  applySupabaseSession: (
    user: AuthUserPayload | null,
    profile?: {
      display_name?: string | null
      username?: string | null
      avatar_url?: string | null
      bio?: string | null
      default_city_id?: string | null
      subscription_tier?: string | null
    } | null,
    options?: {
      isFreshSignIn?: boolean
      tasteCategories?: TasteCategoryRow[]
      /** User's saved taste labels from user_taste_selections. */
      tasteSelections?: string[]
    },
  ) => void
  /** Sign out demo session and show the pre-login welcome again. */
  returnToLanding: () => void
  setTab: (tab: Tab) => void
  setTheme: (theme: Theme) => void
  openEvent: (eventId: string) => void
  closeEvent: () => void
  requestPlanDetail: (
    eventId: string,
    kind?: 'upcoming' | 'past',
    returnTab?: Tab,
  ) => void
  clearPendingPlanDetail: () => void
  toggleFavoriteEvent: (event: FavoriteEvent) => void
  isEventFavorited: (eventId: string) => boolean
  clearFavoriteNotice: () => void
  openBuzzPoints: () => void
  closeBuzzPoints: () => void
  openProfileTasteAll: () => void
  closeProfileTasteAll: () => void
  openProfileReputationAll: () => void
  closeProfileReputationAll: () => void
  openSettings: () => void
  closeSettings: () => void
  openLanguage: () => void
  closeLanguage: () => void
  openPrivacySafety: () => void
  closePrivacySafety: () => void
  openFeedback: () => void
  closeFeedback: () => void
  openEmailLogin: () => void
  closeEmailLogin: () => void
  openEditProfile: () => void
  closeEditProfile: () => void
  openSubscription: () => void
  closeSubscription: () => void
  openOnboarding: (source: OnboardingSource) => void
  closeOnboarding: () => void
  /** Persist city from onboarding (local + profile when signed in). */
  applyOnboardingCity: (cityId: string) => void
  setUserProfile: (patch: Partial<UserProfile>) => void
  /** Update the full catalog order (does not change the saved-selection set). */
  setTasteIdentityItems: (items: TasteIdentityItem[]) => void
  /** Update the saved selection labels after a successful save. */
  setSavedTasteLabels: (labels: string[]) => void
  setSubscriptionTier: (tier: SubscriptionTier) => void
  setFeedLocationCityId: (cityId: string) => void
  setLocationPreferenceMode: (mode: LocationPreferenceMode) => void
  setNearbyRadiusKm: (km: number) => void
  setLocationPermission: (permission: LocationPermissionState) => void
  isDiscoverExpanded: boolean
  toggleDiscoverExpanded: () => void
}

export const useAppState = create<AppState>((set, get) => ({
  userProfile: defaultUserProfile,
  welcomeDismissed: readWelcomeDismissed(),
  showWelcomeBack: false,
  isAuthenticated: false,
  authSessionHydrated: false,
  authEmail: null,
  tab: 'discover',
  theme: 'dark',
  subscriptionTier: 'free',
  activeEventId: null,
  pendingPlanDetail: null,
  favoriteEventIds: persistedFavorites.ids,
  favoriteEvents: persistedFavorites.snapshots,
  favoriteNotice: null,
  feedLocationCityId: readPersistedDefaultCityId() ?? DEFAULT_LOCATION_CITY_ID,
  profileDefaultCityId: readPersistedDefaultCityId(),
  locationPreferenceMode: 'city',
  nearbyRadiusKm: 3,
  locationPermission: 'unknown',
  showBuzzPoints: false,
  tasteIdentityItems: getDefaultTasteIdentityItems(),
  savedTasteLabels: new Set<string>(),
  showProfileTasteAll: false,
  showProfileReputationAll: false,
  showSettings: false,
  showLanguage: false,
  showPrivacySafety: false,
  showFeedback: false,
  showEmailLogin: false,
  showSignIn: false,
  signInRedirectError: null,
  showEditProfile: false,
  showSubscription: false,
  stripeSuccessOverlay: false,
  showOnboarding: false,
  onboardingSource: null,
  onboardingMountKey: 0,
  isDiscoverExpanded: false,
  dismissWelcome: () => {
    persistWelcomeDismissed()
    set({ welcomeDismissed: true, showSignIn: false, signInRedirectError: null })
  },
  dismissWelcomeBack: () => set({ showWelcomeBack: false }),
  openSignIn: () => set({ showSignIn: true, signInRedirectError: null }),
  closeSignIn: () => set({ showSignIn: false, signInRedirectError: null }),
  completeSignInDemo: () => {
    persistWelcomeDismissed()
    set({
      welcomeDismissed: true,
      isAuthenticated: true,
      showSignIn: false,
      signInRedirectError: null,
      tab: 'discover',
    })
    queueMicrotask(() => navigateShellToPath('/discover', { replace: true }))
  },
  applySupabaseSession: (user, profile, options) => {
    if (!user) {
      set({
        isAuthenticated: false,
        userProfile: defaultUserProfile,
        authEmail: null,
        tasteIdentityItems: getDefaultTasteIdentityItems(),
        savedTasteLabels: new Set<string>(),
        profileDefaultCityId: readPersistedDefaultCityId(),
      })
      return
    }

    const u = user
    const isRealUser = !u.is_anonymous
    const authEmail = isRealUser ? (u.email?.trim() || null) : null
    const isFreshSignIn = options?.isFreshSignIn === true

    // Key the onboarding flag to this specific user so new users always see onboarding
    setOnboardingFlagUserId(isRealUser ? u.id : null)
    const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>
    const displayName =
      profile?.display_name?.trim() ||
      meta.full_name ||
      meta.name ||
      u.email?.split('@')[0] ||
      defaultUserProfile.displayName
    const usernameFromProfile = profile?.username?.trim().replace(/^@+/, '').toLowerCase() ?? ''
    const usernameFromMeta = meta.username?.trim().replace(/^@+/, '').toLowerCase() ?? ''
    const usernameFromDisplay = displayName
      .replace(/\s+/g, '_')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
    const username =
      usernameFromProfile ||
      usernameFromMeta ||
      usernameFromDisplay ||
      defaultUserProfile.username
    const avatarUrl =
      profile?.avatar_url?.trim() ||
      meta.avatar_url ||
      defaultUserProfile.avatarUrl
    const bio = profile?.bio?.trim() ?? ''
    const sessionDefaultCityId = profile?.default_city_id?.trim() ?? ''
    const resolvedDefaultCityId =
      sessionDefaultCityId && getLocationCityById(sessionDefaultCityId) ? sessionDefaultCityId : null
    if (resolvedDefaultCityId) {
      persistDefaultCityId(resolvedDefaultCityId)
    } else if (isRealUser) {
      clearPersistedDefaultCityId()
    }

    const catalog = options?.tasteCategories ?? []
    const tasteSelections = options?.tasteSelections ?? []
    const savedSelections = tasteSelections.map((label) => ({ label }))
    const tasteIdentityItems = buildTasteIdentityItemsFromSession(
      isRealUser,
      catalog,
      savedSelections,
    )
    const savedTasteLabels = new Set<string>(tasteSelections)

    const tier = profile?.subscription_tier === 'pro' ? 'pro' : 'free'

    // Persist last-used account so the sign-in sheet can show a quick "Continue as X" button
    if (isRealUser && authEmail) {
      saveLastUsedAccount({ email: authEmail, displayName, avatarUrl })
    }

    const wasAuthenticated = get().isAuthenticated
    const freshSignIn = isFreshSignIn && !wasAuthenticated
    set({
      isAuthenticated: isRealUser,
      authEmail,
      subscriptionTier: isRealUser ? tier : 'free',
      userProfile: {
        displayName,
        username,
        bio,
        avatarUrl,
      },
      profileDefaultCityId: resolvedDefaultCityId,
      ...(resolvedDefaultCityId ? { feedLocationCityId: resolvedDefaultCityId } : {}),
      tasteIdentityItems,
      savedTasteLabels,
      ...(isRealUser
        ? {
            showSignIn: false,
            signInRedirectError: null,
            welcomeDismissed: true,
            // Fresh sign-in: signup onboarding OR welcome-back (mutually exclusive). Do not set on session poll.
            ...(freshSignIn
              ? readSignupOnboardingDismissed()
                ? { showWelcomeBack: true }
                : {
                    showOnboarding: true,
                    onboardingSource: 'signup' as OnboardingSource,
                    showWelcomeBack: false,
                  }
              : {}),
          }
        : {}),
    })

    if (isRealUser) {
      persistWelcomeDismissed()
    }
  },
  returnToLanding: () => {
    clearWelcomeDismissedPersisted()
    set({
      welcomeDismissed: false,
      isAuthenticated: false,
      authEmail: null,
      showSignIn: false,
      signInRedirectError: null,
      tab: 'discover',
      activeEventId: null,
      pendingPlanDetail: null,
      showBuzzPoints: false,
      tasteIdentityItems: getDefaultTasteIdentityItems(),
      savedTasteLabels: new Set<string>(),
      showProfileTasteAll: false,
      showProfileReputationAll: false,
      showSettings: false,
      showLanguage: false,
      showPrivacySafety: false,
      showFeedback: false,
      showEmailLogin: false,
      showEditProfile: false,
      showSubscription: false,
      stripeSuccessOverlay: false,
      showOnboarding: false,
      onboardingSource: null,
      showWelcomeBack: false,
      profileDefaultCityId: readPersistedDefaultCityId(),
    })
    queueMicrotask(() => navigateShellToPath('/', { replace: true }))
  },
  setTab: (tab) => set({ tab }),
  setTheme: (theme) => set({ theme }),
  openEvent: (eventId) => set({ activeEventId: eventId }),
  closeEvent: () => set({ activeEventId: null }),
  requestPlanDetail: (eventId, kind = 'upcoming', returnTab) =>
    set({
      pendingPlanDetail: {
        id: eventId,
        kind,
        ...(returnTab != null ? { returnTab } : {}),
      },
    }),
  clearPendingPlanDetail: () => set({ pendingPlanDetail: null }),
  toggleFavoriteEvent: (event) =>
    set((state) => {
      const favoriteId = event.id.trim()
      if (!favoriteId) return {}
      const alreadyFavorited = state.favoriteEventIds.includes(favoriteId)
      if (!alreadyFavorited) {
        const limit = favoriteLimitForTier(state.subscriptionTier)
        if (state.favoriteEventIds.length >= limit) {
          return {
            favoriteNotice: {
              id: Date.now(),
              message:
                state.subscriptionTier === 'pro'
                  ? `You can save up to ${limit} favourite events.`
                  : `Buzo Basic can save up to ${limit} favourites. Upgrade to Buzo Pro for up to ${favoriteLimitForTier('pro')}.`,
            },
          }
        }
      }
      const nextIds = alreadyFavorited
        ? state.favoriteEventIds.filter((id) => id !== favoriteId)
        : uniqueFavoriteIds([favoriteId, ...state.favoriteEventIds.filter((id) => id !== favoriteId)])
      const nextEvents = alreadyFavorited
        ? state.favoriteEvents.filter((item) => item.id !== favoriteId)
        : [event, ...state.favoriteEvents.filter((item) => item.id !== favoriteId)]
      persistFavoriteEventIds(nextIds)
      return { favoriteEventIds: nextIds, favoriteEvents: nextEvents }
    }),
  isEventFavorited: (eventId) => get().favoriteEventIds.includes(eventId),
  clearFavoriteNotice: () => set({ favoriteNotice: null }),
  openBuzzPoints: () => set({ showBuzzPoints: true }),
  closeBuzzPoints: () => set({ showBuzzPoints: false }),
  setTasteIdentityItems: (items) => set({ tasteIdentityItems: items }),
  setSavedTasteLabels: (labels) => set({ savedTasteLabels: new Set(labels) }),
  openProfileTasteAll: () => set({ showProfileTasteAll: true }),
  closeProfileTasteAll: () => set({ showProfileTasteAll: false }),
  openProfileReputationAll: () => set({ showProfileReputationAll: true }),
  closeProfileReputationAll: () => set({ showProfileReputationAll: false }),
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false }),
  openLanguage: () => set({ showLanguage: true }),
  closeLanguage: () => set({ showLanguage: false }),
  openPrivacySafety: () => set({ showPrivacySafety: true }),
  closePrivacySafety: () => set({ showPrivacySafety: false }),
  openFeedback: () => set({ showFeedback: true }),
  closeFeedback: () => set({ showFeedback: false }),
  openEmailLogin: () => set({ showEmailLogin: true }),
  closeEmailLogin: () => set({ showEmailLogin: false }),
  openEditProfile: () => set({ showEditProfile: true }),
  closeEditProfile: () => set({ showEditProfile: false }),
  openSubscription: () => set({ showSubscription: true }),
  closeSubscription: () => set({ showSubscription: false, stripeSuccessOverlay: false }),
  openOnboarding: (source) =>
    set((s) => ({
      showOnboarding: true,
      onboardingSource: source,
      onboardingMountKey: s.onboardingMountKey + 1,
    })),
  closeOnboarding: () => {
    const src = get().onboardingSource
    if (src === 'signup') {
      persistSignupOnboardingDismissed()
    }
    set({
      showOnboarding: false,
      onboardingSource: null,
      ...(src === 'signup' ? { showWelcomeBack: true } : {}),
    })
  },
  applyOnboardingCity: (cityId) => {
    persistDefaultCityId(cityId)
    set({ feedLocationCityId: cityId, profileDefaultCityId: cityId })
    if (get().isAuthenticated) {
      void postProfileDefaultCity(cityId).catch((e) => {
        console.error('[buzo] onboarding default city:', e)
      })
    }
  },
  setUserProfile: (patch) =>
    set((s) => ({ userProfile: { ...s.userProfile, ...patch } })),
  setSubscriptionTier: (subscriptionTier) => set({ subscriptionTier }),
  setFeedLocationCityId: (feedLocationCityId) => {
    persistDefaultCityId(feedLocationCityId)
    set({ feedLocationCityId })
  },
  setLocationPreferenceMode: (locationPreferenceMode) => set({ locationPreferenceMode }),
  setNearbyRadiusKm: (nearbyRadiusKm) => set({ nearbyRadiusKm }),
  setLocationPermission: (locationPermission) =>
    set((state) => ({
      locationPermission,
      locationPreferenceMode:
        locationPermission === 'denied' ? 'city' : state.locationPreferenceMode,
    })),
  toggleDiscoverExpanded: () => set((s) => ({ isDiscoverExpanded: !s.isDiscoverExpanded })),
}))

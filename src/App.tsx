import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ASK_BUZO_PATHS,
  discoverEventIdFromPath,
  getDiscoverEventPath,
  isKnownAskBuzoPath,
  isKnownPlanPath,
  navigateShellToTab,
  normalizeShellPath,
  pathToTab,
  setShellNavigate,
} from './lib/tabRoutes'
import { PLAN_PATHS } from './config/routes'
import { SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY } from './lib/session'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Info, Moon, Sun, User, X } from 'lucide-react'
import {
  getPlanDetailPast,
  getPlanDetailUpcoming,
} from './data/demoData'
import { useAppState, type FavoriteEvent } from './store/appStore'
import type { EventItem, PlanPageEvent, Tab } from './types'
import { tabNavItems } from './config/tabNavigation'
import { GoingCelebrationHost } from './components/GoingCelebrationBurst'
import { UploadToast } from './components/UploadToast'
import { fetchDiscoverEventById, useDiscoverEvents } from './lib/useDiscoverEvents'
import { useEventPlans } from './lib/useEventPlans'
import { readInitialDiscoverFilters, type DiscoverEventFilters } from './lib/discover-filters'
import { handleEventImageError } from './lib/event-image-fallback'

const routeFallback = <div className="tab-suspense-fallback" aria-hidden />

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={routeFallback}>{element}</Suspense>
}

const DiscoverTab = lazy(() =>
  import('./views/discover/DiscoverTab').then((m) => ({ default: m.DiscoverTab })),
)
const EventCardFeed = lazy(() =>
  import('./views/discover/EventCardFeed').then((m) => ({ default: m.EventCardFeed })),
)
const MapView = lazy(() =>
  import('./views/discover/MapView').then((m) => ({ default: m.MapView })),
)
const PlanTab = lazy(() =>
  import('./views/plan/PlanTab').then((m) => ({ default: m.PlanTab })),
)
const PlanEventDetail = lazy(() =>
  import('./views/plan/PlanEventDetail').then((m) => ({ default: m.PlanEventDetail })),
)
const FavoritesTab = lazy(() =>
  import('./views/favorites/FavoritesTab').then((m) => ({ default: m.FavoritesTab })),
)
const ProfileTab = lazy(() =>
  import('./views/profile/ProfileTab').then((m) => ({ default: m.ProfileTab })),
)
const BuzzPointsScreen = lazy(() =>
  import('./views/profile/BuzzPointsScreen').then((m) => ({ default: m.BuzzPointsScreen })),
)
const ProfileReputationScreen = lazy(() =>
  import('./views/profile/ProfileReputationScreen').then((m) => ({ default: m.ProfileReputationScreen })),
)
const ProfileTasteIdentityScreen = lazy(() =>
  import('./views/profile/ProfileTasteIdentityScreen').then((m) => ({ default: m.ProfileTasteIdentityScreen })),
)
const SettingsScreen = lazy(() =>
  import('./views/profile/settings/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const EditProfileScreen = lazy(() =>
  import('./views/profile/settings/EditProfileScreen').then((m) => ({ default: m.EditProfileScreen })),
)
const LanguageScreen = lazy(() =>
  import('./views/profile/settings/LanguageScreen').then((m) => ({ default: m.LanguageScreen })),
)
const PrivacySafetyScreen = lazy(() =>
  import('./views/profile/settings/PrivacySafetyScreen').then((m) => ({ default: m.PrivacySafetyScreen })),
)
const ReleaseNotesScreen = lazy(() =>
  import('./views/profile/settings/ReleaseNotesScreen').then((m) => ({ default: m.ReleaseNotesScreen })),
)
const FeedbackScreen = lazy(() =>
  import('./views/profile/settings/FeedbackScreen').then((m) => ({ default: m.FeedbackScreen })),
)
const EmailLoginScreen = lazy(() =>
  import('./views/profile/settings/EmailLoginScreen').then((m) => ({ default: m.EmailLoginScreen })),
)
const SubscriptionScreen = lazy(() =>
  import('./views/profile/settings/SubscriptionScreen').then((m) => ({ default: m.SubscriptionScreen })),
)
const OnboardingScreen = lazy(() =>
  import('./views/onboarding/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
)
const WelcomeScreen = lazy(() =>
  import('./views/welcome/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen })),
)
const SignInSheet = lazy(() =>
  import('./views/welcome/SignInSheet').then((m) => ({ default: m.SignInSheet })),
)
const WelcomeBackScreen = lazy(() =>
  import('./views/welcome/WelcomeBackScreen').then((m) => ({ default: m.WelcomeBackScreen })),
)
const DesignThemeOrangePage = lazy(() =>
  import('./views/design-theme/DesignThemeOrangePage').then((m) => ({ default: m.DesignThemeOrangePage })),
)
const DesignThemePurplePage = lazy(() =>
  import('./views/design-theme/DesignThemePurplePage').then((m) => ({ default: m.DesignThemePurplePage })),
)
const AdminHomePage = lazy(() =>
  import('./views/admin-home/AdminHomePage').then((m) => ({ default: m.AdminHomePage })),
)
const AdminRouteGuard = lazy(() =>
  import('./views/admin-home/AdminRouteGuard').then((m) => ({ default: m.AdminRouteGuard })),
)
const AdminUsersPage = lazy(() =>
  import('./views/admin-users/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminWeatherMapPage = lazy(() =>
  import('./views/admin-weather-map/AdminWeatherMapPage').then((m) => ({ default: m.AdminWeatherMapPage })),
)
const UserAnalyticsPage = lazy(() =>
  import('./views/user-analytics/UserAnalyticsPage').then((m) => ({ default: m.UserAnalyticsPage })),
)
const EventListPage = lazy(() =>
  import('./views/event-list/EventListPage').then((m) => ({ default: m.EventListPage })),
)
const NotFound404Page = lazy(() =>
  import('./views/not-found/NotFound404Page').then((m) => ({ default: m.NotFound404Page })),
)

type SheetPlanOverlay =
  | { kind: 'upcoming'; id: string }
  | { kind: 'past'; id: string }

function cleanLabel(value: string | undefined | null, fallback: string): string {
  const text = value?.trim()
  return text && text.length > 0 ? text : fallback
}

function liveEventGenreTags(event: EventItem): [string, string] {
  const primary = cleanLabel(event.genre, 'EVENT').toUpperCase()
  const secondary = cleanLabel(event.host || event.venue, event.venue || event.district || 'DETAILS')
  return [primary, secondary]
}

function planDetailFromDiscoverEvent(event: EventItem): PlanPageEvent {
  const dateTimeLabel = event.displayDateTimeLabel ?? event.time
  const venueLine = [event.venue, event.district].map((part) => part.trim()).filter(Boolean).join(', ')
  const coordinateQuery =
    typeof event.lat === 'number' && typeof event.lng === 'number' ? `${event.lat},${event.lng}` : ''
  const tags = event.vibeTags.map((tag) => tag.trim()).filter(Boolean)
  const summary = event.hostPrompt.trim()

  return {
    eventId: event.id,
    sourceUrl: event.sourceUrl ?? null,
    heroImage: event.image,
    displayTitle: event.title,
    artistLine: event.host ? `HOST · ${event.host}` : cleanLabel(event.genre, 'LIVE EVENT').toUpperCase(),
    genreTags: liveEventGenreTags(event),
    venueLine: venueLine || event.venue || event.district || 'Venue TBA',
    lat: typeof event.lat === 'number' ? event.lat : undefined,
    lng: typeof event.lng === 'number' ? event.lng : undefined,
    locationCityId: event.locationCityId || 'singapore',
    mapQuery: venueLine || coordinateQuery || undefined,
    timeRange: dateTimeLabel,
    eventDateTime: event.eventDateTime ?? null,
    ticketPrice: event.ticketPrice || undefined,
    aiVibeScore: null,
    eliteVerifiedCount: 0,
    eliteStackExtra: 0,
    experienceParts: {
      before: summary || tags.join(' · ') || 'Details are still being enriched for this event.',
      emphasis: '',
      after: '',
    },
    audioPreviewLabel: null,
    audioCurrent: '0:00',
    audioTotal: '0:00',
    friendsAttendingCount: 0,
    friends: [],
  }
}

function favoriteFromDiscoverEvent(event: EventItem): FavoriteEvent {
  return {
    id: event.id,
    title: event.title,
    venueLine: [event.venue, event.district].map((part) => part.trim()).filter(Boolean).join(', '),
    timeLabel: event.displayDateTimeLabel ?? event.time,
    image: event.image,
    variant: 'upcoming',
  }
}

function tabReturnAriaLabel(t: Tab): string {
  switch (t) {
    case 'discover':
      return 'Back to discover'
    case 'ask':
      return 'Back to Ask Buzo'
    case 'favorites':
      return 'Back to saved events'
    case 'plan':
      return 'Back to plan list'
    case 'profile':
      return 'Back to profile'
  }
}

function MainApp() {
  const {
    tab,
    theme,
    welcomeDismissed,
    showSignIn,
    showWelcomeBack,
    activeEventId,
    showBuzzPoints,
    showProfileTasteAll,
    showProfileReputationAll,
    showSettings,
    showLanguage,
    showPrivacySafety,
    showReleaseNotes,
    showFeedback,
    showEmailLogin,
    showEditProfile,
    showSubscription,
    showOnboarding,
    onboardingMountKey,
    isAuthenticated,
    dismissWelcome,
    setTab,
    setTheme,
    openSignIn,
    openEvent,
    closeEvent,
    requestPlanDetail,
    toggleFavoriteEvent,
    isEventFavorited,
    pendingPlanDetail,
    clearPendingPlanDetail,
    isDiscoverExpanded,
    feedLocationCityId,
    favoriteNotice,
    clearFavoriteNotice,
  } = useAppState()
  const { isEventPlanned, toggleEventPlan } = useEventPlans()
  const navigate = useNavigate()
  const location = useLocation()
  const discoverRouteEventId = useMemo(
    () => discoverEventIdFromPath(location.pathname),
    [location.pathname],
  )
  const shouldShowWelcome = !welcomeDismissed && !discoverRouteEventId

  useLayoutEffect(() => {
    setShellNavigate(navigate)
    return () => setShellNavigate(null)
  }, [navigate])

  useLayoutEffect(() => {
    if (!welcomeDismissed && !discoverRouteEventId) return
    const { pathname } = location
    const normalizedPath = normalizeShellPath(pathname)
    if (pathname === '/' || pathname === '') {
      navigate('/discover', { replace: true })
      return
    }
    if (normalizedPath === ASK_BUZO_PATHS.root) {
      navigate(ASK_BUZO_PATHS.chat, { replace: true })
      return
    }
    if (
      normalizedPath.startsWith(`${ASK_BUZO_PATHS.root}/`) &&
      !isKnownAskBuzoPath(pathname)
    ) {
      navigate(ASK_BUZO_PATHS.chat, { replace: true })
      return
    }
    if (
      normalizedPath.startsWith(`${PLAN_PATHS.hub}/`) &&
      !isKnownPlanPath(pathname)
    ) {
      navigate(PLAN_PATHS.hub, { replace: true })
      return
    }
    const pathTab = pathToTab(pathname)
    if (pathTab === null) {
      navigate('/discover', { replace: true })
      return
    }
    if (pathTab !== tab) {
      setTab(pathTab)
    }
  }, [welcomeDismissed, discoverRouteEventId, location.pathname, navigate, tab, setTab])

  const [discoverPrefill, setDiscoverPrefill] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.sessionStorage.getItem(SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const stashDiscoverPrefill = useCallback((prefill: string) => {
    setDiscoverPrefill(prefill)
    try {
      if (prefill) {
        window.sessionStorage.setItem(SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY, prefill)
      } else {
        window.sessionStorage.removeItem(SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY)
      }
    } catch {
      /* storage unavailable */
    }
  }, [])
  const consumeDiscoverPrefill = useCallback(() => {
    setDiscoverPrefill('')
    try {
      window.sessionStorage.removeItem(SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY)
    } catch {
      /* storage unavailable */
    }
  }, [])
  const [sheetPlanOverlay, setSheetPlanOverlay] = useState<SheetPlanOverlay | null>(null)
  const [sheetPlanReturnTab, setSheetPlanReturnTab] = useState<Tab | null>(null)
  const [discoverMapMode, setDiscoverMapMode] = useState(false)
  const [discoverFilters, setDiscoverFilters] = useState<DiscoverEventFilters>(() => readInitialDiscoverFilters())
  const [discoverDetailEventId, setDiscoverDetailEventId] = useState<string | null>(null)
  const [discoverDetailRemoteEvent, setDiscoverDetailRemoteEvent] = useState<EventItem | null>(null)
  const [discoverDetailLoading, setDiscoverDetailLoading] = useState(false)
  const [discoverDetailError, setDiscoverDetailError] = useState<string | null>(null)

  const {
    events: discoverEvents,
    source: discoverEventsSource,
    loading: discoverEventsLoading,
    loadingMore: discoverEventsLoadingMore,
    error: discoverEventsError,
    hasMore: discoverEventsHasMore,
    totalAvailable: discoverEventsTotalAvailable,
    loadMore: loadMoreDiscoverEvents,
    refresh: refreshDiscoverEvents,
  } = useDiscoverEvents(feedLocationCityId, discoverFilters)

  useEffect(() => {
    if (!pendingPlanDetail) return
    if (pendingPlanDetail.returnTab != null && pendingPlanDetail.returnTab !== 'plan') {
      setSheetPlanOverlay({ kind: pendingPlanDetail.kind, id: pendingPlanDetail.id })
      setSheetPlanReturnTab(pendingPlanDetail.returnTab)
      clearPendingPlanDetail()
    }
  }, [pendingPlanDetail, clearPendingPlanDetail])

  useEffect(() => {
    if (
      !sheetPlanOverlay ||
      sheetPlanReturnTab == null ||
      tab === sheetPlanReturnTab
    ) {
      return
    }
    setSheetPlanOverlay(null)
    setSheetPlanReturnTab(null)
  }, [tab, sheetPlanOverlay, sheetPlanReturnTab])

  const closeSheetPlanOverlay = useCallback(() => {
    setSheetPlanOverlay(null)
    setSheetPlanReturnTab(null)
  }, [])

  const toFavoriteEvent = useCallback(
    (
      eventId: string,
      variant: 'upcoming' | 'past',
      data: ReturnType<typeof getPlanDetailUpcoming> | ReturnType<typeof getPlanDetailPast>,
    ): FavoriteEvent => ({
      id: eventId,
      title: data?.displayTitle ?? 'Event',
      venueLine: data?.venueLine ?? '',
      timeLabel: data?.timeRange ?? '',
      image: data?.heroImage ?? '',
      variant,
    }),
    [],
  )

  const activeEvent = useMemo(
    () => discoverEvents.find((event) => event.id === activeEventId) ?? null,
    [activeEventId, discoverEvents],
  )
  const discoverDetailListEvent = useMemo(
    () => discoverEvents.find((event) => event.id === discoverDetailEventId) ?? null,
    [discoverDetailEventId, discoverEvents],
  )
  const discoverDetailEvent = useMemo(() => {
    if (discoverDetailListEvent) return discoverDetailListEvent
    return discoverDetailRemoteEvent?.id === discoverDetailEventId ? discoverDetailRemoteEvent : null
  }, [discoverDetailEventId, discoverDetailListEvent, discoverDetailRemoteEvent])
  const discoverDetailData = useMemo(
    () => (discoverDetailEvent ? planDetailFromDiscoverEvent(discoverDetailEvent) : null),
    [discoverDetailEvent],
  )

  const openDiscoverDetail = useCallback(
    (eventId: string) => {
      closeEvent()
      setDiscoverDetailEventId(eventId)
      navigate(getDiscoverEventPath(eventId))
    },
    [closeEvent, navigate],
  )

  const closeDiscoverDetail = useCallback(() => {
    setDiscoverDetailEventId(null)
    setDiscoverDetailRemoteEvent(null)
    setDiscoverDetailError(null)
    navigate('/discover')
  }, [navigate])

  const requireAuth = useCallback(
    (message: string, action: () => void) => {
      if (!isAuthenticated) {
        openSignIn(message)
        return
      }
      action()
    },
    [isAuthenticated, openSignIn],
  )

  const navigateProtectedTab = useCallback(
    (targetTab: Tab) => {
      switch (targetTab) {
        case 'ask':
          requireAuth('Sign in to ask Buzo for personalized event picks.', () => navigateShellToTab(targetTab))
          return
        case 'favorites':
          requireAuth('Sign in to view your saved events.', () => navigateShellToTab(targetTab))
          return
        case 'plan':
          requireAuth('Sign in to view and manage your event plan.', () => navigateShellToTab(targetTab))
          return
        case 'profile':
          requireAuth('Sign in to manage your profile.', () => navigateShellToTab(targetTab))
          return
        case 'discover':
          navigateShellToTab(targetTab)
          return
      }
    },
    [requireAuth],
  )

  useEffect(() => {
    if (tab !== 'discover' || !discoverRouteEventId) {
      setDiscoverDetailEventId(null)
      setDiscoverDetailRemoteEvent(null)
      setDiscoverDetailError(null)
      setDiscoverDetailLoading(false)
      return
    }
    setDiscoverDetailEventId(discoverRouteEventId)
  }, [discoverRouteEventId, tab])

  useEffect(() => {
    if (!discoverDetailEventId || tab !== 'discover') return
    if (discoverDetailListEvent) {
      setDiscoverDetailRemoteEvent(null)
      setDiscoverDetailError(null)
      setDiscoverDetailLoading(false)
      return
    }
    if (discoverEventsSource === 'demo') {
      setDiscoverDetailError('Event not found in demo data')
      setDiscoverDetailLoading(false)
      return
    }

    const controller = new AbortController()
    setDiscoverDetailRemoteEvent(null)
    setDiscoverDetailError(null)
    setDiscoverDetailLoading(true)

    fetchDiscoverEventById(discoverDetailEventId, controller.signal)
      .then((event) => {
        setDiscoverDetailRemoteEvent(event)
        setDiscoverDetailError(null)
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setDiscoverDetailError(e instanceof Error ? e.message : 'Failed to load event details')
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiscoverDetailLoading(false)
      })

    return () => controller.abort()
  }, [discoverDetailEventId, discoverDetailListEvent, discoverEventsSource, tab])

  const sheetPlanOverlayBody = useMemo(() => {
    if (!sheetPlanOverlay) return null
    const data =
      sheetPlanOverlay.kind === 'upcoming'
        ? getPlanDetailUpcoming(sheetPlanOverlay.id)
        : getPlanDetailPast(sheetPlanOverlay.id)
    if (!data) {
      return (
        <div className="plan-detail-overlay-fallback screen-content plan-home">
          <p className="plan-home-sub">This event is no longer available.</p>
          <button
            type="button"
            className="plan-segment plan-segment--on"
            onClick={closeSheetPlanOverlay}
          >
            {sheetPlanReturnTab ? tabReturnAriaLabel(sheetPlanReturnTab) : 'Back'}
          </button>
        </div>
      )
    }
    return (
      <PlanEventDetail
        data={data}
        variant={sheetPlanOverlay.kind}
        backAriaLabel={
          sheetPlanReturnTab ? tabReturnAriaLabel(sheetPlanReturnTab) : 'Back'
        }
        onBack={closeSheetPlanOverlay}
        onOpenEvent={openEvent}
        isFavorited={isEventFavorited(data.eventId)}
        onToggleFavorite={() =>
          requireAuth('Sign in to save this event.', () =>
            toggleFavoriteEvent(toFavoriteEvent(data.eventId, sheetPlanOverlay.kind, data)),
          )
        }
        isPlanned={isEventPlanned(data.eventId)}
        onTogglePlan={() =>
          requireAuth('Sign in to mark yourself as going.', () => {
            const wasPlanned = isEventPlanned(data.eventId)
            toggleEventPlan(data.eventId)
            if (wasPlanned) closeSheetPlanOverlay()
          })
        }
      />
    )
  }, [
    sheetPlanOverlay,
    sheetPlanReturnTab,
    closeSheetPlanOverlay,
    openEvent,
    isEventFavorited,
    isEventPlanned,
    requireAuth,
    toggleFavoriteEvent,
    toggleEventPlan,
    toFavoriteEvent,
  ])

  return (
    <div className={`app theme-${theme}`}>
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <GoingCelebrationHost />
      <UploadToast
        toast={favoriteNotice ? { id: favoriteNotice.id, variant: 'error', message: favoriteNotice.message } : null}
        onDismiss={clearFavoriteNotice}
      />

      {shouldShowWelcome ? (
        <Suspense fallback={routeFallback}>
          <WelcomeScreen
            onEnterApp={(prefill, initialTab = 'discover') => {
              stashDiscoverPrefill(prefill)
              dismissWelcome()
              queueMicrotask(() => navigateShellToTab(initialTab, { replace: true }))
            }}
            onStashPrefill={stashDiscoverPrefill}
          />
        </Suspense>
      ) : (
        <main
          className={[
            activeEvent
              ? 'phone-shell phone-shell--behind-event-sheet'
              : sheetPlanOverlay
                ? 'phone-shell phone-shell--behind-plan-overlay'
                : tab === 'ask' || tab === 'discover'
                  ? `phone-shell phone-shell--discover ${isDiscoverExpanded ? 'phone-shell--expanded' : ''}`
                  : 'phone-shell',
            showOnboarding ? 'phone-shell--onboarding' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <AnimatePresence initial={false}>
            {!(isDiscoverExpanded && (tab === 'ask' || tab === 'discover')) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                style={{ overflow: 'hidden', flexShrink: 0 }}
              >
                <header className="topbar">
                  <div className="brand-wrap">
                    <img
                      className="brand-logo"
                      src="/assets/logo/b-logo.svg"
                      alt="Buzo"
                      width={34}
                      height={34}
                      decoding="async"
                    />
                  </div>
                  <div className="actions">
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                      className={`icon-btn${tab === 'favorites' ? ' icon-btn--active' : ''}`}
                      type="button"
                      onClick={() => navigateProtectedTab('favorites')}
                      aria-label="Saved events"
                      aria-current={tab === 'favorites' ? 'page' : undefined}
                    >
                      <Heart size={18} strokeWidth={tab === 'favorites' ? 2.25 : 2} aria-hidden />
                    </button>
                    <button
                      className={`icon-btn${tab === 'profile' ? ' icon-btn--active' : ''}`}
                      type="button"
                      onClick={() => navigateProtectedTab('profile')}
                      aria-label="Profile"
                      aria-current={tab === 'profile' ? 'page' : undefined}
                    >
                      <User size={18} strokeWidth={tab === 'profile' ? 2.25 : 2} aria-hidden />
                    </button>
                  </div>
                </header>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="screen">
            <Suspense fallback={<div className="tab-suspense-fallback" aria-hidden />}>
              {tab === 'discover' && (
                discoverDetailEventId ? (
                  discoverDetailEvent && discoverDetailData ? (
                    <PlanEventDetail
                      data={discoverDetailData}
                      variant="upcoming"
                      backAriaLabel={discoverMapMode ? 'Back to map' : 'Back to discover feed'}
                      onBack={closeDiscoverDetail}
                      onOpenEvent={() => undefined}
                      isFavorited={isEventFavorited(discoverDetailEvent.id)}
                      onToggleFavorite={() =>
                        requireAuth('Sign in to save this event.', () =>
                          toggleFavoriteEvent(favoriteFromDiscoverEvent(discoverDetailEvent)),
                        )
                      }
                      isPlanned={isEventPlanned(discoverDetailEvent.id)}
                      onTogglePlan={() =>
                        requireAuth('Sign in to mark yourself as going.', () => toggleEventPlan(discoverDetailEvent.id))
                      }
                    />
                  ) : (
                    <div className="plan-detail-overlay-fallback screen-content plan-home">
                      <p className="plan-home-sub">
                        {discoverDetailLoading || discoverEventsLoading
                          ? 'Loading event details...'
                          : discoverDetailError || 'Event not found'}
                      </p>
                      <button
                        type="button"
                        className="plan-segment plan-segment--on"
                        onClick={closeDiscoverDetail}
                      >
                        {discoverMapMode ? 'Back to map' : 'Back to discover'}
                      </button>
                    </div>
                  )
                ) : discoverMapMode ? (
                  <MapView
                    events={discoverEvents}
                    filters={discoverFilters}
                    onFiltersChange={setDiscoverFilters}
                    loading={discoverEventsLoading}
                    loadingMore={discoverEventsLoadingMore}
                    hasMore={discoverEventsHasMore}
                    onLoadMore={loadMoreDiscoverEvents}
                    onBackToFeed={() => setDiscoverMapMode(false)}
                    onMoreDetails={openDiscoverDetail}
                    onRefresh={refreshDiscoverEvents}
                  />
                ) : (
                  <EventCardFeed
                    events={discoverEvents}
                    filters={discoverFilters}
                    onFiltersChange={setDiscoverFilters}
                    loading={discoverEventsLoading}
                    loadingMore={discoverEventsLoadingMore}
                    error={discoverEventsError}
                    hasMore={discoverEventsHasMore}
                    totalAvailable={discoverEventsTotalAvailable}
                    onLoadMore={loadMoreDiscoverEvents}
                    onMoreDetails={openDiscoverDetail}
                    onMapView={() => setDiscoverMapMode(true)}
                    onRefresh={refreshDiscoverEvents}
                  />
                )
              )}
              {tab === 'ask' && (
                <DiscoverTab
                  onOpenEvent={openEvent}
                  prefillPrompt={discoverPrefill}
                  onConsumePrefill={consumeDiscoverPrefill}
                  events={discoverEvents}
                />
              )}
              {tab === 'favorites' && (
                <FavoritesTab
                  events={discoverEvents}
                  onOpenFavorite={(eventId) => {
                    setDiscoverMapMode(false)
                    setDiscoverDetailEventId(eventId)
                    navigate(getDiscoverEventPath(eventId))
                  }}
                />
              )}
              {tab === 'plan' && (
                <PlanTab
                  events={discoverEvents}
                  onOpenEvent={openEvent}
                />
              )}
              {tab === 'profile' && <ProfileTab />}
            </Suspense>
          </section>

          <Suspense fallback={null}>
            <AnimatePresence>
              {sheetPlanOverlay ? (
                <motion.div
                  key="sheet-plan-detail"
                  className="plan-detail-overlay"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 14 }}
                  transition={{ duration: 0.22 }}
                >
                  {sheetPlanOverlayBody}
                </motion.div>
              ) : null}
              {showBuzzPoints && <BuzzPointsScreen key="buzz-points" />}
              {showProfileTasteAll && <ProfileTasteIdentityScreen key="profile-taste-all" />}
              {showProfileReputationAll && <ProfileReputationScreen key="profile-reputation-all" />}
              {showSettings && <SettingsScreen key="settings" />}
              {showEditProfile && <EditProfileScreen key="edit-profile" />}
              {showLanguage && <LanguageScreen key="language" />}
              {showPrivacySafety && <PrivacySafetyScreen key="privacy-safety" />}
              {showReleaseNotes && <ReleaseNotesScreen key="release-notes" />}
              {showFeedback && <FeedbackScreen key="feedback" />}
              {showEmailLogin && <EmailLoginScreen key="email-login" />}
              {showSubscription && <SubscriptionScreen key="subscription" />}
              {showOnboarding && <OnboardingScreen key={onboardingMountKey} />}
            </AnimatePresence>
          </Suspense>

          <AnimatePresence initial={false}>
            {!(isDiscoverExpanded && (tab === 'ask' || tab === 'discover')) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                style={{ overflow: 'hidden', flexShrink: 0 }}
              >
                <nav className="bottom-nav" aria-label="Main">
                  {tabNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = tab === item.key

                    return (
                      <button
                        className={isActive ? 'nav-item active' : 'nav-item'}
                        key={item.key}
                        type="button"
                        onClick={() => navigateProtectedTab(item.key)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className={item.iconDot ? 'nav-item-icon nav-item-icon--plan' : 'nav-item-icon'}>
                          <Icon size={22} strokeWidth={isActive ? 2.25 : 2} aria-hidden />
                          {item.iconDot ? <span className="nav-item-plan-dot" aria-hidden /> : null}
                        </span>
                        <span className="nav-item-label">{item.label}</span>
                        {isActive ? <span className="nav-item-active-bar" aria-hidden /> : null}
                      </button>
                    )
                  })}
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}

      <Suspense fallback={null}>
        <AnimatePresence>
          {showSignIn ? <SignInSheet key="welcome-sign-in" /> : null}
        </AnimatePresence>
      </Suspense>

      <Suspense fallback={null}>
        <AnimatePresence>
          {showWelcomeBack ? <WelcomeBackScreen key="welcome-back" /> : null}
        </AnimatePresence>
      </Suspense>

      <AnimatePresence>
        {activeEvent && (
          <motion.aside
            className="event-sheet"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
          >
            <div className="event-sheet-hero">
              <img
                src={activeEvent.image}
                alt={activeEvent.title}
                className="sheet-image"
                loading="lazy"
                decoding="async"
                onError={(e) => handleEventImageError(activeEvent, e)}
              />
              <button
                className="event-sheet-close"
                type="button"
                onClick={closeEvent}
                aria-label="Close event details"
              >
                <X size={18} strokeWidth={2.25} aria-hidden />
              </button>
            </div>
            <div className="sheet-content">
              <div className="chip-row">
                <span className="chip">{activeEvent.genre}</span>
                {activeEvent.host ? <span className="chip">{activeEvent.host}</span> : null}
              </div>
              <h2>{activeEvent.title}</h2>
              <p>
                {activeEvent.venue}, {activeEvent.district} · {activeEvent.displayDateTimeLabel ?? activeEvent.time}
              </p>
              <div className="stats-grid">
                <div>
                  <span>Starts</span>
                  <strong>{activeEvent.displayDateTimeLabel ?? activeEvent.time}</strong>
                </div>
                <div>
                  <span>Entry</span>
                  <strong>{activeEvent.ticketPrice}</strong>
                </div>
              </div>
              <div className="event-sheet-actions">
                <button
                  type="button"
                  className="event-sheet-cta-primary"
                  onClick={() =>
                    requireAuth('Sign in to mark yourself as going.', () => toggleEventPlan(activeEvent.id))
                  }
                >
                  {isEventPlanned(activeEvent.id) ? 'Planned' : 'I\'m Going'}
                </button>
                {getPlanDetailUpcoming(activeEvent.id) ? (
                  <button
                    type="button"
                    className="event-sheet-details-btn"
                    aria-label={`More details for ${activeEvent.title}`}
                    onClick={() => {
                      const id = activeEvent.id
                      closeEvent()
                      requestPlanDetail(id, 'upcoming', tab)
                    }}
                  >
                    <Info size={17} strokeWidth={2} aria-hidden />
                    <span>More details</span>
                  </button>
                ) : null}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={lazyRoute(<AdminRouteGuard />)}>
        <Route index element={lazyRoute(<AdminHomePage />)} />
        <Route path="admin-users" element={lazyRoute(<AdminUsersPage />)} />
        <Route path="user-analytics" element={lazyRoute(<UserAnalyticsPage />)} />
        <Route path="event-list" element={lazyRoute(<EventListPage />)} />
        <Route path="weather-map" element={lazyRoute(<AdminWeatherMapPage />)} />
        <Route path="design-theme" element={<Navigate to="/admin/design-theme/orange" replace />} />
        <Route path="design-theme/orange" element={lazyRoute(<DesignThemeOrangePage />)} />
        <Route path="design-theme/purple" element={lazyRoute(<DesignThemePurplePage />)} />
      </Route>
      <Route path="/event-list" element={<Navigate to="/admin/event-list" replace />} />
      <Route path="/not-found-404" element={lazyRoute(<NotFound404Page />)} />
      <Route path="/design-theme" element={<Navigate to="/admin/design-theme/orange" replace />} />
      <Route path="/design-theme/orange" element={<Navigate to="/admin/design-theme/orange" replace />} />
      <Route path="/design-theme/purple" element={<Navigate to="/admin/design-theme/purple" replace />} />
      {/* One route so MainApp does not remount when switching tabs (preserves local UI state). */}
      <Route path="*" element={<MainApp />} />
    </Routes>
  )
}

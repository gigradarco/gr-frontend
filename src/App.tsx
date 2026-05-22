import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { navigateShellToTab, pathToTab, setShellNavigate } from './lib/tabRoutes'
import { SESSION_PENDING_HOME_COMPOSER_PREFILL_KEY } from './lib/session'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Info, Moon, Sun, User, X } from 'lucide-react'
import {
  getPlanDetailPast,
  getPlanDetailUpcoming,
} from './data/demoData'
import { useAppState, type FavoriteEvent } from './store/appStore'
import type { EventItem, PlanPageEvent, Tab } from './types'
import { PlanEventDetail } from './views/plan/PlanEventDetail'
import { tabNavItems } from './config/tabNavigation'
import { EventCardFeed } from './views/discover/EventCardFeed'
import { MapView } from './views/discover/MapView'
import { FavoritesTab } from './views/favorites/FavoritesTab'
import { BuzzPointsScreen } from './views/profile/BuzzPointsScreen'
import { ProfileReputationScreen } from './views/profile/ProfileReputationScreen'
import { ProfileTasteIdentityScreen } from './views/profile/ProfileTasteIdentityScreen'
import {
  SettingsScreen,
  EditProfileScreen,
  LanguageScreen,
  PrivacySafetyScreen,
  FeedbackScreen,
  EmailLoginScreen,
  SubscriptionScreen,
} from './views/profile/settings'
import { OnboardingScreen } from './views/onboarding'
import { WelcomeScreen, SignInSheet, WelcomeBackScreen } from './views/welcome'
import { DesignThemePage } from './views/design-theme/DesignThemePage'
import { DesignThemeOrangePage } from './views/design-theme/DesignThemeOrangePage'
import { DesignThemePurplePage } from './views/design-theme/DesignThemePurplePage'
import { AdminHomePage } from './views/admin-home/AdminHomePage'
import { EventListPage } from './views/event-list/EventListPage'
import { NotFound404Page } from './views/not-found/NotFound404Page'
import { useDiscoverEvents } from './lib/useDiscoverEvents'
import { handleEventImageError } from './lib/event-image-fallback'

const DiscoverTab = lazy(() =>
  import('./views/discover/DiscoverTab').then((m) => ({ default: m.DiscoverTab })),
)
const PlanTab = lazy(() =>
  import('./views/plan/PlanTab').then((m) => ({ default: m.PlanTab })),
)
const ProfileTab = lazy(() =>
  import('./views/profile/ProfileTab').then((m) => ({ default: m.ProfileTab })),
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
    heroImage: event.image,
    displayTitle: event.title,
    artistLine: event.host ? `HOST · ${event.host}` : cleanLabel(event.genre, 'LIVE EVENT').toUpperCase(),
    genreTags: liveEventGenreTags(event),
    venueLine: venueLine || event.venue || event.district || 'Venue TBA',
    mapQuery: venueLine || coordinateQuery || undefined,
    timeRange: dateTimeLabel,
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
    showFeedback,
    showEmailLogin,
    showEditProfile,
    showSubscription,
    showOnboarding,
    onboardingMountKey,
    dismissWelcome,
    setTab,
    setTheme,
    openEvent,
    closeEvent,
    requestPlanDetail,
    toggleFavoriteEvent,
    isEventFavorited,
    pendingPlanDetail,
    clearPendingPlanDetail,
    isDiscoverExpanded,
    feedLocationCityId,
  } = useAppState()
  const navigate = useNavigate()
  const location = useLocation()

  useLayoutEffect(() => {
    setShellNavigate(navigate)
    return () => setShellNavigate(null)
  }, [navigate])

  useLayoutEffect(() => {
    if (!welcomeDismissed) return
    const { pathname } = location
    if (pathname === '/' || pathname === '') {
      navigate('/discover', { replace: true })
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
  }, [welcomeDismissed, location.pathname, navigate, tab, setTab])

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
  const [discoverDetailEventId, setDiscoverDetailEventId] = useState<string | null>(null)

  const {
    events: discoverEvents,
    loading: discoverEventsLoading,
    loadingMore: discoverEventsLoadingMore,
    error: discoverEventsError,
    hasMore: discoverEventsHasMore,
    loadMore: loadMoreDiscoverEvents,
  } = useDiscoverEvents(feedLocationCityId)

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
  const discoverDetailEvent = useMemo(
    () => discoverEvents.find((event) => event.id === discoverDetailEventId) ?? null,
    [discoverDetailEventId, discoverEvents],
  )
  const discoverDetailData = useMemo(
    () => (discoverDetailEvent ? planDetailFromDiscoverEvent(discoverDetailEvent) : null),
    [discoverDetailEvent],
  )

  const openDiscoverDetail = useCallback(
    (eventId: string) => {
      if (!discoverEvents.some((event) => event.id === eventId)) {
        openEvent(eventId)
        return
      }
      closeEvent()
      setDiscoverDetailEventId(eventId)
    },
    [closeEvent, discoverEvents, openEvent],
  )

  const closeDiscoverDetail = useCallback(() => {
    setDiscoverDetailEventId(null)
  }, [])

  useEffect(() => {
    if (tab !== 'discover') {
      setDiscoverDetailEventId(null)
    }
  }, [tab])

  useEffect(() => {
    if (discoverDetailEventId && !discoverEventsLoading && !discoverDetailEvent) {
      setDiscoverDetailEventId(null)
    }
  }, [discoverDetailEvent, discoverDetailEventId, discoverEventsLoading])

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
          toggleFavoriteEvent(toFavoriteEvent(data.eventId, sheetPlanOverlay.kind, data))
        }
      />
    )
  }, [
    sheetPlanOverlay,
    sheetPlanReturnTab,
    closeSheetPlanOverlay,
    openEvent,
    isEventFavorited,
    toggleFavoriteEvent,
    toFavoriteEvent,
  ])

  return (
    <div className={`app theme-${theme}`}>
      <div className="glow glow-1" />
      <div className="glow glow-2" />

      {!welcomeDismissed ? (
        <WelcomeScreen
          onEnterApp={(prefill, initialTab = 'discover') => {
            stashDiscoverPrefill(prefill)
            dismissWelcome()
            queueMicrotask(() => navigateShellToTab(initialTab, { replace: true }))
          }}
          onStashPrefill={stashDiscoverPrefill}
        />
      ) : (
        <main
          className={[
            activeEvent
              ? 'phone-shell phone-shell--behind-event-sheet'
              : sheetPlanOverlay
                ? 'phone-shell phone-shell--behind-plan-overlay'
                : tab === 'ask'
                  ? `phone-shell phone-shell--discover ${isDiscoverExpanded ? 'phone-shell--expanded' : ''}`
                  : 'phone-shell',
            showOnboarding ? 'phone-shell--onboarding' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <AnimatePresence initial={false}>
            {!(isDiscoverExpanded && tab === 'ask') && (
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
                      onClick={() => navigateShellToTab('favorites')}
                      aria-label="Saved events"
                      aria-current={tab === 'favorites' ? 'page' : undefined}
                    >
                      <Heart size={18} strokeWidth={tab === 'favorites' ? 2.25 : 2} aria-hidden />
                    </button>
                    <button
                      className={`icon-btn${tab === 'profile' ? ' icon-btn--active' : ''}`}
                      type="button"
                      onClick={() => navigateShellToTab('profile')}
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
                discoverDetailEvent && discoverDetailData ? (
                  <PlanEventDetail
                    data={discoverDetailData}
                    variant="upcoming"
                    backAriaLabel={discoverMapMode ? 'Back to map' : 'Back to discover feed'}
                    onBack={closeDiscoverDetail}
                    onOpenEvent={() => undefined}
                    isFavorited={isEventFavorited(discoverDetailEvent.id)}
                    onToggleFavorite={() => toggleFavoriteEvent(favoriteFromDiscoverEvent(discoverDetailEvent))}
                  />
                ) : discoverMapMode ? (
                  <MapView
                    events={discoverEvents}
                    onBackToFeed={() => setDiscoverMapMode(false)}
                    onMoreDetails={openDiscoverDetail}
                  />
                ) : (
                  <EventCardFeed
                    events={discoverEvents}
                    loading={discoverEventsLoading}
                    loadingMore={discoverEventsLoadingMore}
                    error={discoverEventsError}
                    hasMore={discoverEventsHasMore}
                    onLoadMore={loadMoreDiscoverEvents}
                    onMoreDetails={openDiscoverDetail}
                    onMapView={() => setDiscoverMapMode(true)}
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
                  onOpenFavorite={(event) => {
                    requestPlanDetail(event.id, event.variant, 'favorites')
                    navigateShellToTab('plan')
                  }}
                />
              )}
              {tab === 'plan' && <PlanTab onOpenEvent={openEvent} />}
              {tab === 'profile' && <ProfileTab />}
            </Suspense>
          </section>

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
            {showFeedback && <FeedbackScreen key="feedback" />}
            {showEmailLogin && <EmailLoginScreen key="email-login" />}
            {showSubscription && <SubscriptionScreen key="subscription" />}
            {showOnboarding && <OnboardingScreen key={onboardingMountKey} />}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!(isDiscoverExpanded && tab === 'ask') && (
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
                        onClick={() => navigateShellToTab(item.key)}
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

      <AnimatePresence>
        {showSignIn ? <SignInSheet key="welcome-sign-in" /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeBack ? <WelcomeBackScreen key="welcome-back" /> : null}
      </AnimatePresence>

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
                <button type="button" className="event-sheet-cta-primary">
                  I&apos;m Going
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
      <Route path="/admin" element={<AdminHomePage />} />
      <Route path="/event-list" element={<EventListPage />} />
      <Route path="/not-found-404" element={<NotFound404Page />} />
      {/* Nested so /design-theme/purple never competes with the /design-theme index */}
      <Route path="/design-theme" element={<Outlet />}>
        <Route index element={<DesignThemePage />} />
        <Route path="orange" element={<DesignThemeOrangePage />} />
        <Route path="purple" element={<DesignThemePurplePage />} />
      </Route>
      {/* One route so MainApp does not remount when switching tabs (preserves local UI state). */}
      <Route path="*" element={<MainApp />} />
    </Routes>
  )
}

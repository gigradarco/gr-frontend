import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Lock, LogOut, Settings, Sparkles } from 'lucide-react'
import { BUZO_PRO_UPSELL_CTA } from '../../config/pricing'
import { buzzSummary, getBuzzTierState } from '../../data/demoData'
import {
  mapReputationBadgeFromApi,
  reputationBadgesFallback,
  TASTE_AND_RECOMMENDATIONS_TITLE,
} from '../../data/profileIdentity'
import {
  getCachedAvatarDataUrl,
  persistAvatarToLocalCache,
  warmAvatarCacheIfEmpty,
} from '../../lib/avatar-image-cache.ts'
import { postProfileTastePreferences, postSignOut } from '../../lib/auth-api'
import { navigateShellToTab } from '../../lib/tabRoutes'
import { api } from '../../lib/trpc'
import { useAppState } from '../../store/appStore'

export const PROFILE_EXPERIENCE_RING_FALLBACK = 0.75

function ProfileScreenSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className="screen-content profile-screen profile-screen--skeleton"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="profile-toolbar profile-toolbar--skeleton">
        <span className="profile-skel profile-skel--icon" />
        <span className="profile-skel profile-skel--icon" />
      </div>
      <div className="profile-hero-new profile-hero-new--skeleton">
        <div className="profile-skel profile-skel--avatar" />
        <div className="profile-skel profile-skel--title" />
        <div className="profile-skel profile-skel--pill" />
      </div>
      <section className="profile-section profile-section--skeleton" aria-hidden>
        <div className="profile-skel profile-skel--section-rule" />
        <div className="profile-skel-chips">
          <span className="profile-skel profile-skel--chip" />
          <span className="profile-skel profile-skel--chip" />
          <span className="profile-skel profile-skel--chip profile-skel--chip-wide" />
          <span className="profile-skel profile-skel--chip" />
        </div>
      </section>
      <section className="profile-section profile-section--skeleton" aria-hidden>
        <div className="profile-skel profile-skel--section-rule" />
        <div className="profile-skel-badges">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="profile-skel-badge-wrap">
              <span className="profile-skel profile-skel--badge" />
              <span className="profile-skel profile-skel--badge-label" />
            </div>
          ))}
        </div>
        <div className="profile-skel profile-skel--note" />
      </section>
    </div>
  )
}

export function ProfileTab() {
  const {
    openSettings,
    openProfileReputationAll,
    openSubscription,
    returnToLanding,
    userProfile,
    isAuthenticated,
    authSessionHydrated,
    subscriptionTier,
    tasteIdentityItems,
    savedTasteLabels,
    setSavedTasteLabels,
  } = useAppState()

  // ── Inline taste editing ────────────────────────────────────────────────
  const [tasteEditing, setTasteEditing] = useState(false)
  const [tasteSelected, setTasteSelected] = useState<Set<string>>(new Set())
  const [tasteSaving, setTasteSaving] = useState(false)
  const [tasteSaveError, setTasteSaveError] = useState<string | null>(null)
  const saveTimerRef = useRef<number | null>(null)


  const openTasteEdit = useCallback(() => {
    setTasteSelected(new Set(savedTasteLabels))
    setTasteSaveError(null)
    setTasteEditing(true)
  }, [savedTasteLabels])

  const cancelTasteEdit = useCallback(() => {
    setTasteEditing(false)
    setTasteSaveError(null)
  }, [])

  const toggleTasteLabel = useCallback((label: string) => {
    setTasteSelected((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
    setTasteSaveError(null)
  }, [])

  const saveTaste = useCallback(async () => {
    setTasteSaving(true)
    setTasteSaveError(null)
    const labels = [...tasteSelected].sort()
    try {
      await postProfileTastePreferences(labels)
      setSavedTasteLabels(labels)
      setTasteEditing(false)
    } catch (err) {
      setTasteSaveError(err instanceof Error ? err.message : 'Could not save. Try again.')
    } finally {
      setTasteSaving(false)
    }
  }, [tasteSelected, setSavedTasteLabels])

  // Clean up any pending timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    }
  }, [])
  // ───────────────────────────────────────────────────────────────────────
  const { current: buzzTier } = getBuzzTierState(buzzSummary.total)
  const headline =
    userProfile.displayName.trim() !== ''
      ? userProfile.displayName.trim()
      : `@${userProfile.username}`
  const avatarLabel =
    userProfile.displayName.trim() !== '' ? userProfile.displayName.trim() : userProfile.username
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  /** Bumps when `warmAvatarCacheIfEmpty` writes so the `<img>` remounts with the cached data URL. */
  const [avatarCacheRevision, setAvatarCacheRevision] = useState(0)
  const remoteAvatarUrl = userProfile.avatarUrl
  const cachedAvatarSrc = getCachedAvatarDataUrl(remoteAvatarUrl)
  const avatarDisplaySrc = cachedAvatarSrc ?? remoteAvatarUrl
  const [tooltipBadgeId, setTooltipBadgeId] = useState<string | null>(null)
  const reputationQuery = api.profile.reputation.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 60_000,
  })

  const tasteCount = tasteEditing ? tasteSelected.size : savedTasteLabels.size
  const reputationBadges =
    reputationQuery.data?.badges.map(mapReputationBadgeFromApi) ?? reputationBadgesFallback
  const earnedReputationBadges = reputationBadges.filter((badge) => badge.status === 'earned')
  const recentEarnedReputationBadges = [...earnedReputationBadges].sort((a, b) => {
    const aTs = a.earnedAt ? Date.parse(a.earnedAt) : Number.NaN
    const bTs = b.earnedAt ? Date.parse(b.earnedAt) : Number.NaN
    const aValid = Number.isFinite(aTs)
    const bValid = Number.isFinite(bTs)
    if (aValid && bValid) return bTs - aTs
    if (aValid) return -1
    if (bValid) return 1
    return 0
  })
  const badgesPreview =
    (recentEarnedReputationBadges.length > 0 ? recentEarnedReputationBadges : reputationBadges).slice(0, 3)
  const badgeCount = earnedReputationBadges.length
  const reputationPreviewCopy =
    earnedReputationBadges.length > 0
      ? `Showing latest ${badgesPreview.length} earned badge${badgesPreview.length === 1 ? '' : 's'} (up to 3).`
      : 'No earned badges yet. Showing starter badges.'

  // Redirect guests away from profile — only after session sync so refresh does not flash sign-in.
  useEffect(() => {
    if (!authSessionHydrated || isAuthenticated) return
    navigateShellToTab('discover', { replace: true })
    const t = window.setTimeout(() => {
      useAppState.setState({
        showSignIn: true,
        signInRedirectError: 'Please sign in to view your profile.',
        signInPromptMessage: null,
      })
    }, 300)
    return () => window.clearTimeout(t)
  }, [authSessionHydrated, isAuthenticated])

  useEffect(() => {
    setAvatarLoaded(false)
    setAvatarFailed(false)
  }, [avatarDisplaySrc])

  useEffect(() => {
    if (!isAuthenticated || !remoteAvatarUrl?.trim()) return
    let cancelled = false
    void warmAvatarCacheIfEmpty(remoteAvatarUrl.trim()).then((wrote: boolean) => {
      if (!cancelled && wrote) setAvatarCacheRevision((t) => t + 1)
    })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, remoteAvatarUrl])

  const showProfileSkeleton =
    !authSessionHydrated ||
    !isAuthenticated ||
    (isAuthenticated && reputationQuery.isPending)

  if (showProfileSkeleton) {
    const skeletonAria =
      !authSessionHydrated ? 'Loading profile' : !isAuthenticated ? 'Redirecting' : 'Loading profile'
    return <ProfileScreenSkeleton ariaLabel={skeletonAria} />
  }

  return (
    <motion.div
      className="screen-content profile-screen"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="profile-toolbar">
        <button
          className="icon-btn"
          type="button"
          aria-label="Open settings"
          onClick={openSettings}
        >
          <Settings size={18} />
        </button>
        <button
          className="icon-btn profile-toolbar-logout"
          type="button"
          aria-label="Log out"
          onClick={() => {
            void postSignOut().finally(() => returnToLanding())
          }}
        >
          <LogOut size={18} aria-hidden />
        </button>
      </div>

      {/* Hero */}
      <div className={`profile-hero-new${subscriptionTier === 'pro' ? ' profile-hero-new--pro' : ''}`}>
        {subscriptionTier === 'pro' ? (
          <>
            <span className="profile-pro-stars" aria-hidden>
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className={`profile-pro-star profile-pro-star--${i + 1}`} />
              ))}
            </span>
            {/* Fog lives here — outside avatar-wrap so it never bleeds into the photo */}
            <span className="profile-pro-mist" aria-hidden>
              <span className="profile-pro-mist__blob profile-pro-mist__blob--1" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--2" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--3" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--4" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--5" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--6" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--7" />
              <span className="profile-pro-mist__blob profile-pro-mist__blob--8" />
            </span>
          </>
        ) : null}
        <div className="profile-avatar-wrap">
          <div
            className={`profile-avatar-ring${subscriptionTier === 'pro' ? ' profile-avatar-ring--pro' : ''}`}
          >
            <div className={`profile-avatar-inner${avatarLoaded && !avatarFailed ? ' is-loaded' : ''}`}>
              <span className="profile-avatar-placeholder" aria-hidden>
                {avatarFailed ? (
                  <span className="profile-avatar-initial">
                    {avatarLabel.charAt(0).toUpperCase()}
                  </span>
                ) : null}
              </span>
              {!avatarFailed && avatarDisplaySrc ? (
                <img
                  key={`${avatarDisplaySrc}:${avatarCacheRevision}`}
                  src={avatarDisplaySrc}
                  alt={avatarLabel}
                  className="profile-avatar-img"
                  decoding="async"
                  fetchPriority="high"
                  loading="eager"
                  onLoad={(e) => {
                    setAvatarLoaded(true)
                    if (remoteAvatarUrl) persistAvatarToLocalCache(remoteAvatarUrl, e.currentTarget)
                  }}
                  onError={() => {
                    setAvatarFailed(true)
                    setAvatarLoaded(false)
                  }}
                />
              ) : null}
              <span className="profile-avatar-gloss" aria-hidden />
            </div>
          </div>
          <span className="profile-rank-badge" style={{ display: 'none' }} aria-hidden>
            Lv.{buzzTier.level} {buzzTier.label}
          </span>
        </div>
        <h2
          className="profile-display-name"
          data-profile-headline={userProfile.displayName.trim() !== '' ? 'display' : 'handle'}
        >
          {headline}
        </h2>
        {subscriptionTier === 'pro' ? (
          <span className="profile-pro-badge" aria-label="Buzo Pro member">
            <Sparkles size={11} strokeWidth={2.5} aria-hidden />
            Buzo Pro
          </span>
        ) : null}
        <span className="profile-handle-pill">@{userProfile.username}</span>
      </div>

      {/* Taste & recommendations */}
      <section className="profile-section" aria-labelledby="profile-taste-heading">
        <div className="section-title-rule section-title-rule--with-action" id="profile-taste-heading">
          <span className="section-title-rule__text">
            {TASTE_AND_RECOMMENDATIONS_TITLE}{' '}
            <span className="section-title-count">({tasteCount})</span>
          </span>
          <span className="section-title-rule__line" aria-hidden />
          {tasteEditing ? (
            <span className="taste-inline-actions">
              <button
                type="button"
                className="section-title-action section-title-action--muted"
                onClick={cancelTasteEdit}
                disabled={tasteSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="section-title-action"
                onClick={saveTaste}
                disabled={tasteSaving}
                aria-busy={tasteSaving}
              >
                {tasteSaving ? 'Saving…' : 'Save'}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="section-title-action"
              onClick={openTasteEdit}
            >
              Edit
            </button>
          )}
        </div>
        {!tasteEditing && savedTasteLabels.size === 0 && (
          <button
            type="button"
            className="taste-empty-prompt"
            onClick={openTasteEdit}
          >
            Add your sound — pick the genres that move you.
          </button>
        )}
        <div className={`taste-tags${tasteEditing ? ' taste-tags--editing' : ''}`}>
          {tasteIdentityItems.map((g) => {
            if (!tasteEditing) {
              if (!savedTasteLabels.has(g.label)) return null
              return (
                <span key={g.label} className="taste-tag">
                  {g.label}
                </span>
              )
            }
            const active = tasteSelected.has(g.label)
            return (
              <button
                key={g.label}
                type="button"
                className={`taste-tag taste-tag--toggle${active ? ' taste-tag--active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleTasteLabel(g.label)}
                disabled={tasteSaving}
              >
                {active ? <Check size={11} aria-hidden /> : null}
                {g.label}
              </button>
            )
          })}
        </div>
        {tasteSaveError ? (
          <p className="profile-taste-save-error" role="alert">{tasteSaveError}</p>
        ) : null}
      </section>

      {/* Reputation */}
      <section className="profile-section" aria-labelledby="profile-reputation-heading">
        <div className="section-title-rule section-title-rule--with-action" id="profile-reputation-heading">
          <span className="section-title-rule__text">
            Reputation <span className="section-title-count">({badgeCount})</span>
          </span>
          <span className="section-title-rule__line" aria-hidden />
          <button
            type="button"
            className="section-title-action"
            onClick={openProfileReputationAll}
          >
            Show all
          </button>
        </div>
        <div className="badges-row">
          {badgesPreview.map(({ id, icon: Icon, label, status, unlockHint, progressValue, progressTarget }, i) => {
            const active = status === 'earned'
            const inProgress = status === 'in_progress'
            const tooltipText =
              status === 'earned'
                ? `Earned. ${unlockHint}`
                : `${unlockHint} (${progressValue}/${progressTarget})`
            return (
              <div key={`${id}-${i}`} className="badge-item">
                <button
                  type="button"
                  className={`badge-icon badge-icon-btn${active ? ' badge-icon--active' : ''}${
                    inProgress ? ' badge-icon--in-progress' : ''
                  }`}
                  title={tooltipText}
                  aria-label={`${label.replace('\n', ' ')}: ${tooltipText}`}
                  onClick={() => setTooltipBadgeId((current) => (current === id ? null : id))}
                >
                  <Icon size={28} />
                </button>
                <span className="badge-label">{label}</span>
                {tooltipBadgeId === id ? (
                  <div className="badge-tooltip" role="status">
                    {tooltipText}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="profile-reputation-preview-note">{reputationPreviewCopy}</p>
      </section>

      {subscriptionTier === 'free' ? (
        <div className="gopro-card">
          <div className="gopro-lock">
            <Lock size={22} />
          </div>
          <h3 className="gopro-title">LEVEL UP YOUR LEGEND</h3>
          <p className="gopro-desc">
            Unlock your full 3-year history, deep data analytics, and early access to buzzed
            guestlists.
          </p>
          <button type="button" className="gopro-btn" onClick={openSubscription}>
            {BUZO_PRO_UPSELL_CTA}
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}

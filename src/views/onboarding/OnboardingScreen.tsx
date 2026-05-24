import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Crosshair, MapPin, X } from 'lucide-react'
import { UploadToast, type UploadToastState } from '../../components/UploadToast'
import { CityCatalogPanel } from '../../components/CityCatalogPanel'
import { OnboardingGeoPreviewMap } from '../../components/OnboardingGeoPreviewMap'
import { ONBOARDING_GENRES } from '../../data/onboarding'
import {
  DEFAULT_LOCATION_CITY_ID,
  distanceKmToLocationCity,
  findNearestLocationCityId,
  getLocationCityById,
  getLocationCityCentroid,
  primaryCityIdFromSelection,
} from '../../data/locationRegions'
import { useAppState } from '../../store/appStore'
import { ONBOARDING_CITIES_STORAGE_KEY } from '../../config/storage'

function readInitialCitySelection(feedLocationCityId: string): string[] {
  if (typeof window === 'undefined') {
    const id = getLocationCityById(feedLocationCityId) ? feedLocationCityId : DEFAULT_LOCATION_CITY_ID
    return [id]
  }
  try {
    const raw = window.localStorage.getItem(ONBOARDING_CITIES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleaned = parsed.filter(
          (x): x is string => typeof x === 'string' && Boolean(getLocationCityById(x)),
        )
        if (cleaned.length > 0) return [cleaned[0]!]
      }
    }
  } catch {
    /* ignore */
  }
  const id = getLocationCityById(feedLocationCityId) ? feedLocationCityId : DEFAULT_LOCATION_CITY_ID
  return [id]
}

function OnboardingGrain() {
  return (
    <svg className="onboarding-grain" aria-hidden>
      <filter id="onboarding-grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#onboarding-grain-filter)" />
    </svg>
  )
}

export function OnboardingScreen() {
  const onboardingSource = useAppState((s) => s.onboardingSource)
  const isAuthenticated = useAppState((s) => s.isAuthenticated)
  const closeOnboarding = useAppState((s) => s.closeOnboarding)
  const applyOnboardingCity = useAppState((s) => s.applyOnboardingCity)
  const feedLocationCityId = useAppState((s) => s.feedLocationCityId)
  const setLocationPermission = useAppState((s) => s.setLocationPermission)
  const setLocationPreferenceMode = useAppState((s) => s.setLocationPreferenceMode)
  const theme = useAppState((s) => s.theme)

  const showLocationMode = onboardingSource === 'settings' && isAuthenticated
  const [locMode, setLocMode] = useState(() => useAppState.getState().locationPreferenceMode)
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [autoDetectedCityId, setAutoDetectedCityId] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const [step, setStep] = useState(0)
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>(() =>
    readInitialCitySelection(feedLocationCityId),
  )
  const [citySearchQuery, setCitySearchQuery] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [vis, setVis] = useState(false)
  const [toast, setToast] = useState<UploadToastState>(null)
  useEffect(() => {
    const t = window.setTimeout(() => setVis(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  const toggleGenre = useCallback((id: string) => {
    setSelectedGenres((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const toggleCity = useCallback((id: string) => {
    setSelectedCityIds((prev) => {
      if (prev.includes(id)) return prev  // already selected, keep it
      return [id]                          // single-select: replace
    })
  }, [])

  const handleClose = useCallback(() => {
    closeOnboarding()
  }, [closeOnboarding])

  const runGeoLocate = useCallback(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      window.alert('Location is not available on this browser. Choose a city manually.')
      setLocMode('city')
      setLocationPreferenceMode('city')
      setGeoStatus('error')
      return
    }

    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setGeoCoords({ lat, lng })
        setAutoDetectedCityId(findNearestLocationCityId(lat, lng))
        setGeoStatus('ready')
        setLocationPermission('granted')
      },
      (err) => {
        if (err.code === 1) {
          setLocationPermission('denied')
          setLocMode('city')
          setLocationPreferenceMode('city')
          setGeoCoords(null)
          setAutoDetectedCityId(null)
          setGeoStatus('idle')
          window.alert('Location permission denied. Choose a city manually.')
          return
        }
        setLocationPermission('unknown')
        setGeoStatus('error')
        window.alert('Could not read your location. Try again or use manual select.')
      },
      { timeout: 10_000, enableHighAccuracy: false, maximumAge: 120_000 },
    )
  }, [setLocationPermission, setLocationPreferenceMode])

  useEffect(() => {
    if (!showLocationMode || locMode !== 'precise') return
    if (geoStatus !== 'idle') return
    runGeoLocate()
  }, [showLocationMode, locMode, geoStatus, runGeoLocate])

  const goNextFromCity = useCallback(() => {
    if (showLocationMode && locMode === 'precise') {
      setLocationPreferenceMode('precise')
      const resolved =
        autoDetectedCityId && getLocationCityById(autoDetectedCityId)
          ? autoDetectedCityId
          : feedLocationCityId
      const cityId = getLocationCityById(resolved) ? resolved : DEFAULT_LOCATION_CITY_ID
      try {
        window.localStorage.setItem(ONBOARDING_CITIES_STORAGE_KEY, JSON.stringify([cityId]))
      } catch {
        /* ignore */
      }
      applyOnboardingCity(cityId)
      setStep(1)
      return
    }

    if (selectedCityIds.length === 0) return
    const primary = primaryCityIdFromSelection(selectedCityIds)
    try {
      window.localStorage.setItem(ONBOARDING_CITIES_STORAGE_KEY, JSON.stringify(selectedCityIds))
    } catch {
      /* ignore */
    }
    if (showLocationMode) {
      setLocationPreferenceMode('city')
    }
    applyOnboardingCity(primary)
    setStep(1)
  }, [
    applyOnboardingCity,
    locMode,
    selectedCityIds,
    setLocationPreferenceMode,
    showLocationMode,
    autoDetectedCityId,
    feedLocationCityId,
  ])

  const cityCtaDisabled =
    showLocationMode && locMode === 'precise'
      ? geoStatus !== 'ready'
      : selectedCityIds.length === 0

  const finish = useCallback(() => {
    if (selectedGenres.length === 0) return
    // Write feed category filter to localStorage — separate from Taste & Recommendations
    try {
      window.localStorage.setItem('buzo-feed-category-ids', JSON.stringify(selectedGenres))
    } catch { /* ignore */ }
    setToast({
      id: Date.now(),
      variant: 'success',
      message: 'All set! Your feed is ready.',
    })
    window.setTimeout(closeOnboarding, 1200)
  }, [closeOnboarding, selectedGenres])

  const showHeaderBack = onboardingSource === 'settings' || step > 0

  return (
    <motion.div
      className="onboarding-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <OnboardingGrain />

      <header className="onboarding-top">
        {showHeaderBack ? (
          <button
            type="button"
            className="onboarding-icon-btn"
            onClick={() => (step === 0 ? handleClose() : setStep(0))}
            aria-label={step === 0 ? 'Close onboarding' : 'Back'}
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
        ) : (
          <span className="onboarding-header-spacer" />
        )}
        <div className="onboarding-progress" aria-hidden>
          <span
            className="onboarding-progress-bar"
            style={{ width: step === 0 ? '33%' : '100%' }}
          />
          <span className={`onboarding-progress-dot${step >= 1 ? ' onboarding-progress-dot--on' : ''}`} />
          <span className={`onboarding-progress-dot${step >= 1 ? ' onboarding-progress-dot--on' : ''}`} />
        </div>
        {onboardingSource === 'signup' && step === 0 ? (
          <button type="button" className="onboarding-icon-btn" onClick={handleClose} aria-label="Skip">
            <X size={20} strokeWidth={2} />
          </button>
        ) : (
          <span className="onboarding-header-spacer" />
        )}
      </header>

      {step === 0 ? (
        <div className="onboarding-splash">
          <div
            className="onboarding-splash-hero"
            style={{
              opacity: vis ? 1 : 0,
              transform: vis ? 'translateY(0)' : 'translateY(14px)',
            }}
          >
            <p className="onboarding-step-label onboarding-step-label--splash">Location</p>
            <div className="onboarding-rule" aria-hidden />
            <h2 className="onboarding-serif-title">
              WHAT&apos;S <span className="onboarding-serif-accent">ON</span> TONIGHT
            </h2>
          </div>

          <div
            className="onboarding-splash-cities"
            style={{
              opacity: vis ? 1 : 0,
              transition: 'opacity 0.6s 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {showLocationMode ? (
              <section className="onboarding-location-mode" aria-label="City source">
                <h3 className="location-settings-section-title">Current city</h3>
                <div
                  className="location-settings-mode-grid"
                  role="radiogroup"
                  aria-label="How to set your city"
                >
                  <button
                    type="button"
                    className={
                      locMode === 'precise'
                        ? 'location-settings-mode-btn is-active'
                        : 'location-settings-mode-btn'
                    }
                    role="radio"
                    aria-checked={locMode === 'precise'}
                    onClick={() => {
                      setLocMode('precise')
                      setLocationPreferenceMode('precise')
                      setGeoCoords(null)
                      setAutoDetectedCityId(null)
                      setGeoStatus('idle')
                    }}
                  >
                    <Crosshair size={16} aria-hidden />
                    <span>Auto-detect</span>
                  </button>
                  <button
                    type="button"
                    className={
                      locMode === 'city'
                        ? 'location-settings-mode-btn is-active'
                        : 'location-settings-mode-btn'
                    }
                    role="radio"
                    aria-checked={locMode === 'city'}
                    onClick={() => {
                      setLocMode('city')
                      setLocationPreferenceMode('city')
                      setGeoCoords(null)
                      setAutoDetectedCityId(null)
                      setGeoStatus('idle')
                    }}
                  >
                    <MapPin size={16} aria-hidden />
                    <span>Manual select</span>
                  </button>
                </div>
              </section>
            ) : null}

            {showLocationMode && locMode === 'precise' ? (
              <div className="onboarding-geo-wrap">
                {geoStatus === 'error' ? (
                  <p className="onboarding-city-hint onboarding-city-hint--precise">
                    Could not load your position. Try <strong>Auto-detect</strong> again or use{' '}
                    <strong>Manual select</strong>.
                  </p>
                ) : null}
                {geoStatus === 'idle' || geoStatus === 'loading' ? (
                  <p className="onboarding-city-hint onboarding-city-hint--precise">
                    Getting your location…
                  </p>
                ) : null}
                {geoStatus === 'ready' && geoCoords && autoDetectedCityId
                  ? (() => {
                      const cityCenter = getLocationCityCentroid(autoDetectedCityId)
                      if (!cityCenter) return null
                      const dist = distanceKmToLocationCity(
                        geoCoords.lat,
                        geoCoords.lng,
                        autoDetectedCityId,
                      )
                      const distLabel =
                        dist == null ? '' : dist < 1 ? 'less than 1 km away' : `~${Math.round(dist)} km away`
                      const cityLabel = getLocationCityById(autoDetectedCityId)?.name
                      return (
                        <>
                          <div className="onboarding-geo-map-shell">
                            <OnboardingGeoPreviewMap
                              userLatLng={[geoCoords.lat, geoCoords.lng]}
                              cityLatLng={cityCenter}
                              theme={theme}
                            />
                          </div>
                          <p className="onboarding-geo-nearest">
                            Closest city in Buzo: <strong>{cityLabel}</strong>
                            {distLabel ? (
                              <>
                                {' '}
                                <span className="onboarding-geo-dist">({distLabel})</span>
                              </>
                            ) : null}
                          </p>
                          <div className="onboarding-geo-legend" aria-hidden>
                            <span className="onboarding-geo-legend-item">
                              <span className="onboarding-geo-dot onboarding-geo-dot--you" /> You
                            </span>
                            <span className="onboarding-geo-legend-item">
                              <span className="onboarding-geo-dot onboarding-geo-dot--city" /> City center
                            </span>
                          </div>
                          <p className="onboarding-city-hint onboarding-city-hint--precise onboarding-city-hint--tight">
                            We’ll use your position for the feed when possible; <strong>{cityLabel}</strong> is
                            your catalog fallback. Use manual if you want a different city.
                          </p>
                        </>
                      )
                    })()
                  : null}
              </div>
            ) : (
              <>
                <p className="onboarding-discovering-label">Discovering in</p>
                <p className="onboarding-city-hint">
                  Same cities as Discover. Tap any; your feed uses the first listed below.
                </p>
                <CityCatalogPanel
                  searchQuery={citySearchQuery}
                  onSearchQueryChange={setCitySearchQuery}
                  selectedCityIds={selectedCityIds}
                  onCityClick={toggleCity}
                  multiselect
                  listboxId="onboarding-location-listbox"
                />
              </>
            )}
          </div>

          <div
            className="onboarding-splash-cta"
            style={{
              opacity: vis ? 1 : 0,
              transition: 'opacity 0.6s 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <button
              type="button"
              className={`onboarding-primary-btn${cityCtaDisabled ? ' onboarding-primary-btn--disabled' : ''}`}
              disabled={cityCtaDisabled}
              onClick={goNextFromCity}
            >
              <span>
                {showLocationMode && locMode === 'precise'
                  ? 'Continue'
                  : selectedCityIds.length > 1
                    ? `Let's go · ${selectedCityIds.length} cities`
                    : "Let's go"}
              </span>
              <span aria-hidden>→</span>
            </button>
            <p className="onboarding-footnote">No algorithm — just tonight.</p>
          </div>
        </div>
      ) : (
        <div className="onboarding-genre">
          <div className="onboarding-genre-header">
            <p className="onboarding-kicker">Quick setup</p>
            <h2 className="onboarding-serif-subtitle">What moves you?</h2>
            <p className="onboarding-genre-hint">
              Same categories as Discover filters. Tap to select any that apply.
            </p>
          </div>

          <div className="onboarding-genre-list" role="list">
            {ONBOARDING_GENRES.map((g) => {
              const sel = selectedGenres.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  role="listitem"
                  className={`onboarding-genre-row${sel ? ' onboarding-genre-row--selected' : ''}`}
                  onClick={() => toggleGenre(g.id)}
                >
                  <div className="onboarding-genre-copy">
                    <div className="onboarding-genre-title">{g.label}</div>
                    <div className="onboarding-genre-sub">{g.sub}</div>
                  </div>
                  <div className={`onboarding-genre-check${sel ? ' onboarding-genre-check--on' : ''}`}>
                    {sel ? '✓' : null}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="onboarding-genre-footer">
            <button
              type="button"
              className={`onboarding-primary-btn${selectedGenres.length === 0 ? ' onboarding-primary-btn--disabled' : ''}`}
              disabled={selectedGenres.length === 0}
              onClick={finish}
            >
              <span>
                {selectedGenres.length > 0
                  ? `${selectedGenres.length} selected — show me tonight`
                  : 'Pick at least one'}
              </span>
              {selectedGenres.length > 0 ? <span aria-hidden>→</span> : null}
            </button>
          </div>
        </div>
      )}

      <UploadToast toast={toast} onDismiss={() => setToast(null)} />
    </motion.div>
  )
}

import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Home,
  Pencil,
  Search,
  Shapes,
  Tag,
  Trash2,
  User,
  Wand2,
} from 'lucide-react'
import './design-theme.css'

const SECONDARY = '#1A1A1A'

const ACCENT = {
  orange: {
    primary: '#E24325',
    mascotSrc: '/assets/mascot/buzo-orange.png',
    mascotAlt: 'Buzo — orange mascot',
    mascotFile: 'buzo-orange.png',
  },
  purple: {
    primary: '#7C3AED',
    mascotSrc: '/assets/mascot/buzo-purple.png',
    mascotAlt: 'Buzo — purple mascot',
    mascotFile: 'buzo-purple.png',
  },
} as const

type AccentKey = keyof typeof ACCENT

function tonalScale(base: string, steps: number, isDarkBase: boolean) {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1)
    if (isDarkBase) {
      return `color-mix(in oklab, ${base} ${Math.round(100 - t * 85)}%, white)`
    }
    return `color-mix(in oklab, ${base} ${Math.round(55 + t * 45)}%, black)`
  })
}

function PaletteCard({
  title,
  hex,
  children,
}: {
  title: string
  hex: string
  children: ReactNode
}) {
  return (
    <section className="design-theme-card design-theme-card--compact">
      <div className="design-theme-palette">
        <div className="design-theme-palette-top">
          <span className="design-theme-palette-name">{title}</span>
          <span className="design-theme-palette-hex">{hex}</span>
        </div>
        {children}
      </div>
    </section>
  )
}

export function DesignThemePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const variant: AccentKey =
    searchParams.get('variant') === 'purple' ? 'purple' : 'orange'

  const setVariant = useCallback(
    (next: AccentKey) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('variant', next)
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    const v = searchParams.get('variant')
    if (v !== 'orange' && v !== 'purple') {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('variant', 'orange')
          return p
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    document.documentElement.classList.add('design-theme-active')
    return () => document.documentElement.classList.remove('design-theme-active')
  }, [])

  const { primary: PRIMARY, mascotSrc, mascotAlt, mascotFile } = ACCENT[variant]

  const primarySteps = useMemo(() => tonalScale(PRIMARY, 10, false), [PRIMARY])
  const secondarySteps = useMemo(() => tonalScale(SECONDARY, 10, true), [])
  const neutralSteps = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const g = Math.round((i / 9) * 255)
        return `rgb(${g},${g},${g})`
      }),
    [],
  )

  const scaleRow = (steps: string[]) => (
    <div className="design-theme-scale">
      {steps.map((c, i) => (
        <div key={i} className="design-theme-swatch" style={{ background: c }} title={c} />
      ))}
    </div>
  )

  return (
    <div
      className={`design-theme-page${variant === 'purple' ? ' design-theme-page--purple' : ''}`}
    >
      <header className="design-theme-header">
        <h1>Design theme</h1>
        <div className="design-theme-header-actions">
          <div className="design-theme-accent-toggle" role="group" aria-label="Accent palette">
            <button
              type="button"
              className={`design-theme-back design-theme-back--ghost${variant === 'orange' ? ' design-theme-accent-btn--active' : ''}`}
              aria-pressed={variant === 'orange'}
              onClick={() => setVariant('orange')}
            >
              Orange
            </button>
            <button
              type="button"
              className={`design-theme-back design-theme-back--ghost${variant === 'purple' ? ' design-theme-accent-btn--active' : ''}`}
              aria-pressed={variant === 'purple'}
              onClick={() => setVariant('purple')}
            >
              Purple
            </button>
          </div>
          <Link to="/admin" className="design-theme-back">
            Back to admin
          </Link>
        </div>
      </header>

      <main className="design-theme-main">
        <div className="design-theme-mascot-row">
          <img
            className="design-theme-mascot-img"
            src={mascotSrc}
            alt={mascotAlt}
            width={320}
            height={320}
            decoding="async"
          />
          <div className="design-theme-mascot-copy">
            <p className="design-theme-mascot-label">Mascot</p>
            <p className="design-theme-mascot-desc">
              Buzo brand character — use on marketing surfaces, onboarding, and celebratory empty
              states. Asset: <code className="design-theme-mascot-code">{mascotFile}</code>
            </p>
          </div>
        </div>

        <div className="design-theme-columns">
          {/* Column 1 — palettes */}
          <div className="design-theme-col">
            <PaletteCard title="Primary" hex={PRIMARY}>
              {scaleRow(primarySteps)}
            </PaletteCard>
            <PaletteCard title="Secondary" hex={SECONDARY}>
              {scaleRow(secondarySteps)}
            </PaletteCard>
            <PaletteCard title="Tertiary" hex={PRIMARY}>
              {scaleRow(primarySteps)}
            </PaletteCard>
            <PaletteCard title="Neutral" hex="#000000">
              {scaleRow(neutralSteps)}
            </PaletteCard>
          </div>

          {/* Column 2 — typography */}
          <div className="design-theme-col">
            <section className="design-theme-card design-theme-type-card">
              <div className="design-theme-type-card-header">
                <span className="design-theme-type-role">Headline</span>
                <span className="design-theme-type-font">Public Sans</span>
              </div>
              <div className="design-theme-type-aa design-theme-type-aa--headline">Aa</div>
            </section>
            <section className="design-theme-card design-theme-type-card">
              <div className="design-theme-type-card-header">
                <span className="design-theme-type-role">Body</span>
                <span className="design-theme-type-font">Public Sans</span>
              </div>
              <div className="design-theme-type-aa design-theme-type-aa--body">Aa</div>
            </section>
            <section className="design-theme-card design-theme-type-card">
              <div className="design-theme-type-card-header">
                <span className="design-theme-type-role">Label</span>
                <span className="design-theme-type-font">Be Vietnam Pro</span>
              </div>
              <div className="design-theme-type-aa design-theme-type-aa--label">Aa</div>
            </section>
          </div>

          {/* Column 3 — buttons, progress, actions */}
          <div className="design-theme-col">
            <section className="design-theme-card">
              <h2 className="design-theme-card-title">Buttons</h2>
              <div className="design-theme-buttons design-theme-buttons--grid">
                <button type="button" className="dt-btn dt-btn--primary">
                  Primary
                </button>
                <button type="button" className="dt-btn dt-btn--secondary">
                  Secondary
                </button>
                <button type="button" className="dt-btn dt-btn--inverted">
                  Inverted
                </button>
                <button type="button" className="dt-btn dt-btn--outline">
                  Outlined
                </button>
              </div>
            </section>

            <section className="design-theme-card">
              <h2 className="design-theme-card-title">Progress</h2>
              <div className="design-theme-progress-list">
                <div className="dt-progress dt-progress--thick" aria-hidden>
                  <div className="dt-progress__fill dt-progress__fill--white" />
                </div>
                <div className="dt-progress dt-progress--thick" aria-hidden>
                  <div className="dt-progress__fill dt-progress__fill--gray" />
                </div>
                <div className="dt-progress dt-progress--thick" aria-hidden>
                  <div className="dt-progress__fill dt-progress__fill--coral" />
                </div>
              </div>
            </section>

            <section className="design-theme-card">
              <h2 className="design-theme-card-title">Actions</h2>
              <div className="design-theme-actions-split">
                <div className="design-theme-nested-card">
                  <button type="button" className="dt-icon-btn" aria-label="Edit">
                    <Pencil size={20} strokeWidth={2} aria-hidden />
                  </button>
                </div>
                <div className="design-theme-nested-card">
                  <div className="dt-label-pill">
                    <Pencil size={16} strokeWidth={2} aria-hidden />
                    Label
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Column 4 — search, nav, utilities */}
          <div className="design-theme-col">
            <section className="design-theme-card">
              <h2 className="design-theme-card-title">Search</h2>
              <div className="dt-search">
                <Search size={18} strokeWidth={2} aria-hidden />
                <span>Search</span>
              </div>
            </section>

            <section className="design-theme-card">
              <h2 className="design-theme-card-title">Navigation</h2>
              <div className="dt-nav-pill" role="tablist" aria-label="Example pill nav">
                <button
                  type="button"
                  className="dt-nav-pill--active"
                  aria-current="page"
                  aria-label="Home"
                >
                  <Home size={18} strokeWidth={2} aria-hidden />
                </button>
                <button type="button" aria-label="Search">
                  <Search size={18} strokeWidth={2} aria-hidden />
                </button>
                <button type="button" aria-label="Profile">
                  <User size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </section>

            <section className="design-theme-card">
              <h2 className="design-theme-card-title">Icon tiles</h2>
              <div className="design-theme-icon-grid">
                <button type="button" className="dt-icon-tile dt-icon-tile--white" aria-label="Magic">
                  <Wand2 size={18} strokeWidth={2} aria-hidden />
                </button>
                <button type="button" className="dt-icon-tile dt-icon-tile--gray" aria-label="Shapes">
                  <Shapes size={18} strokeWidth={2} aria-hidden />
                </button>
                <button type="button" className="dt-icon-tile dt-icon-tile--peach" aria-label="Tag">
                  <Tag size={18} strokeWidth={2} aria-hidden />
                </button>
                <button
                  type="button"
                  className="dt-icon-tile dt-icon-tile--peach dt-icon-tile--trash"
                  aria-label="Trash"
                >
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

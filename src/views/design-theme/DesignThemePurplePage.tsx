import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './design-theme-purple.css'

const PURPLE = '#7C3AED'

function mixPurple(i: number, steps: number): string {
  const t = i / (steps - 1)
  return `color-mix(in oklab, ${PURPLE} ${Math.round(48 + t * 52)}%, black)`
}

function mixPurpleLight(i: number, steps: number): string {
  const t = i / (steps - 1)
  return `color-mix(in oklab, ${PURPLE} ${Math.round(35 - t * 28)}%, white)`
}

const scaleDark = () => Array.from({ length: 6 }, (_, i) => mixPurple(i, 6))
const scaleLight = () => Array.from({ length: 6 }, (_, i) => mixPurpleLight(i, 6))

export function DesignThemePurplePage() {
  useEffect(() => {
    document.documentElement.classList.add('design-theme-active')
    return () => document.documentElement.classList.remove('design-theme-active')
  }, [])

  const ramp = useMemo(() => {
    const dark = scaleDark()
    const light = scaleLight()
    return [
      ...dark.map((c, i) => ({ c, label: `Dark ${i + 1}` })),
      { c: PURPLE, label: 'Primary' },
      ...light.map((c, i) => ({ c, label: `Light ${i + 1}` })),
    ]
  }, [])

  return (
    <div className="design-theme-purple-page">
      <header className="dtp-header">
        <h1>/admin/design-theme/purple</h1>
        <div className="dtp-header-actions">
          <Link to="/admin/design-theme/orange" className="dtp-link">
            Orange
          </Link>
          <Link to="/admin" className="dtp-link dtp-link--primary">
            Back to admin
          </Link>
        </div>
      </header>

      <section className="dtp-hero">
        <div className="dtp-hero-inner">
          <div className="dtp-hero-copy">
            <p className="dtp-eyebrow">Accent system</p>
            <h1>Purple theme</h1>
            <p>
              Primary violet <strong style={{ color: '#a78bfa' }}>{PURPLE}</strong> — ramps for
              fills, borders, and glow on near-black purple surfaces. Pair{' '}
              <strong style={{ color: '#e24325' }}>brand orange</strong> for the chest badge,
              primary CTAs, and logo lockups.
            </p>
            <div className="dtp-gradient-bar" aria-hidden />
          </div>
          <div className="dtp-hero-mascot">
            <img
              src="/assets/mascot/buzo-purple.png"
              alt="Buzo — purple mascot"
              width={400}
              height={400}
              decoding="async"
            />
          </div>
        </div>
      </section>

      <main className="dtp-main">
        <section className="dtp-section">
          <h2>Purple ramp</h2>
          <div className="dtp-scale">
            {ramp.map(({ c, label }) => (
              <figure key={`${label}-${c}`} className="dtp-swatch-wrap">
                <div className="dtp-swatch" style={{ background: c }} title={c} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="dtp-section">
          <h2>Buttons</h2>
          <div className="dtp-row-buttons">
            <button type="button" className="dtp-btn dtp-btn--fill">
              Primary action
            </button>
            <button type="button" className="dtp-btn dtp-btn--outline">
              Outline
            </button>
            <button type="button" className="dtp-btn dtp-btn--ghost">
              Ghost
            </button>
          </div>
        </section>

        <section className="dtp-section">
          <h2>Chips</h2>
          <div className="dtp-chips">
            <span className="dtp-chip">Live</span>
            <span className="dtp-chip">Sonar</span>
            <span className="dtp-chip dtp-chip--solid">Verified</span>
            <span className="dtp-chip dtp-chip--brand">Brand CTA</span>
          </div>
        </section>

        <section className="dtp-section">
          <h2>Usage</h2>
          <p className="dtp-note">
            Use <strong>saturated purple</strong> sparingly for hero glows, focus rings, and solid
            controls. Reserve <strong>brand orange (#E24325)</strong> where the circular “B” appears
            in product UI. Keep body copy on muted lavender-gray; avoid low-contrast purple-on-purple
            for small sizes. Mascot asset: <code>buzo-purple.png</code>.
          </p>
        </section>
      </main>
    </div>
  )
}

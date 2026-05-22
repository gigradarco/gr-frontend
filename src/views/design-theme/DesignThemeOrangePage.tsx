import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import './design-theme-orange.css'

const ORANGE = '#E24325'

function mixOrange(i: number, steps: number): string {
  const t = i / (steps - 1)
  return `color-mix(in oklab, ${ORANGE} ${Math.round(48 + t * 52)}%, black)`
}

function mixOrangeLight(i: number, steps: number): string {
  const t = i / (steps - 1)
  return `color-mix(in oklab, ${ORANGE} ${Math.round(35 - t * 28)}%, white)`
}

const scaleDark = () => Array.from({ length: 6 }, (_, i) => mixOrange(i, 6))
const scaleLight = () => Array.from({ length: 6 }, (_, i) => mixOrangeLight(i, 6))

export function DesignThemeOrangePage() {
  useEffect(() => {
    document.documentElement.classList.add('design-theme-active')
    return () => document.documentElement.classList.remove('design-theme-active')
  }, [])

  const ramp = useMemo(() => {
    const dark = scaleDark()
    const light = scaleLight()
    return [
      ...dark.map((c, i) => ({ c, label: `Dark ${i + 1}` })),
      { c: ORANGE, label: 'Primary' },
      ...light.map((c, i) => ({ c, label: `Light ${i + 1}` })),
    ]
  }, [])

  return (
    <div className="design-theme-orange-page">
      <header className="dtor-header">
        <h1>/admin/design-theme/orange</h1>
        <div className="dtor-header-actions">
          <Link to="/admin/design-theme/purple" className="dtor-link">
            Purple
          </Link>
          <Link to="/admin" className="dtor-link dtor-link--primary">
            Back to admin
          </Link>
        </div>
      </header>

      <section className="dtor-hero">
        <div className="dtor-hero-inner">
          <div className="dtor-hero-copy">
            <p className="dtor-eyebrow">Accent system</p>
            <h1>Orange theme</h1>
            <p>
              Primary brand orange <strong style={{ color: '#f15b3f' }}>{ORANGE}</strong> — ramps
              for fills, borders, and glow on dark UI. Pair with charcoal surfaces and off-white
              type.
            </p>
            <div className="dtor-gradient-bar" aria-hidden />
          </div>
          <div className="dtor-hero-mascot">
            <img
              src="/assets/mascot/buzo-orange.png"
              alt="Buzo — orange mascot"
              width={400}
              height={400}
              decoding="async"
            />
          </div>
        </div>
      </section>

      <main className="dtor-main">
        <section className="dtor-section">
          <h2>Orange ramp</h2>
          <div className="dtor-scale">
            {ramp.map(({ c, label }) => (
              <figure key={`${label}-${c}`} className="dtor-swatch-wrap">
                <div className="dtor-swatch" style={{ background: c }} title={c} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="dtor-section">
          <h2>Buttons</h2>
          <div className="dtor-row-buttons">
            <button type="button" className="dtor-btn dtor-btn--fill">
              Primary action
            </button>
            <button type="button" className="dtor-btn dtor-btn--outline">
              Outline
            </button>
            <button type="button" className="dtor-btn dtor-btn--ghost">
              Ghost
            </button>
          </div>
        </section>

        <section className="dtor-section">
          <h2>Chips</h2>
          <div className="dtor-chips">
            <span className="dtor-chip">Live</span>
            <span className="dtor-chip">Jazz</span>
            <span className="dtor-chip dtor-chip--solid">Verified</span>
          </div>
        </section>

        <section className="dtor-section">
          <h2>Usage</h2>
          <p className="dtor-note">
            Use <strong>solid orange</strong> for primary CTAs and key focus states. Use{' '}
            <strong>soft mixes</strong> for chips, subtle borders, and gradient hero backgrounds.
            Avoid large fields of saturated orange behind small text — prefer dark surfaces with
            orange accents.
          </p>
        </section>
      </main>
    </div>
  )
}

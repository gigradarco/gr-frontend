import type { ReactNode } from 'react'
import { CloudSun, Sun } from 'lucide-react'

export type WeatherAdvisoryCategory = 'flood' | 'rain' | 'thunder' | 'heat' | 'uv'

export const WEATHER_ADVISORY_GLYPH_SIZE = 36
export const WEATHER_ADVISORY_GLYPH_STROKE = 2.5

function AdvisoryGlyphFrame({
  className,
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  children,
}: {
  className: string
  size?: number
  children: ReactNode
}) {
  return (
    <span
      className={`admin-weather-advisory-glyph ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {children}
    </span>
  )
}

function FloodAdvisoryGlyph({
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  strokeWidth = WEATHER_ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-flood-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          className="admin-weather-flood-wave admin-weather-flood-wave-1"
          d="M2 8c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"
          {...stroke}
        />
        <path
          className="admin-weather-flood-wave admin-weather-flood-wave-2"
          d="M2 13c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"
          {...stroke}
        />
        <path
          className="admin-weather-flood-wave admin-weather-flood-wave-3"
          d="M2 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0"
          {...stroke}
        />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

function RainAdvisoryGlyph({
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  strokeWidth = WEATHER_ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-rain-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="admin-weather-rain-cloud-svg" aria-hidden>
        <path
          className="admin-weather-rain-cloud"
          d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
          {...stroke}
        />
        <line className="admin-weather-rain-drop admin-weather-rain-drop-1" x1="8" y1="19" x2="8" y2="22" {...stroke} />
        <line className="admin-weather-rain-drop admin-weather-rain-drop-2" x1="12" y1="19" x2="12" y2="22" {...stroke} />
        <line className="admin-weather-rain-drop admin-weather-rain-drop-3" x1="16" y1="19" x2="16" y2="22" {...stroke} />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

function ThunderAdvisoryGlyph({
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  strokeWidth = WEATHER_ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-thunder-advisory-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <path
          className="admin-weather-thunder-advisory-cloud"
          d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
          {...stroke}
        />
        <path
          className="admin-weather-thunder-advisory-bolt"
          d="M13 19.5 9.5 23.5h2.8L11 27"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

function HeatAdvisoryGlyph({
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  strokeWidth = WEATHER_ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const sunSize = Math.max(11, Math.round(size * 0.46))
  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-heat-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} className="admin-weather-heat-tube-svg" aria-hidden>
        <path
          className="admin-weather-heat-tube"
          d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a6.5 6.5 0 1 0 5 0z"
          {...stroke}
        />
        <line className="admin-weather-heat-mercury" x1="11.5" y1="11" x2="11.5" y2="17.5" {...stroke} />
      </svg>
      <Sun size={sunSize} strokeWidth={strokeWidth} className="admin-weather-heat-sun" />
    </AdvisoryGlyphFrame>
  )
}

const UV_SUN_CENTER = 12
const UV_SUN_INNER_RADIUS = 4.25
const UV_SUN_OUTER_RADIUS = 10.25
const UV_SUN_RAY_ANGLES = [-90, -45, 0, 45, 90, 135, 180, 225] as const

function uvSunRayEndpoints(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x1: UV_SUN_CENTER + UV_SUN_INNER_RADIUS * cos,
    y1: UV_SUN_CENTER + UV_SUN_INNER_RADIUS * sin,
    x2: UV_SUN_CENTER + UV_SUN_OUTER_RADIUS * cos,
    y2: UV_SUN_CENTER + UV_SUN_OUTER_RADIUS * sin,
  }
}

function UvAdvisoryGlyph({
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  strokeWidth = WEATHER_ADVISORY_GLYPH_STROKE,
}: {
  size?: number
  strokeWidth?: number
}) {
  const stroke = {
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
  }

  return (
    <AdvisoryGlyphFrame className="admin-weather-uv-glyph" size={size}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <g className="admin-weather-uv-rays">
          {UV_SUN_RAY_ANGLES.map((angle, index) => {
            const { x1, y1, x2, y2 } = uvSunRayEndpoints(angle)
            return (
              <line
                key={angle}
                className={`admin-weather-uv-ray admin-weather-uv-ray-${index + 1}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                fill="none"
                {...stroke}
              />
            )
          })}
        </g>
        <circle
          className="admin-weather-uv-disc"
          cx={UV_SUN_CENTER}
          cy={UV_SUN_CENTER}
          r="4"
          fill="currentColor"
          fillOpacity={0.2}
          {...stroke}
        />
      </svg>
    </AdvisoryGlyphFrame>
  )
}

export function WeatherAdvisoryIcon({
  category,
  size = WEATHER_ADVISORY_GLYPH_SIZE,
  strokeWidth = WEATHER_ADVISORY_GLYPH_STROKE,
}: {
  category: WeatherAdvisoryCategory
  size?: number
  strokeWidth?: number
}) {
  if (category === 'flood') return <FloodAdvisoryGlyph size={size} strokeWidth={strokeWidth} />
  if (category === 'rain') return <RainAdvisoryGlyph size={size} strokeWidth={strokeWidth} />
  if (category === 'thunder') return <ThunderAdvisoryGlyph size={size} strokeWidth={strokeWidth} />
  if (category === 'heat') return <HeatAdvisoryGlyph size={size} strokeWidth={strokeWidth} />
  if (category === 'uv') return <UvAdvisoryGlyph size={size} strokeWidth={strokeWidth} />
  return <CloudSun size={size} strokeWidth={strokeWidth} aria-hidden />
}

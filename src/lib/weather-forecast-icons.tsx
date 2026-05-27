import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudMoon,
  CloudRain,
  CloudSun,
  Moon,
  Sun,
  Wind,
  Zap,
} from 'lucide-react'

export type ForecastMarkerKind =
  | 'fair'
  | 'fair-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunder'
  | 'heavy-thunder'
  | 'wind'
  | 'haze'

export function forecastMarkerKind(forecast: string): ForecastMarkerKind {
  const lower = forecast.toLowerCase()
  if (lower.includes('heavy') && lower.includes('thunder')) return 'heavy-thunder'
  if (lower.includes('thunder')) return 'thunder'
  if (lower.includes('heavy') && (lower.includes('rain') || lower.includes('showers'))) return 'heavy-rain'
  if (lower.includes('drizzle') || lower.includes('light')) return 'drizzle'
  if (lower.includes('rain') || lower.includes('showers')) return 'rain'
  if (lower.includes('wind')) return 'wind'
  if (lower.includes('haze') || lower.includes('mist') || lower.includes('fog')) return 'haze'
  if (lower.includes('fair') && lower.includes('night')) return 'fair-night'
  if (lower.includes('partly') && lower.includes('night')) return 'partly-cloudy-night'
  if (lower.includes('partly')) return 'partly-cloudy'
  if (lower.includes('cloud')) return 'cloudy'
  if (lower.includes('fair') || lower.includes('sun')) return 'fair'
  return 'cloudy'
}

function ThunderShowerGlyph({
  size = 13,
  strokeWidth = 2.7,
  variant = 'thunder',
}: {
  size?: number
  strokeWidth?: number
  variant?: 'thunder' | 'heavy-thunder'
}) {
  const boltSize = Math.max(8, Math.round(size * 0.5))
  return (
    <span
      className={`admin-weather-thunder-shower-glyph${variant === 'heavy-thunder' ? ' is-heavy' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <CloudRain size={size} strokeWidth={strokeWidth} className="admin-weather-thunder-shower-rain" />
      <Zap
        size={boltSize}
        strokeWidth={strokeWidth + 0.15}
        fill="currentColor"
        className="admin-weather-thunder-shower-bolt"
      />
    </span>
  )
}

function PartlyCloudyGlyph({ size = 13, strokeWidth = 2.7 }: { size?: number; strokeWidth?: number }) {
  return (
    <span
      className="admin-weather-partly-cloudy-glyph"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Sun size={Math.round(size * 0.78)} strokeWidth={strokeWidth} className="admin-weather-partly-cloudy-sun" />
      <Cloud size={Math.round(size * 0.82)} strokeWidth={strokeWidth} className="admin-weather-partly-cloudy-cloud" />
    </span>
  )
}

export function ForecastMarkerGlyph({ kind, size = 13 }: { kind: ForecastMarkerKind; size?: number }) {
  const props = { size, strokeWidth: 2.7, 'aria-hidden': true as const }
  if (kind === 'fair') return <Sun {...props} />
  if (kind === 'fair-night') return <Moon {...props} />
  if (kind === 'partly-cloudy-night') return <CloudMoon {...props} />
  if (kind === 'partly-cloudy') return <PartlyCloudyGlyph size={size} strokeWidth={props.strokeWidth} />
  if (kind === 'cloudy') return <Cloud {...props} />
  if (kind === 'drizzle') return <CloudDrizzle {...props} />
  if (kind === 'rain' || kind === 'heavy-rain') return <CloudRain {...props} />
  if (kind === 'thunder') return <ThunderShowerGlyph size={size} strokeWidth={props.strokeWidth} variant="thunder" />
  if (kind === 'heavy-thunder') {
    return <ThunderShowerGlyph size={size} strokeWidth={props.strokeWidth} variant="heavy-thunder" />
  }
  if (kind === 'wind') return <Wind {...props} />
  if (kind === 'haze') return <CloudFog {...props} />
  return <CloudSun {...props} />
}

import type { FourDayOutlookDay } from './weather-map-data'

export type WeatherAdviceId = 'umbrella' | 'cap' | 'hydrate' | 'avoid-outdoor' | 'good'
export type WeatherAdviceLevel = 'info' | 'watch' | 'warning'

export type WeatherAdvice = {
  id: WeatherAdviceId
  label: string
  reason: string
  level: WeatherAdviceLevel
  priority: number
}

type FourDayAdviceInput = Pick<
  FourDayOutlookDay,
  'forecastText' | 'forecastSummary' | 'tempHighC' | 'humidityHighPct'
>

export type ForecastAdviceInput = {
  forecastText: string
  forecastSummary?: string
  tempHighC: number | null
  humidityHighPct: number | null
}

const WET_FORECAST_PATTERN = /\b(thunder|thundery|thunderstorms?|showers?|rain|drizzle)\b/i
const SEVERE_WET_FORECAST_PATTERN = /\b(heavy|widespread|continuous|intense|squally)\b/i
const HOT_FORECAST_PATTERN = /\b(fair|warm|sunny|hot)\b/i

function forecastText(input: ForecastAdviceInput): string {
  return `${input.forecastText} ${input.forecastSummary ?? ''}`.trim()
}

function upsertAdvice(adviceById: Map<WeatherAdviceId, WeatherAdvice>, advice: WeatherAdvice): void {
  const current = adviceById.get(advice.id)
  if (!current || advice.priority > current.priority) {
    adviceById.set(advice.id, advice)
  }
}

export function buildForecastWeatherAdvice(input: ForecastAdviceInput, maxItems = 2): WeatherAdvice[] {
  const text = forecastText(input)
  const tempHighC = input.tempHighC
  const humidityHighPct = input.humidityHighPct
  const adviceById = new Map<WeatherAdviceId, WeatherAdvice>()
  const hasWetForecast = WET_FORECAST_PATTERN.test(text)

  if (hasWetForecast) {
    upsertAdvice(adviceById, {
      id: 'umbrella',
      label: 'Bring umbrella',
      reason: 'Rain or showers are forecast for the day.',
      level: 'watch',
      priority: 90,
    })
  }

  if (hasWetForecast && SEVERE_WET_FORECAST_PATTERN.test(text)) {
    upsertAdvice(adviceById, {
      id: 'avoid-outdoor',
      label: 'Avoid long outdoor plans',
      reason: 'Heavy or widespread rain could disrupt outdoor plans.',
      level: 'warning',
      priority: 95,
    })
  }

  if (tempHighC != null && tempHighC >= 34) {
    upsertAdvice(adviceById, {
      id: 'hydrate',
      label: 'Stay hydrated',
      reason: `High of ${tempHighC}C expected.`,
      level: 'watch',
      priority: 70,
    })
  }

  if (humidityHighPct != null && humidityHighPct >= 90) {
    upsertAdvice(adviceById, {
      id: 'hydrate',
      label: 'Stay hydrated',
      reason: `Humidity may reach ${humidityHighPct}%.`,
      level: 'watch',
      priority: 68,
    })
  }

  if ((tempHighC != null && tempHighC >= 33) || HOT_FORECAST_PATTERN.test(text)) {
    upsertAdvice(adviceById, {
      id: 'cap',
      label: 'Bring cap',
      reason: 'Warm conditions are expected.',
      level: 'info',
      priority: 60,
    })
  }

  const advice = [...adviceById.values()].sort((a, b) => b.priority - a.priority)
  if (advice.length > 0) return advice.slice(0, maxItems)

  return [
    {
      id: 'good',
      label: 'Good to go',
      reason: 'No rain, high heat, or high humidity signal in the forecast.',
      level: 'info',
      priority: 0,
    },
  ]
}

export function buildFourDayWeatherAdvice(day: FourDayAdviceInput, maxItems = 2): WeatherAdvice[] {
  return buildForecastWeatherAdvice(day, maxItems)
}

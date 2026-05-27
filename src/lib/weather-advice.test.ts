import { describe, expect, it } from 'vitest'
import { buildForecastWeatherAdvice, buildFourDayWeatherAdvice } from './weather-advice'

describe('buildFourDayWeatherAdvice', () => {
  it('suggests umbrella and hydration for hot thundery days', () => {
    const advice = buildFourDayWeatherAdvice({
      forecastText: 'Thundery Showers',
      forecastSummary: 'Afternoon thundery showers',
      tempHighC: 34,
      humidityHighPct: 95,
    })

    expect(advice.map((item) => item.id)).toEqual(['umbrella', 'hydrate'])
  })

  it('prioritizes outdoor-plan warning for severe wet forecasts', () => {
    const advice = buildFourDayWeatherAdvice({
      forecastText: 'Heavy Thundery Showers',
      forecastSummary: 'Widespread heavy showers',
      tempHighC: 31,
      humidityHighPct: 88,
    })

    expect(advice.map((item) => item.id)).toEqual(['avoid-outdoor', 'umbrella'])
  })

  it('suggests heat prep for fair and warm days', () => {
    const advice = buildFourDayWeatherAdvice({
      forecastText: 'Fair & Warm',
      forecastSummary: 'Fair and warm',
      tempHighC: 35,
      humidityHighPct: 80,
    })

    expect(advice.map((item) => item.id)).toEqual(['hydrate', 'cap'])
  })

  it('falls back to good-to-go advice when no prep is needed', () => {
    const advice = buildFourDayWeatherAdvice({
      forecastText: 'Cloudy',
      forecastSummary: 'Cloudy',
      tempHighC: 31,
      humidityHighPct: 75,
    })

    expect(advice).toHaveLength(1)
    expect(advice[0]?.id).toBe('good')
  })
})

describe('buildForecastWeatherAdvice', () => {
  it('supports live forecast inputs without a summary', () => {
    const advice = buildForecastWeatherAdvice({
      forecastText: 'Partly Cloudy (Day)',
      tempHighC: 34.4,
      humidityHighPct: 64,
    })

    expect(advice.map((item) => item.id)).toEqual(['hydrate', 'cap'])
  })
})

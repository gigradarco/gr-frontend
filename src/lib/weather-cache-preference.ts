export const WEATHER_AUTO_REFRESH_STORAGE_KEY = 'buzo:admin-weather-map:auto-refresh'

export function readWeatherAutoRefreshPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(WEATHER_AUTO_REFRESH_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWeatherAutoRefreshPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WEATHER_AUTO_REFRESH_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Preference is optional; default stays off.
  }
}

export function formatForecastTemperatureRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'N/A'
  if (low == null || high == null) return `${low ?? high}°C`
  return `${low} – ${high}°C`
}

export function formatForecastHumidityRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return 'N/A'
  if (low == null || high == null) return `${low ?? high}%`
  return `${low} – ${high}%`
}

export function formatForecastDateRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return start || end || 'N/A'
  }

  const sameDay = startDate.toDateString() === endDate.toDateString()
  const time = (date: Date) =>
    date.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true })
  const day = (date: Date) =>
    date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })

  if (sameDay) return `${day(startDate)} · ${time(startDate)} – ${time(endDate)}`
  return `${day(startDate)} ${time(startDate)} – ${day(endDate)} ${time(endDate)}`
}

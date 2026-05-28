import type { StyleSpecification } from 'maplibre-gl'
import type { Theme } from '../../../types'

const CARTO_DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const CARTO_LIGHT_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const EMPTY_DARK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#0a0a0a' },
    },
  ],
}

const EMPTY_LIGHT_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#f4f6fa' },
    },
  ],
}

function optionalEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function mapTilerStyleUrl(theme: Theme): string | null {
  const key = optionalEnv(import.meta.env.VITE_MAPTILER_KEY)
  if (!key) return null
  const styleId = theme === 'light' ? 'streets-v2' : 'streets-v2-dark'
  return `https://api.maptiler.com/maps/${styleId}/style.json?key=${encodeURIComponent(key)}`
}

export function mapStyleForTheme(theme: Theme): string | StyleSpecification {
  const configured =
    theme === 'light'
      ? optionalEnv(import.meta.env.VITE_MAP_STYLE_URL_LIGHT)
      : optionalEnv(import.meta.env.VITE_MAP_STYLE_URL_DARK)

  if (configured) return configured

  const mapTiler = mapTilerStyleUrl(theme)
  if (mapTiler) return mapTiler

  const carto = theme === 'light' ? CARTO_LIGHT_STYLE_URL : CARTO_DARK_STYLE_URL
  return carto || (theme === 'light' ? EMPTY_LIGHT_STYLE : EMPTY_DARK_STYLE)
}

export function mapBackgroundForTheme(theme: Theme): string {
  return theme === 'light' ? '#f4f6fa' : '#0a0a0a'
}

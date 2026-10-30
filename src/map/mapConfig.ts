import type { Basemap } from '../types'

const BASE = 'https://api.maptiler.com'

const STYLE_PATHS: Record<Basemap, string> = {
  satellite: 'maps/satellite/style.json',
  hybrid:    'maps/hybrid/style.json',
  outdoor:   'maps/outdoor-v2/style.json',
  winter:    'maps/winter-v2/style.json',
}

export function styleUrl(basemap: Basemap, key: string): string {
  return `${BASE}/${STYLE_PATHS[basemap]}?key=${key}`
}

export function terrainSourceUrl(key: string): string {
  return `${BASE}/tiles/terrain-rgb-v2/tiles.json?key=${key}`
}

export type StyleValidation =
  | { ok: true }
  | { ok: false; status: number }
  | { ok: false; networkError: true }

export async function validateStyle(
  basemap: Basemap,
  key: string,
  fetchFn: typeof fetch = fetch,
): Promise<StyleValidation> {
  try {
    const response = await fetchFn(styleUrl(basemap, key), { method: 'GET' })
    if (response.ok) return { ok: true }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, networkError: true }
  }
}

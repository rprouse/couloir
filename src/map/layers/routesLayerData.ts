import type { Route } from '../../types'

// We intentionally don't depend on @types/geojson — minimal local shape.
interface Feature {
  type: 'Feature'
  geometry: Route['geojson']
  properties: { id: string; color: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export function buildRoutesGeoJson(routes: Route[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.map((r) => ({
      type: 'Feature',
      geometry: r.geojson,
      properties: { id: r.id, color: r.color },
    })),
  }
}

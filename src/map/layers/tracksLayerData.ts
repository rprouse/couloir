import type { Track } from '../../types'

interface Feature {
  type: 'Feature'
  geometry: Track['geojson']
  properties: { id: string; color: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export function buildTracksGeoJson(tracks: Track[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: tracks.map((t) => ({
      type: 'Feature',
      geometry: t.geojson,
      properties: { id: t.id, color: t.color },
    })),
  }
}

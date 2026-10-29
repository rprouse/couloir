import type { Photo } from '../../types'

interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  // bearing is omitted when unknown, so the arrow layer can filter on 'has'.
  properties: { id: string; bearing?: number }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

export function buildPhotosGeoJson(photos: Photo[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: photos.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: p.bearing === null ? { id: p.id } : { id: p.id, bearing: p.bearing },
    })),
  }
}

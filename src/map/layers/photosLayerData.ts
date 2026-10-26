import type { Photo } from '../../types'

interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; icon: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

export function photoIconName(photoId: string): string {
  return `photo-${photoId}`
}

export function buildPhotosGeoJson(photos: Photo[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: photos.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, icon: photoIconName(p.id) },
    })),
  }
}

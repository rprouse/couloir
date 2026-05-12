import type { Waypoint, WaypointCategory } from '../../types'

interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; category: WaypointCategory }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

export function buildWaypointsGeoJson(waypoints: Waypoint[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((w) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
      properties: { id: w.id, category: w.category },
    })),
  }
}

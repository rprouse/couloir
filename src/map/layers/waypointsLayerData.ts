import type { Waypoint, WaypointCategory } from '../../types'
import { resolveWaypointStyle, waypointImageId } from '../../icons/waypointIcons'

interface PointFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  // image: the marker's MapLibre image id, drawn on demand (see WaypointsLayer)
  properties: { id: string; category: WaypointCategory; image: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: PointFeature[]
}

export function buildWaypointsGeoJson(waypoints: Waypoint[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((w) => {
      const { icon, color } = resolveWaypointStyle(w)
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
        properties: { id: w.id, category: w.category, image: waypointImageId(icon, color) },
      }
    }),
  }
}

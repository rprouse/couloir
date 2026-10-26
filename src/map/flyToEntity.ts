import type maplibregl from 'maplibre-gl'
import type { LineStringZ } from '../types'
import { lineBounds } from '../utils/geo'

export const POINT_FLY_ZOOM = 15
const FIT_PADDING_PX = 60

export type FlyTarget =
  | { kind: 'line'; geojson: LineStringZ }
  | { kind: 'point'; lat: number; lng: number }

// Frames an entity: lines fit their bounds, points fly to a working zoom
// without zooming out if the user is already closer.
export function flyToEntity(map: maplibregl.Map, target: FlyTarget): void {
  if (target.kind === 'line') {
    map.fitBounds(lineBounds(target.geojson), { padding: FIT_PADDING_PX, maxZoom: POINT_FLY_ZOOM })
    return
  }
  map.flyTo({ center: [target.lng, target.lat], zoom: Math.max(map.getZoom(), POINT_FLY_ZOOM) })
}

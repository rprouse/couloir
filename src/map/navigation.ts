import type maplibregl from 'maplibre-gl'

export interface NavigationReading {
  lat: number
  lng: number
  /** Ground elevation at the map centre in metres; null while 3D terrain is off. */
  elevationM: number | null
  /** Direction the map is facing, 0–359° clockwise from north. */
  bearingDeg: number
}

// Elevation comes from the loaded terrain mesh, so it is only available with
// 3D terrain on. MapLibre's terrain getters scale by the exaggeration factor;
// divide it back out to get the real height. Reads 0 until the DEM tile under
// the centre has loaded.
function centerElevation(map: maplibregl.Map, center: maplibregl.LngLat): number | null {
  const terrain = map.terrain
  if (!terrain) return null
  const scaled = terrain.getElevationForLngLatZoom(center, map.transform.tileZoom)
  return terrain.exaggeration > 0 ? scaled / terrain.exaggeration : scaled
}

export function readNavigation(map: maplibregl.Map): NavigationReading {
  const center = map.getCenter()
  const bearing = Math.round(map.getBearing())
  return {
    lat: center.lat,
    lng: center.lng,
    elevationM: centerElevation(map, center),
    bearingDeg: ((bearing % 360) + 360) % 360,
  }
}

export function formatCoordinate(value: number): string {
  return value.toFixed(5)
}

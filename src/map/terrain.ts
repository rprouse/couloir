import type maplibregl from 'maplibre-gl'

// Terrain elevation (metres) at a point, or null when terrain is disabled or
// the DEM tile hasn't loaded. Callers leave the field blank rather than guess.
export function queryElevation(map: maplibregl.Map, lat: number, lng: number): number | null {
  const m = map as unknown as {
    queryTerrainElevation?: (lngLat: { lng: number; lat: number }) => number | null
  }
  const elev = m.queryTerrainElevation?.({ lng, lat }) ?? null
  return typeof elev === 'number' && Number.isFinite(elev) ? elev : null
}

import type maplibregl from 'maplibre-gl'

// Ground elevation (metres) at a point, or null when terrain is disabled or
// the DEM tile hasn't loaded. Callers leave the field blank rather than guess.
//
// MapLibre's queryTerrainElevation is not the ground height: it returns the
// point's exaggerated elevation minus the map centre's (transform.elevation),
// the offset 3D objects need. Add the centre back and divide the exaggeration
// out (as readNavigation does) to get metres above sea level.
//
// An unloaded DEM tile reads exactly 0 rather than null, so 0 is treated as
// unknown: a blank field beats a waypoint saved at sea level.
export function queryElevation(map: maplibregl.Map, lat: number, lng: number): number | null {
  const m = map as unknown as {
    queryTerrainElevation?: (lngLat: { lng: number; lat: number }) => number | null
    terrain?: { exaggeration: number } | null
    transform?: { elevation: number }
  }
  const offset = m.queryTerrainElevation?.({ lng, lat }) ?? null
  if (typeof offset !== 'number' || !Number.isFinite(offset)) return null
  const scaled = offset + (m.transform?.elevation ?? 0)
  const exaggeration = m.terrain?.exaggeration ?? 1
  const elev = exaggeration > 0 ? scaled / exaggeration : scaled
  return Number.isFinite(elev) && elev !== 0 ? elev : null
}

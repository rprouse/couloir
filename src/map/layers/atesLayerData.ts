import type { AtesArea, AtesClass, AtesFeature, AtesPoiType } from '../../types'
import { ATES_CLASSES, ATES_POI_TYPES } from '../../types'
import { ATES_CLASS_COLORS } from './layerStyles'

// Every imported area's features in one collection, each stamped with the
// area it came from so a click can name it.
export type AtesLayerFeature = AtesFeature & {
  properties: AtesFeature['properties'] & { areaId: string; areaName: string }
}

export interface AtesLayerFeatureCollection {
  type: 'FeatureCollection'
  features: AtesLayerFeature[]
}

export function buildAtesGeoJson(areas: AtesArea[]): AtesLayerFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: areas.flatMap((area) =>
      area.geojson.features.map((f) => ({
        ...f,
        properties: { ...f.properties, areaId: area.id, areaName: area.name },
      }) as AtesLayerFeature),
    ),
  }
}

// MapLibre `match` expression: a feature's `ates` class → its colour.
export function atesClassColorExpression(): unknown[] {
  return [
    'match',
    ['get', 'ates'],
    ...ATES_CLASSES.flatMap((c) => [c, ATES_CLASS_COLORS[c]]),
    '#94A3B8',
  ]
}

/** Zone count per class, for the Settings list and the legend. */
export function atesZoneCounts(area: AtesArea): Partial<Record<AtesClass, number>> {
  const counts: Partial<Record<AtesClass, number>> = {}
  for (const f of area.geojson.features) {
    if (f.properties.kind === 'zone') counts[f.properties.ates] = (counts[f.properties.ates] ?? 0) + 1
  }
  return counts
}

/** The classes present in any area's zones or ATES lines, in ATES order. */
export function atesClassesPresent(areas: AtesArea[]): AtesClass[] {
  const present = new Set<AtesClass>()
  for (const area of areas) {
    for (const f of area.geojson.features) {
      if (f.properties.kind === 'zone' || f.properties.kind === 'ates_line') present.add(f.properties.ates)
    }
  }
  return ATES_CLASSES.filter((c) => present.has(c))
}

// Legend rows for the non-zone features: lines, decision points and each
// point-of-interest type.
export type AtesLegendItem =
  | { kind: 'access_route' | 'avalanche_path' | 'decision_point' }
  | { kind: 'poi'; poi: AtesPoiType }

/** The non-zone features present in any area, in a fixed order. */
export function atesLegendItemsPresent(areas: AtesArea[]): AtesLegendItem[] {
  const kinds = new Set<string>()
  const pois = new Set<AtesPoiType>()
  for (const area of areas) {
    for (const f of area.geojson.features) {
      kinds.add(f.properties.kind)
      if (f.properties.kind === 'poi') pois.add(f.properties.poi)
    }
  }
  return [
    ...(['decision_point', 'avalanche_path', 'access_route'] as const)
      .filter((k) => kinds.has(k))
      .map((kind) => ({ kind })),
    ...ATES_POI_TYPES.filter((p) => pois.has(p)).map((poi) => ({ kind: 'poi' as const, poi })),
  ]
}

/** [[west, south], [east, north]] of every coordinate in the area, or null if it has none. */
export function atesAreaBounds(area: AtesArea): [[number, number], [number, number]] | null {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity]
  const visit = ([lng, lat]: [number, number]) => {
    west = Math.min(west, lng)
    east = Math.max(east, lng)
    south = Math.min(south, lat)
    north = Math.max(north, lat)
  }
  for (const f of area.geojson.features) {
    const g = f.geometry
    if (g.type === 'Point') visit(g.coordinates)
    else if (g.type === 'LineString') g.coordinates.forEach(visit)
    else g.coordinates.forEach((ring) => ring.forEach(visit))
  }
  return Number.isFinite(west) ? [[west, south], [east, north]] : null
}

import { buildAtesArea } from '../../storage/contract'
import { ATES_CLASSES, type AtesArea } from '../../types'
import {
  atesAreaBounds,
  atesClassColorExpression,
  atesClassesPresent,
  atesZoneCounts,
  buildAtesGeoJson,
} from './atesLayerData'
import { ATES_CLASS_COLORS } from './layerStyles'

const twoZones: AtesArea = buildAtesArea({
  id: 'b',
  name: 'Bow',
  geojson: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[-116.2, 51.6], [-116.1, 51.6], [-116.1, 51.7], [-116.2, 51.6]]] },
        properties: { kind: 'zone', ates: 'simple', description: '' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[-116.3, 51.5], [-116.25, 51.5], [-116.25, 51.55], [-116.3, 51.5]]] },
        properties: { kind: 'zone', ates: 'simple', description: '' },
      },
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-116.2, 51.6], [-116.21, 51.61]] },
        properties: { kind: 'ates_line', ates: 'extreme', name: 'Couloir' },
      },
    ],
  },
})

describe('buildAtesGeoJson', () => {
  it('merges every area and stamps features with their area', () => {
    const fc = buildAtesGeoJson([buildAtesArea(), twoZones])
    expect(fc.features).toHaveLength(2 + 3)
    expect(fc.features[0].properties).toMatchObject({ kind: 'zone', areaId: 'ates-1', areaName: 'Test Basin' })
    expect(fc.features[4].properties).toMatchObject({ kind: 'ates_line', areaId: 'b', areaName: 'Bow' })
  })

  it('is empty with no areas', () => {
    expect(buildAtesGeoJson([])).toEqual({ type: 'FeatureCollection', features: [] })
  })
})

describe('atesClassColorExpression', () => {
  it('maps every class to its colour', () => {
    const expr = atesClassColorExpression()
    expect(expr.slice(0, 2)).toEqual(['match', ['get', 'ates']])
    for (const c of ATES_CLASSES) {
      expect(expr[expr.indexOf(c) + 1]).toBe(ATES_CLASS_COLORS[c])
    }
  })
})

describe('area summaries', () => {
  it('counts zones by class', () => {
    expect(atesZoneCounts(twoZones)).toEqual({ simple: 2 })
    expect(atesZoneCounts(buildAtesArea())).toEqual({ complex: 1 })
  })

  it('lists the classes present across areas in ATES order', () => {
    expect(atesClassesPresent([twoZones, buildAtesArea()])).toEqual(['simple', 'complex', 'extreme'])
    expect(atesClassesPresent([])).toEqual([])
  })

  it('bounds every coordinate of an area', () => {
    expect(atesAreaBounds(twoZones)).toEqual([[-116.3, 51.5], [-116.1, 51.7]])
    expect(atesAreaBounds(buildAtesArea({ geojson: { type: 'FeatureCollection', features: [] } }))).toBeNull()
  })
})

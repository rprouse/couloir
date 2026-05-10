import { buildRoutesGeoJson } from './routesLayerData'
import type { Route } from '../../types'

const baseRoute = (over: Partial<Route> = {}): Route => ({
  id: 'r1',
  user_id: 'local',
  name: 'r',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
  source_hash: 'h',
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 100,
  elevation_gain_m: 10,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('buildRoutesGeoJson', () => {
  it('returns a FeatureCollection with one feature per route', () => {
    const fc = buildRoutesGeoJson([
      baseRoute({ id: 'a' }),
      baseRoute({ id: 'b' }),
    ])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(2)
    expect(fc.features.map((f) => f.properties.id)).toEqual(['a', 'b'])
  })

  it('exposes id and color as feature properties for click + paint', () => {
    const fc = buildRoutesGeoJson([baseRoute({ id: 'a', color: '#ff0000' })])
    expect(fc.features[0].properties).toEqual({ id: 'a', color: '#ff0000' })
  })

  it('produces an empty collection for no routes', () => {
    const fc = buildRoutesGeoJson([])
    expect(fc).toEqual({ type: 'FeatureCollection', features: [] })
  })
})

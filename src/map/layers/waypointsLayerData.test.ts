import { buildWaypointsGeoJson } from './waypointsLayerData'
import type { Waypoint } from '../../types'

const baseWaypoint = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: 'w1',
  user_id: 'local',
  name: 'wp',
  description: '',
  lat: 49.5,
  lng: -116,
  elevation_m: 1500,
  category: 'summit',
  color: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('buildWaypointsGeoJson', () => {
  it('returns a FeatureCollection with one Point feature per waypoint', () => {
    const fc = buildWaypointsGeoJson([
      baseWaypoint({ id: 'a' }),
      baseWaypoint({ id: 'b', lat: 50, lng: -115, category: 'hazard' }),
    ])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].geometry.type).toBe('Point')
  })

  it('exposes id and category as feature properties', () => {
    const fc = buildWaypointsGeoJson([baseWaypoint({ id: 'a', category: 'cliff_band' })])
    expect(fc.features[0].properties).toEqual({ id: 'a', category: 'cliff_band' })
  })

  it('orders coordinates as [lng, lat]', () => {
    const fc = buildWaypointsGeoJson([baseWaypoint({ lat: 49.5, lng: -116 })])
    expect(fc.features[0].geometry.coordinates).toEqual([-116, 49.5])
  })

  it('produces an empty collection for no waypoints', () => {
    expect(buildWaypointsGeoJson([])).toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })
})

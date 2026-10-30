import { gpxFilename, routeToGpx, trackToGpx, waypointToGpx } from './gpxWrite'
import { parseGpx } from './gpx'
import type { Route, Track, Waypoint } from '../types'

const line = {
  user_id: 'local',
  name: 'Polar Peak <NE> & "co"',
  description: 'Spring line',
  geojson: {
    type: 'LineString' as const,
    coordinates: [[-116.1, 49.5, 1500], [-116.2, 49.51, 1620.5]] as Array<[number, number, number]>,
  },
  source_hash: 'h',
  source_filename: 'polar.gpx',
  color: '#2A7BE0',
  distance_m: 1,
  elevation_gain_m: 1,
  elevation_loss_m: 0,
  tags: [],
  created_at: '',
  updated_at: '',
}

describe('GPX export', () => {
  it('round-trips a route through the importer', () => {
    const route: Route = { ...line, id: 'r1', ates: null, technical_difficulty: null }
    const parsed = parseGpx(routeToGpx(route), 'out.gpx')
    expect(parsed.kind).toBe('route')
    expect(parsed.name).toBe(route.name)
    expect(parsed.description).toBe('Spring line')
    expect(parsed.geojson).toEqual(route.geojson)
  })

  it('round-trips a track through the importer', () => {
    const track: Track = {
      ...line, id: 't1', duration_s: null, moving_time_s: null, recorded_at: null,
    }
    const parsed = parseGpx(trackToGpx(track), 'out.gpx')
    expect(parsed.kind).toBe('track')
    expect(parsed.name).toBe(track.name)
    expect(parsed.geojson).toEqual(track.geojson)
  })

  it('writes a waypoint as a wpt with elevation and category', () => {
    const wp: Waypoint = {
      id: 'w1', user_id: 'local', name: 'Col', description: '', lat: 49.5, lng: -116,
      elevation_m: 2400, category: 'summit', color: null, icon: null, tags: [],
      created_at: '', updated_at: '',
    }
    const doc = new DOMParser().parseFromString(waypointToGpx(wp), 'application/xml')
    const wpt = doc.querySelector('wpt')!
    expect(wpt.getAttribute('lat')).toBe('49.5')
    expect(wpt.getAttribute('lon')).toBe('-116')
    expect(wpt.querySelector('ele')?.textContent).toBe('2400')
    expect(wpt.querySelector('name')?.textContent).toBe('Col')
    expect(wpt.querySelector('desc')).toBeNull()
    expect(wpt.querySelector('type')?.textContent).toBe('summit')
  })
})

describe('gpxFilename', () => {
  it.each([
    ['Polar Peak / NE face', 'Polar-Peak-NE-face.gpx'],
    ['Mont Ste-Anne côté', 'Mont-Ste-Anne-cote.gpx'],
    ['  ', 'route.gpx'],
    ['🏔️', 'route.gpx'],
  ])('%j → %j', (name, expected) => {
    expect(gpxFilename(name, 'route')).toBe(expected)
  })
})

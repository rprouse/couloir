import { convertRouteToTrack, convertTrackToRoute, routeToTrack, trackToRoute } from './convertLine'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { InMemoryStorageProvider } from '../../storage/memory'
import { clearStorage, getStorage, setStorage } from '../../storage/provider'
import { DEFAULTS, type Route, type Track } from '../../types'

const line = {
  user_id: 'local',
  name: 'Line',
  description: 'desc',
  geojson: {
    type: 'LineString' as const,
    coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1600]] as Array<[number, number, number]>,
  },
  source_hash: 'h',
  source_filename: 'line.gpx',
  distance_m: 1000,
  elevation_gain_m: 100,
  elevation_loss_m: 0,
  tags: [] as string[],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const route: Route = {
  ...line,
  id: 'r1',
  color: '#123456',
  ates: 'complex',
  technical_difficulty: 'hard',
}

const track: Track = {
  ...line,
  id: 't1',
  color: '#654321',
  duration_s: 3600,
  moving_time_s: 3000,
  recorded_at: '2026-01-01T08:00:00.000Z',
}

describe('routeToTrack / trackToRoute', () => {
  it('keeps the line and takes the track default colour', () => {
    const t = routeToTrack(route)
    expect(t).toMatchObject({
      id: 'r1', name: 'Line', geojson: route.geojson, source_hash: 'h',
      distance_m: 1000, created_at: route.created_at,
      color: DEFAULTS.track.color, duration_s: null, moving_time_s: null, recorded_at: null,
    })
    expect(t).not.toHaveProperty('ates')
    expect(t).not.toHaveProperty('technical_difficulty')
  })

  it('keeps the line and takes the route default colour', () => {
    const r = trackToRoute(track)
    expect(r).toMatchObject({
      id: 't1', name: 'Line', geojson: track.geojson, created_at: track.created_at,
      color: DEFAULTS.route.color, ates: null, technical_difficulty: null,
    })
    expect(r).not.toHaveProperty('duration_s')
    expect(r).not.toHaveProperty('recorded_at')
  })
})

describe('convertRouteToTrack / convertTrackToRoute', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useRoutesStore.setState({ routes: [], loading: false, error: null })
    useTracksStore.setState({ tracks: [], loading: false, error: null })
  })
  afterEach(() => clearStorage())

  it('moves a route to the tracks, in storage and in the stores', async () => {
    await useRoutesStore.getState().insert(route)
    await convertRouteToTrack(route)
    expect(await getStorage().getRoute('r1')).toBeNull()
    expect(await getStorage().getTrack('r1')).toMatchObject({ color: DEFAULTS.track.color })
    expect(useRoutesStore.getState().routes).toHaveLength(0)
    expect(useTracksStore.getState().tracks.map((t) => t.id)).toEqual(['r1'])
  })

  it('moves a track to the routes, in storage and in the stores', async () => {
    await useTracksStore.getState().insert(track)
    await convertTrackToRoute(track)
    expect(await getStorage().getTrack('t1')).toBeNull()
    expect(await getStorage().getRoute('t1')).toMatchObject({ color: DEFAULTS.route.color })
    expect(useTracksStore.getState().tracks).toHaveLength(0)
    expect(useRoutesStore.getState().routes.map((r) => r.id)).toEqual(['t1'])
  })
})

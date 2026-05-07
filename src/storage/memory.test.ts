import { InMemoryStorageProvider } from './memory'
import type { Route, Track } from '../types'

const FIXED_GEOJSON = {
  type: 'LineString' as const,
  coordinates: [
    [-116.0, 49.5, 1500] as [number, number, number],
    [-116.001, 49.501, 1520] as [number, number, number],
  ],
}

function buildRoute(overrides: Partial<Route> = {}): Route {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'route-1',
    user_id: 'local',
    name: 'Test Route',
    description: '',
    geojson: FIXED_GEOJSON,
    source_hash: 'hash-1',
    source_filename: 'test.gpx',
    color: '#E05C2A',
    ates: 'simple',
    technical_difficulty: 'moderate',
    distance_m: 100,
    elevation_gain_m: 20,
    elevation_loss_m: 0,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function buildTrack(overrides: Partial<Track> = {}): Track {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'track-1',
    user_id: 'local',
    name: 'Test Track',
    description: '',
    geojson: FIXED_GEOJSON,
    source_hash: 'hash-2',
    source_filename: 'test.gpx',
    color: '#2A7BE0',
    distance_m: 100,
    elevation_gain_m: 20,
    elevation_loss_m: 0,
    duration_s: 600,
    moving_time_s: 540,
    recorded_at: now,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('InMemoryStorageProvider — routes', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('returns an empty list initially', async () => {
    expect(await storage.getRoutes()).toEqual([])
  })

  it('saves and reads a route round-trip', async () => {
    const route = buildRoute()
    await storage.saveRoute(route)
    const fetched = await storage.getRoute(route.id)
    expect(fetched).toEqual(route)
  })

  it('lists routes sorted by created_at', async () => {
    await storage.saveRoute(buildRoute({ id: 'a', created_at: '2026-01-02T00:00:00.000Z' }))
    await storage.saveRoute(buildRoute({ id: 'b', source_hash: 'hb', created_at: '2026-01-01T00:00:00.000Z' }))
    const all = await storage.getRoutes()
    expect(all.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('overwrites on save with same id', async () => {
    await storage.saveRoute(buildRoute({ name: 'A' }))
    await storage.saveRoute(buildRoute({ name: 'B', updated_at: '2026-05-06T13:00:00.000Z' }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.name).toBe('B')
    expect(fetched?.updated_at).toBe('2026-05-06T13:00:00.000Z')
  })

  it('deletes a route', async () => {
    await storage.saveRoute(buildRoute())
    await storage.deleteRoute('route-1')
    expect(await storage.getRoute('route-1')).toBeNull()
    expect(await storage.getRoutes()).toEqual([])
  })

  it('looks up by source_hash', async () => {
    await storage.saveRoute(buildRoute({ source_hash: 'unique-abc' }))
    const found = await storage.getRouteBySourceHash('unique-abc')
    expect(found?.id).toBe('route-1')
    const missing = await storage.getRouteBySourceHash('nope')
    expect(missing).toBeNull()
  })

  it('persists the tags array via the junction store', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags.sort()).toEqual(['t1', 't2'])
  })

  it('replaces tags on subsequent save', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
    await storage.saveRoute(buildRoute({ tags: ['t3'] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags).toEqual(['t3'])
  })

  it('deduplicates tag ids on save', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1', 't1', 't2'] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags.sort()).toEqual(['t1', 't2'])
  })

  it('preserves null optional metadata round-trip', async () => {
    await storage.saveRoute(buildRoute({
      ates: null,
      technical_difficulty: null,
      source_filename: null,
    }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.ates).toBeNull()
    expect(fetched?.technical_difficulty).toBeNull()
    expect(fetched?.source_filename).toBeNull()
  })

  it('removes tag links when the entity is deleted', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1'] }))
    await storage.deleteRoute('route-1')
    // Re-save under the same id with no tags — should not pick up old links.
    await storage.saveRoute(buildRoute({ tags: [] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags).toEqual([])
  })

  it('does not mutate the caller-supplied entity (defensive copy)', async () => {
    const route = buildRoute({ name: 'Original' })
    await storage.saveRoute(route)
    route.name = 'Mutated'
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.name).toBe('Original')
  })
})

describe('InMemoryStorageProvider — tracks', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves and reads a track round-trip', async () => {
    const track = buildTrack()
    await storage.saveTrack(track)
    expect(await storage.getTrack(track.id)).toEqual(track)
  })

  it('looks up by source_hash', async () => {
    await storage.saveTrack(buildTrack({ source_hash: 'th' }))
    expect((await storage.getTrackBySourceHash('th'))?.id).toBe('track-1')
    expect(await storage.getTrackBySourceHash('nope')).toBeNull()
  })

  it('preserves nullable time fields', async () => {
    await storage.saveTrack(buildTrack({
      duration_s: null,
      moving_time_s: null,
      recorded_at: null,
    }))
    const fetched = await storage.getTrack('track-1')
    expect(fetched?.duration_s).toBeNull()
    expect(fetched?.moving_time_s).toBeNull()
    expect(fetched?.recorded_at).toBeNull()
  })

  it('does not mix routes and tracks under the same id', async () => {
    await storage.saveRoute(buildRoute({ id: 'shared' }))
    await storage.saveTrack(buildTrack({ id: 'shared', source_hash: 'tx' }))
    const r = await storage.getRoute('shared')
    const t = await storage.getTrack('shared')
    expect(r?.color).toBe('#E05C2A')
    expect(t?.color).toBe('#2A7BE0')
  })
})

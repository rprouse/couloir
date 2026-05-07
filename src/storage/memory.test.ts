import { InMemoryStorageProvider } from './memory'
import type { Photo, Route, Track, Waypoint } from '../types'

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

function buildWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'wp-1',
    user_id: 'local',
    name: 'Test Waypoint',
    description: '',
    lat: 49.5,
    lng: -116.0,
    elevation_m: 1500,
    category: 'summit',
    color: null,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function buildPhoto(overrides: Partial<Photo> = {}): Photo {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'photo-1',
    user_id: 'local',
    name: 'Test Photo',
    description: '',
    lat: 49.5,
    lng: -116.0,
    elevation_m: 1500,
    camera_lat: 49.499,
    camera_lng: -116.001,
    camera_elevation_m: 1495,
    bearing: 90,
    blob_ref: 'photos/photo-1.jpg',
    width: 1024,
    height: 768,
    file_size_bytes: 123456,
    taken_at: now,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('InMemoryStorageProvider — waypoints', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves and reads a waypoint round-trip', async () => {
    const wp = buildWaypoint()
    await storage.saveWaypoint(wp)
    expect(await storage.getWaypoint(wp.id)).toEqual(wp)
  })

  it('preserves nullable elevation and color', async () => {
    await storage.saveWaypoint(buildWaypoint({ elevation_m: null, color: null }))
    const fetched = await storage.getWaypoint('wp-1')
    expect(fetched?.elevation_m).toBeNull()
    expect(fetched?.color).toBeNull()
  })

  it('overwrites color when set', async () => {
    await storage.saveWaypoint(buildWaypoint({ color: '#FF0000' }))
    expect((await storage.getWaypoint('wp-1'))?.color).toBe('#FF0000')
  })

  it('deletes a waypoint and clears its tags', async () => {
    await storage.saveWaypoint(buildWaypoint({ tags: ['t1'] }))
    await storage.deleteWaypoint('wp-1')
    await storage.saveWaypoint(buildWaypoint({ tags: [] }))
    expect((await storage.getWaypoint('wp-1'))?.tags).toEqual([])
  })
})

describe('InMemoryStorageProvider — photos', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves a photo with both blobs', async () => {
    const photo = buildPhoto()
    const fullBlob = new Blob(['full'], { type: 'image/jpeg' })
    const thumbBlob = new Blob(['thumb'], { type: 'image/jpeg' })
    await storage.savePhoto(photo, fullBlob, thumbBlob)

    const fetched = await storage.getPhoto(photo.id)
    expect(fetched).toEqual(photo)

    const full = await storage.getPhotoBlob(photo.id)
    const thumb = await storage.getPhotoThumb(photo.id)
    expect(full).toBe(fullBlob)
    expect(thumb).toBe(thumbBlob)
  })

  it('returns null for a missing photo blob', async () => {
    expect(await storage.getPhotoBlob('nope')).toBeNull()
    expect(await storage.getPhotoThumb('nope')).toBeNull()
  })

  it('preserves all camera_* fields including null values', async () => {
    await storage.savePhoto(
      buildPhoto({
        camera_lat: null,
        camera_lng: null,
        camera_elevation_m: null,
        bearing: null,
      }),
      new Blob(),
      new Blob(),
    )
    const fetched = await storage.getPhoto('photo-1')
    expect(fetched?.camera_lat).toBeNull()
    expect(fetched?.camera_lng).toBeNull()
    expect(fetched?.camera_elevation_m).toBeNull()
    expect(fetched?.bearing).toBeNull()
  })

  it('deletes both blobs along with the metadata', async () => {
    const photo = buildPhoto()
    await storage.savePhoto(photo, new Blob(['a']), new Blob(['b']))
    await storage.deletePhoto(photo.id)
    expect(await storage.getPhoto(photo.id)).toBeNull()
    expect(await storage.getPhotoBlob(photo.id)).toBeNull()
    expect(await storage.getPhotoThumb(photo.id)).toBeNull()
  })
})

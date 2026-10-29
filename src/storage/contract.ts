import type { StorageProvider } from './interface'
import type { Photo, Route, Tag, Track, Waypoint } from '../types'

// Behaviour every StorageProvider must share, run against each implementation
// from its own test file:
//
//   storageContract('InMemoryStorageProvider', {
//     create: async () => new InMemoryStorageProvider(),
//   })
//
// `create` returns a fresh, empty, *uninitialized* provider; the suite calls
// init() and closes every provider it made after each test. Tags are saved
// before entities reference them, because SQL providers enforce the
// entity_tags → tags foreign key.

export interface StorageContractOptions {
  create(): Promise<StorageProvider>
  /** Runs after each test, once the providers it created are closed. */
  cleanup?(): Promise<void>
}

const FIXED_GEOJSON = {
  type: 'LineString' as const,
  coordinates: [
    [-116.0, 49.5, 1500] as [number, number, number],
    [-116.001, 49.501, 1520] as [number, number, number],
  ],
}

export function buildRoute(overrides: Partial<Route> = {}): Route {
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

export function buildTrack(overrides: Partial<Track> = {}): Track {
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

export function buildWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
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
    icon: null,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function buildPhoto(overrides: Partial<Photo> = {}): Photo {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'photo-1',
    user_id: 'local',
    name: 'Test Photo',
    description: '',
    lat: 49.5,
    lng: -116.0,
    elevation_m: 1500,
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

export function buildTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    name: 'Steep',
    color: '#FF8800',
    created_at: '2026-05-06T12:00:00.000Z',
    ...overrides,
  }
}

async function seedTags(storage: StorageProvider, ...ids: string[]): Promise<void> {
  for (const id of ids) await storage.saveTag(buildTag({ id, name: `Tag ${id}` }))
}

async function blobText(blob: Blob | null): Promise<string | null> {
  return blob ? await blob.text() : null
}

export function storageContract(name: string, options: StorageContractOptions): void {
  describe(`${name} — StorageProvider contract`, () => {
    const opened: StorageProvider[] = []
    let storage: StorageProvider

    // A fresh, initialized provider that is closed after the test.
    async function open(): Promise<StorageProvider> {
      const provider = await options.create()
      await provider.init()
      opened.push(provider)
      return provider
    }

    beforeEach(async () => {
      storage = await open()
    })

    afterEach(async () => {
      for (const provider of opened.splice(0)) await provider.close()
      await options.cleanup?.()
    })

    describe('routes', () => {
      it('returns an empty list initially', async () => {
        expect(await storage.getRoutes()).toEqual([])
      })

      it('saves and reads a route round-trip', async () => {
        const route = buildRoute()
        await storage.saveRoute(route)
        expect(await storage.getRoute(route.id)).toEqual(route)
      })

      it('returns null for a missing route', async () => {
        expect(await storage.getRoute('nope')).toBeNull()
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
        expect((await storage.getRouteBySourceHash('unique-abc'))?.id).toBe('route-1')
        expect(await storage.getRouteBySourceHash('nope')).toBeNull()
      })

      it('persists the tags array via the junction store', async () => {
        await seedTags(storage, 't1', 't2')
        await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
        const fetched = await storage.getRoute('route-1')
        expect(fetched?.tags.sort()).toEqual(['t1', 't2'])
      })

      it('hydrates tags on list reads too', async () => {
        await seedTags(storage, 't1')
        await storage.saveRoute(buildRoute({ tags: ['t1'] }))
        expect((await storage.getRoutes())[0].tags).toEqual(['t1'])
      })

      it('replaces tags on subsequent save', async () => {
        await seedTags(storage, 't1', 't2', 't3')
        await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
        await storage.saveRoute(buildRoute({ tags: ['t3'] }))
        expect((await storage.getRoute('route-1'))?.tags).toEqual(['t3'])
      })

      it('deduplicates tag ids on save', async () => {
        await seedTags(storage, 't1', 't2')
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
        await seedTags(storage, 't1')
        await storage.saveRoute(buildRoute({ tags: ['t1'] }))
        await storage.deleteRoute('route-1')
        // Re-save under the same id with no tags — should not pick up old links.
        await storage.saveRoute(buildRoute({ tags: [] }))
        expect((await storage.getRoute('route-1'))?.tags).toEqual([])
      })

      it('does not mutate the caller-supplied entity (defensive copy)', async () => {
        const route = buildRoute({ name: 'Original' })
        await storage.saveRoute(route)
        route.name = 'Mutated'
        expect((await storage.getRoute('route-1'))?.name).toBe('Original')
      })
    })

    describe('tracks', () => {
      it('saves and reads a track round-trip', async () => {
        const track = buildTrack()
        await storage.saveTrack(track)
        expect(await storage.getTrack(track.id)).toEqual(track)
      })

      it('lists and deletes tracks', async () => {
        await storage.saveTrack(buildTrack())
        expect((await storage.getTracks()).map((t) => t.id)).toEqual(['track-1'])
        await storage.deleteTrack('track-1')
        expect(await storage.getTracks()).toEqual([])
        expect(await storage.getTrack('track-1')).toBeNull()
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
        expect((await storage.getRoute('shared'))?.color).toBe('#E05C2A')
        expect((await storage.getTrack('shared'))?.color).toBe('#2A7BE0')
      })
    })

    describe('waypoints', () => {
      it('saves and reads a waypoint round-trip', async () => {
        const wp = buildWaypoint()
        await storage.saveWaypoint(wp)
        expect(await storage.getWaypoint(wp.id)).toEqual(wp)
        expect(await storage.getWaypoints()).toEqual([wp])
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

      it('round-trips an icon override and clears it again', async () => {
        await storage.saveWaypoint(buildWaypoint({ icon: 'cabin' }))
        expect((await storage.getWaypoint('wp-1'))?.icon).toBe('cabin')
        await storage.saveWaypoint(buildWaypoint({ icon: null }))
        expect((await storage.getWaypoint('wp-1'))?.icon).toBeNull()
      })

      it('deletes a waypoint and clears its tags', async () => {
        await seedTags(storage, 't1')
        await storage.saveWaypoint(buildWaypoint({ tags: ['t1'] }))
        await storage.deleteWaypoint('wp-1')
        expect(await storage.getWaypoint('wp-1')).toBeNull()
        await storage.saveWaypoint(buildWaypoint({ tags: [] }))
        expect((await storage.getWaypoint('wp-1'))?.tags).toEqual([])
      })
    })

    describe('photos', () => {
      it('saves a photo with both blobs', async () => {
        const photo = buildPhoto()
        await storage.savePhoto(
          photo,
          new Blob(['full'], { type: 'image/jpeg' }),
          new Blob(['thumb'], { type: 'image/jpeg' }),
        )
        expect(await storage.getPhoto(photo.id)).toEqual(photo)
        expect(await storage.getPhotos()).toEqual([photo])
        expect(await blobText(await storage.getPhotoBlob(photo.id))).toBe('full')
        expect(await blobText(await storage.getPhotoThumb(photo.id))).toBe('thumb')
      })

      it('returns null for a missing photo and its blobs', async () => {
        expect(await storage.getPhoto('nope')).toBeNull()
        expect(await storage.getPhotoBlob('nope')).toBeNull()
        expect(await storage.getPhotoThumb('nope')).toBeNull()
      })

      it('preserves null elevation_m and bearing', async () => {
        await storage.savePhoto(
          buildPhoto({ elevation_m: null, bearing: null }),
          new Blob(['x']), new Blob(['y']),
        )
        const fetched = await storage.getPhoto('photo-1')
        expect(fetched?.elevation_m).toBeNull()
        expect(fetched?.bearing).toBeNull()
      })

      describe('updatePhotoMetadata', () => {
        it('rewrites the row and tags but keeps the stored blobs', async () => {
          const photo = buildPhoto()
          await storage.savePhoto(photo, new Blob(['full']), new Blob(['thumb']))
          await storage.saveTag(buildTag({ id: 't1', name: 'Recon' }))

          await storage.updatePhotoMetadata({ ...photo, name: 'Renamed', lat: 49.6, tags: ['t1'] })

          const fetched = await storage.getPhoto(photo.id)
          expect(fetched?.name).toBe('Renamed')
          expect(fetched?.lat).toBe(49.6)
          expect(fetched?.tags).toEqual(['t1'])
          expect(await blobText(await storage.getPhotoBlob(photo.id))).toBe('full')
          expect(await blobText(await storage.getPhotoThumb(photo.id))).toBe('thumb')
        })

        it('throws when the photo does not exist', async () => {
          await expect(storage.updatePhotoMetadata(buildPhoto())).rejects.toThrow(/not found/)
        })
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

    describe('tags', () => {
      it('saves and reads tags sorted by name', async () => {
        await storage.saveTag(buildTag({ id: 'b', name: 'Mellow' }))
        await storage.saveTag(buildTag({ id: 'a', name: 'Aggressive' }))
        expect((await storage.getTags()).map((t) => t.id)).toEqual(['a', 'b'])
      })

      it('overwrites a tag on save with same id', async () => {
        await storage.saveTag(buildTag({ name: 'Old' }))
        await storage.saveTag(buildTag({ name: 'New' }))
        const all = await storage.getTags()
        expect(all).toHaveLength(1)
        expect(all[0].name).toBe('New')
      })

      it('deletes a tag and removes its junction rows', async () => {
        await storage.saveTag(buildTag())
        await storage.saveRoute(buildRoute({ tags: ['tag-1'] }))
        await storage.deleteTag('tag-1')
        expect(await storage.getTags()).toEqual([])
        expect((await storage.getRoute('route-1'))?.tags).toEqual([])
      })

      it('setEntityTags replaces the entity-tag link list', async () => {
        await seedTags(storage, 't1', 't2', 't3')
        await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
        await storage.setEntityTags('route', 'route-1', ['t3'])
        expect((await storage.getRoute('route-1'))?.tags).toEqual(['t3'])
      })
    })

    describe('backup', () => {
      it('exports an empty bundle for a fresh store', async () => {
        const { bundle, photos, thumbs } = await storage.exportAll()
        expect(bundle.bundle_version).toBe(1)
        expect(bundle.routes).toEqual([])
        expect(bundle.entity_tags).toEqual([])
        expect(photos.size).toBe(0)
        expect(thumbs.size).toBe(0)
      })

      it('round-trips routes, tags, and entity_tags through export+import', async () => {
        await storage.saveTag(buildTag())
        await storage.saveRoute(buildRoute({ tags: ['tag-1'] }))
        const exported = await storage.exportAll()

        const fresh = await open()
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

        expect((await fresh.getRoute('route-1'))?.tags).toEqual(['tag-1'])
        expect((await fresh.getTags()).map((t) => t.id)).toEqual(['tag-1'])
      })

      it('round-trips photo metadata and blobs through export+import', async () => {
        const photo = buildPhoto()
        await storage.savePhoto(
          photo,
          new Blob(['full-bytes'], { type: 'image/jpeg' }),
          new Blob(['thumb-bytes'], { type: 'image/jpeg' }),
        )
        const exported = await storage.exportAll()

        const fresh = await open()
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

        expect(await fresh.getPhoto(photo.id)).toEqual(photo)
        expect(await blobText(await fresh.getPhotoBlob(photo.id))).toBe('full-bytes')
        expect(await blobText(await fresh.getPhotoThumb(photo.id))).toBe('thumb-bytes')
      })

      it('round-trips waypoint icon and colour through export+import', async () => {
        const wp = buildWaypoint({ icon: 'local_parking', color: '#EF4444' })
        await storage.saveWaypoint(wp)
        const exported = await storage.exportAll()
        expect(exported.bundle.waypoints[0].icon).toBe('local_parking')

        const fresh = await open()
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)
        expect(await fresh.getWaypoint(wp.id)).toEqual(wp)
      })

      it('imports a pre-icon waypoint (no icon key) with icon null', async () => {
        const exported = await storage.exportAll()
        const { icon: _icon, ...legacy } = buildWaypoint()
        // A ZIP from before migration 3 has no `icon` key at all; the cast
        // through unknown models that older bundle shape.
        const bundle = { ...exported.bundle, waypoints: [legacy as unknown as Waypoint] }

        const fresh = await open()
        await fresh.importAll(bundle, exported.photos, exported.thumbs)
        expect((await fresh.getWaypoint('wp-1'))?.icon).toBeNull()
      })

      it('importAll is idempotent — running it twice changes nothing', async () => {
        await storage.saveRoute(buildRoute({ name: 'A' }))
        const exported = await storage.exportAll()

        const fresh = await open()
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

        const all = await fresh.getRoutes()
        expect(all).toHaveLength(1)
        expect(all[0].name).toBe('A')
      })

      it('importAll updates rows when the bundle is newer', async () => {
        await storage.saveRoute(buildRoute({
          name: 'Bundle version',
          updated_at: '2026-05-06T13:00:00.000Z',
        }))
        const exported = await storage.exportAll()

        const fresh = await open()
        await fresh.saveRoute(buildRoute({
          name: 'Local stale',
          updated_at: '2026-05-06T12:00:00.000Z',
        }))
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

        expect((await fresh.getRoute('route-1'))?.name).toBe('Bundle version')
      })

      it('importAll preserves rows when the local copy is newer', async () => {
        await storage.saveRoute(buildRoute({
          name: 'Bundle stale',
          updated_at: '2026-05-06T12:00:00.000Z',
        }))
        const exported = await storage.exportAll()

        const fresh = await open()
        await fresh.saveRoute(buildRoute({
          name: 'Local newer',
          updated_at: '2026-05-06T13:00:00.000Z',
        }))
        await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

        expect((await fresh.getRoute('route-1'))?.name).toBe('Local newer')
      })
    })
  })
}

import exifr from 'exifr'
import type { StorageProvider } from '../storage/interface'
import { newId } from '../utils/id'
import type { AtesArea, Photo, Route, Track, Waypoint } from '../types'

// Installs a `window.__couloir` helper for browser-console verification of
// the storage layer. Tree-shaken out of production builds via the
// `import.meta.env.DEV` guard at the call site (main.tsx).
export function installDevConsole(storage: StorageProvider): void {
  const FIXED_GEOJSON = {
    type: 'LineString' as const,
    coordinates: [
      [-115.05, 49.50, 1500] as [number, number, number],
      [-115.06, 49.51, 1620] as [number, number, number],
    ],
  }

  const helper = {
    storage,

    async createDummyRoute(name = 'Dummy Route'): Promise<Route> {
      const now = new Date().toISOString()
      const route: Route = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyRoute',
        geojson: FIXED_GEOJSON,
        source_hash: `dev-${newId()}`,
        source_filename: 'devConsole.ts',
        color: '#E05C2A',
        ates: 'simple',
        technical_difficulty: 'moderate',
        distance_m: 0,
        elevation_gain_m: 120,
        elevation_loss_m: 0,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveRoute(route)
      return route
    },

    async createDummyTrack(name = 'Dummy Track'): Promise<Track> {
      const now = new Date().toISOString()
      const track: Track = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyTrack',
        geojson: FIXED_GEOJSON,
        source_hash: `dev-${newId()}`,
        source_filename: 'devConsole.ts',
        color: '#2A7BE0',
        distance_m: 0,
        elevation_gain_m: 120,
        elevation_loss_m: 0,
        duration_s: 1800,
        moving_time_s: 1700,
        recorded_at: now,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveTrack(track)
      return track
    },

    async createDummyWaypoint(name = 'Dummy Waypoint'): Promise<Waypoint> {
      const now = new Date().toISOString()
      const wp: Waypoint = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyWaypoint',
        lat: 49.5,
        lng: -116.0,
        elevation_m: 1500,
        category: 'summit',
        color: null,
        icon: null,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveWaypoint(wp)
      return wp
    },

    async createDummyPhoto(name = 'Dummy Photo'): Promise<Photo> {
      const now = new Date().toISOString()
      // 1×1 red pixel JPEG, base64 — minimal valid image for blob round-trip
      // testing without bundling fixture files.
      const RED_JPEG_B64 =
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/wgARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUC/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Af/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8C/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyH/2gAMAwEAAgADAAAAEP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q=='
      const bytes = Uint8Array.from(atob(RED_JPEG_B64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      const thumb = new Blob([bytes], { type: 'image/jpeg' })

      const id = newId()
      const photo: Photo = {
        id,
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyPhoto',
        lat: 49.5,
        lng: -116.0,
        elevation_m: 1500,
        bearing: 90,
        blob_ref: `photos/${id}.jpg`,
        width: 1,
        height: 1,
        file_size_bytes: bytes.byteLength,
        taken_at: now,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.savePhoto(photo, blob, thumb)
      return photo
    },

    // Scatters `count` dummy photos within ~±0.15° of `center` (default
    // Fernie). Reload the page afterwards: this writes through storage, not
    // the Zustand slices.
    async createDummyPhotos(count = 120, center: [number, number] = [-115.06, 49.5]): Promise<number> {
      for (let i = 0; i < count; i++) {
        const p = await helper.createDummyPhoto(`Dummy Photo ${i + 1}`)
        await storage.savePhoto(
          {
            ...p,
            lng: center[0] + (Math.random() - 0.5) * 0.3,
            lat: center[1] + (Math.random() - 0.5) * 0.3,
          },
          (await storage.getPhotoBlob(p.id))!,
          (await storage.getPhotoThumb(p.id))!,
        )
      }
      return count
    },

    async listAll(): Promise<{
      routes: Route[]
      tracks: Track[]
      waypoints: Waypoint[]
      photos: Photo[]
      atesAreas: AtesArea[]
    }> {
      const [routes, tracks, waypoints, photos, atesAreas] = await Promise.all([
        storage.getRoutes(),
        storage.getTracks(),
        storage.getWaypoints(),
        storage.getPhotos(),
        storage.getAtesAreas(),
      ])
      return { routes, tracks, waypoints, photos, atesAreas }
    },

    // Expected to resolve undefined: stored JPEGs are re-encoded without EXIF.
    async inspectPhotoExif(id: string): Promise<unknown> {
      const blob = await storage.getPhotoBlob(id)
      if (!blob) throw new Error(`no blob for ${id}`)
      return exifr.parse(blob, true)
    },

    async renameRoute(id: string, name: string): Promise<Route> {
      const existing = await storage.getRoute(id)
      if (!existing) throw new Error(`route ${id} not found`)
      const updated: Route = {
        ...existing,
        name,
        updated_at: new Date().toISOString(),
      }
      await storage.saveRoute(updated)
      return updated
    },

    async list(kind: 'routes' | 'tracks'): Promise<unknown[]> {
      return kind === 'routes' ? storage.getRoutes() : storage.getTracks()
    },

    async exportAll() {
      const result = await storage.exportAll()
      // eslint-disable-next-line no-console
      console.log('[couloir] exported',
        result.bundle.routes.length, 'routes,',
        result.bundle.tracks.length, 'tracks,',
        result.bundle.waypoints.length, 'waypoints,',
        result.bundle.photos.length, 'photos,',
        result.bundle.tags.length, 'tags,',
        result.bundle.entity_tags.length, 'entity_tags rows,',
        result.photos.size, 'full blobs,',
        result.thumbs.size, 'thumb blobs',
      )
      return result
    },

    async reimport(exported: Awaited<ReturnType<typeof storage.exportAll>>) {
      await storage.importAll(exported.bundle, exported.photos, exported.thumbs)
      // eslint-disable-next-line no-console
      console.log('[couloir] re-imported (idempotent if same bundle)')
    },
  }

  ;(globalThis as unknown as { __couloir: typeof helper }).__couloir = helper
  // eslint-disable-next-line no-console
  console.log('[couloir] dev console installed at window.__couloir')
}

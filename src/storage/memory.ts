import type {
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import type { StorageProvider } from './interface'

// In-memory reference implementation of StorageProvider. Used by every
// Vitest test (jsdom has no OPFS) and by any future automated environment
// that doesn't have a browser. Never used in production.
export class InMemoryStorageProvider implements StorageProvider {
  private routes = new Map<string, Route>()
  private tracks = new Map<string, Track>()
  private waypoints = new Map<string, Waypoint>()
  private photos = new Map<string, Photo>()
  private tags = new Map<string, Tag>()
  private entityTags = new Set<string>() // 'route|abc|tag1' style composite keys
  private blobs = new Map<string, Blob>()
  private thumbs = new Map<string, Blob>()

  async init(): Promise<void> {
    // No-op; in-memory state is ready on construction.
  }

  async close(): Promise<void> {
    // Clear all in-memory state. Idempotent — calling close() twice is fine.
    // Also keeps `noUnusedLocals` happy until Tasks 2.2–2.4 wire up the CRUD
    // methods that read these maps.
    this.routes.clear()
    this.tracks.clear()
    this.waypoints.clear()
    this.photos.clear()
    this.tags.clear()
    this.entityTags.clear()
    this.blobs.clear()
    this.thumbs.clear()
  }

  // --- Routes (Task 2.2) ----------------------------------------------------
  async getRoutes(): Promise<Route[]> { throw new Error('not implemented') }
  async getRoute(_id: string): Promise<Route | null> { throw new Error('not implemented') }
  async saveRoute(_route: Route): Promise<void> { throw new Error('not implemented') }
  async deleteRoute(_id: string): Promise<void> { throw new Error('not implemented') }
  async getRouteBySourceHash(_h: string): Promise<Route | null> { throw new Error('not implemented') }

  // --- Tracks (Task 2.2) ----------------------------------------------------
  async getTracks(): Promise<Track[]> { throw new Error('not implemented') }
  async getTrack(_id: string): Promise<Track | null> { throw new Error('not implemented') }
  async saveTrack(_track: Track): Promise<void> { throw new Error('not implemented') }
  async deleteTrack(_id: string): Promise<void> { throw new Error('not implemented') }
  async getTrackBySourceHash(_h: string): Promise<Track | null> { throw new Error('not implemented') }

  // --- Waypoints (Task 2.3) -------------------------------------------------
  async getWaypoints(): Promise<Waypoint[]> { throw new Error('not implemented') }
  async getWaypoint(_id: string): Promise<Waypoint | null> { throw new Error('not implemented') }
  async saveWaypoint(_w: Waypoint): Promise<void> { throw new Error('not implemented') }
  async deleteWaypoint(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Photos (Task 2.3) ----------------------------------------------------
  async getPhotos(): Promise<Photo[]> { throw new Error('not implemented') }
  async getPhoto(_id: string): Promise<Photo | null> { throw new Error('not implemented') }
  async savePhoto(_p: Photo, _b: Blob, _t: Blob): Promise<void> { throw new Error('not implemented') }
  async getPhotoBlob(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  async getPhotoThumb(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  async deletePhoto(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Tags (Task 2.4) ------------------------------------------------------
  async getTags(): Promise<Tag[]> { throw new Error('not implemented') }
  async saveTag(_t: Tag): Promise<void> { throw new Error('not implemented') }
  async deleteTag(_id: string): Promise<void> { throw new Error('not implemented') }
  async setEntityTags(_t: EntityType, _id: string, _ids: string[]): Promise<void> {
    throw new Error('not implemented')
  }

  // --- Backup (Task 2.4) ----------------------------------------------------
  async exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    throw new Error('not implemented')
  }
  async importAll(
    _b: ExportBundle,
    _p: Map<string, Blob>,
    _t: Map<string, Blob>,
  ): Promise<void> {
    throw new Error('not implemented')
  }
}

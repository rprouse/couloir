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
//
// Storage maps are added incrementally as each task wires up its CRUD methods
// (Task 2.2: routes, tracks, entityTags; Task 2.3: waypoints, photos, blobs,
// thumbs). Task 2.4 adds the tags map. Declaring fields only once they're
// actually read keeps `noUnusedLocals` happy without resorting to a placeholder
// `close()` body that touches everything.
export class InMemoryStorageProvider implements StorageProvider {
  private routes = new Map<string, Route>()
  private tracks = new Map<string, Track>()
  private waypoints = new Map<string, Waypoint>()
  private photos = new Map<string, Photo>()
  private blobs = new Map<string, Blob>()
  private thumbs = new Map<string, Blob>()
  private entityTags = new Set<string>() // 'route|abc|tag1' style composite keys

  async init(): Promise<void> {
    // No-op; in-memory state is ready on construction.
  }

  async close(): Promise<void> {
    // No-op. The in-memory maps are dropped when the instance is GC'd.
    // Idempotent — calling close() twice is fine.
  }

  // --- Routes ---------------------------------------------------------------
  async getRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values())
      .map((r) => this.hydrateTags(r, 'route'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getRoute(id: string): Promise<Route | null> {
    const r = this.routes.get(id)
    return r ? this.hydrateTags(r, 'route') : null
  }
  async saveRoute(route: Route): Promise<void> {
    // Store a deep-enough copy so callers mutating their input don't corrupt
    // our state. JSON round-trip is fine — no Date or Blob fields on Route.
    this.routes.set(route.id, JSON.parse(JSON.stringify(route)) as Route)
    this.replaceEntityTags('route', route.id, route.tags)
  }
  async deleteRoute(id: string): Promise<void> {
    this.routes.delete(id)
    this.removeAllTagsFor('route', id)
  }
  async getRouteBySourceHash(hash: string): Promise<Route | null> {
    for (const r of this.routes.values()) {
      if (r.source_hash === hash) return this.hydrateTags(r, 'route')
    }
    return null
  }

  // --- Tracks ---------------------------------------------------------------
  async getTracks(): Promise<Track[]> {
    return Array.from(this.tracks.values())
      .map((t) => this.hydrateTags(t, 'track'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getTrack(id: string): Promise<Track | null> {
    const t = this.tracks.get(id)
    return t ? this.hydrateTags(t, 'track') : null
  }
  async saveTrack(track: Track): Promise<void> {
    this.tracks.set(track.id, JSON.parse(JSON.stringify(track)) as Track)
    this.replaceEntityTags('track', track.id, track.tags)
  }
  async deleteTrack(id: string): Promise<void> {
    this.tracks.delete(id)
    this.removeAllTagsFor('track', id)
  }
  async getTrackBySourceHash(hash: string): Promise<Track | null> {
    for (const t of this.tracks.values()) {
      if (t.source_hash === hash) return this.hydrateTags(t, 'track')
    }
    return null
  }

  // --- Waypoints ------------------------------------------------------------

  async getWaypoints(): Promise<Waypoint[]> {
    return Array.from(this.waypoints.values())
      .map((w) => this.hydrateTags(w, 'waypoint'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getWaypoint(id: string): Promise<Waypoint | null> {
    const w = this.waypoints.get(id)
    return w ? this.hydrateTags(w, 'waypoint') : null
  }
  async saveWaypoint(waypoint: Waypoint): Promise<void> {
    this.waypoints.set(waypoint.id, JSON.parse(JSON.stringify(waypoint)) as Waypoint)
    this.replaceEntityTags('waypoint', waypoint.id, waypoint.tags)
  }
  async deleteWaypoint(id: string): Promise<void> {
    this.waypoints.delete(id)
    this.removeAllTagsFor('waypoint', id)
  }

  // --- Photos ---------------------------------------------------------------

  async getPhotos(): Promise<Photo[]> {
    return Array.from(this.photos.values())
      .map((p) => this.hydrateTags(p, 'photo'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getPhoto(id: string): Promise<Photo | null> {
    const p = this.photos.get(id)
    return p ? this.hydrateTags(p, 'photo') : null
  }
  async savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void> {
    this.photos.set(photo.id, JSON.parse(JSON.stringify(photo)) as Photo)
    this.replaceEntityTags('photo', photo.id, photo.tags)
    this.blobs.set(photo.id, blob)
    this.thumbs.set(photo.id, thumb)
  }
  async getPhotoBlob(id: string): Promise<Blob | null> {
    return this.blobs.get(id) ?? null
  }
  async getPhotoThumb(id: string): Promise<Blob | null> {
    return this.thumbs.get(id) ?? null
  }
  async deletePhoto(id: string): Promise<void> {
    this.photos.delete(id)
    this.blobs.delete(id)
    this.thumbs.delete(id)
    this.removeAllTagsFor('photo', id)
  }

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

  // --- Tag helpers ----------------------------------------------------------

  private tagKey(entityType: EntityType, entityId: string, tagId: string): string {
    return `${entityType}|${entityId}|${tagId}`
  }

  private hydrateTags<T extends { id: string; tags: string[] }>(
    entity: T,
    entityType: EntityType,
  ): T {
    const tags: string[] = []
    const prefix = `${entityType}|${entity.id}|`
    for (const key of this.entityTags) {
      if (key.startsWith(prefix)) tags.push(key.slice(prefix.length))
    }
    tags.sort()
    return { ...entity, tags }
  }

  private replaceEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): void {
    this.removeAllTagsFor(entityType, entityId)
    for (const tagId of tagIds) {
      this.entityTags.add(this.tagKey(entityType, entityId, tagId))
    }
  }

  private removeAllTagsFor(entityType: EntityType, entityId: string): void {
    const prefix = `${entityType}|${entityId}|`
    for (const key of Array.from(this.entityTags)) {
      if (key.startsWith(prefix)) this.entityTags.delete(key)
    }
  }
}

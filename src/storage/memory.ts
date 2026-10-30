import type {
  AtesArea,
  EntityTagRow,
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import { APP_VERSION, BUNDLE_VERSION } from '../types'
import type { StorageProvider } from './interface'

// In-memory reference implementation of StorageProvider. Used by every
// Vitest test that doesn't need a real database. Never used in production.
//
// Storage maps are added incrementally as each task wires up its CRUD methods
// (Task 2.2: routes, tracks, entityTags; Task 2.3: waypoints, photos, blobs,
// thumbs; Task 2.4: tags). Declaring fields only once they're actually read
// keeps `noUnusedLocals` happy without resorting to a placeholder `close()`
// body that touches everything.
export class InMemoryStorageProvider implements StorageProvider {
  private routes = new Map<string, Route>()
  private tracks = new Map<string, Track>()
  private waypoints = new Map<string, Waypoint>()
  private photos = new Map<string, Photo>()
  private blobs = new Map<string, Blob>()
  private thumbs = new Map<string, Blob>()
  private tags = new Map<string, Tag>()
  private atesAreas = new Map<string, AtesArea>()
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
    this.waypoints.set(waypoint.id, cloneWaypoint(waypoint))
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
  async updatePhotoMetadata(photo: Photo): Promise<void> {
    if (!this.photos.has(photo.id)) throw new Error(`photo ${photo.id} not found`)
    this.photos.set(photo.id, JSON.parse(JSON.stringify(photo)) as Photo)
    this.replaceEntityTags('photo', photo.id, photo.tags)
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

  // --- Tags -----------------------------------------------------------------

  async getTags(): Promise<Tag[]> {
    return Array.from(this.tags.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => ({ ...t }))
  }

  async saveTag(tag: Tag): Promise<void> {
    this.tags.set(tag.id, { ...tag })
  }

  async deleteTag(id: string): Promise<void> {
    this.tags.delete(id)
    // Mirror the SQL ON DELETE CASCADE: drop every junction row that
    // referenced this tag. Match on the third tuple element (tag_id)
    // rather than `endsWith` so this stays correct if a future tag id
    // ever contains the separator character.
    for (const key of Array.from(this.entityTags)) {
      // key shape: '<entityType>|<entityId>|<tagId>'
      const parts = key.split('|')
      if (parts.length === 3 && parts[2] === id) this.entityTags.delete(key)
    }
  }

  async setEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    this.replaceEntityTags(entityType, entityId, tagIds)
  }

  // --- ATES areas ----------------------------------------------------------

  async getAtesAreas(): Promise<AtesArea[]> {
    // Same order as SQL `ORDER BY name COLLATE NOCASE, id` (ASCII case-folding).
    const key = (a: AtesArea) => [a.name.toLowerCase(), a.id]
    return Array.from(this.atesAreas.values())
      .map((a) => structuredClone(a))
      .sort((a, b) => {
        const [ka, kb] = [key(a), key(b)]
        for (let i = 0; i < ka.length; i++) {
          if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1
        }
        return 0
      })
  }
  async saveAtesArea(area: AtesArea): Promise<void> {
    this.atesAreas.set(area.id, structuredClone(area))
  }
  async deleteAtesArea(id: string): Promise<void> {
    this.atesAreas.delete(id)
  }

  // --- Backup ---------------------------------------------------------------

  async exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    const [routes, tracks, waypoints, photos, tags, ates_areas] = await Promise.all([
      this.getRoutes(),
      this.getTracks(),
      this.getWaypoints(),
      this.getPhotos(),
      this.getTags(),
      this.getAtesAreas(),
    ])

    const entity_tags: EntityTagRow[] = []
    for (const key of this.entityTags) {
      const [entity_type, entity_id, tag_id] = key.split('|')
      entity_tags.push({
        entity_type: entity_type as EntityType,
        entity_id,
        tag_id,
      })
    }
    // Sort by codepoint (matches SQL `ORDER BY entity_type, entity_id, tag_id`
    // — locale-aware comparators would diverge from the SQL implementation
    // for the same input).
    entity_tags.sort((a, b) => {
      const ka = `${a.entity_type}|${a.entity_id}|${a.tag_id}`
      const kb = `${b.entity_type}|${b.entity_id}|${b.tag_id}`
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })

    const bundle: ExportBundle = {
      bundle_version: BUNDLE_VERSION,
      app_version: APP_VERSION,
      exported_at: new Date().toISOString(),
      routes,
      tracks,
      waypoints,
      photos,
      tags,
      entity_tags,
      ates_areas,
    }

    return {
      bundle,
      photos: new Map(this.blobs),
      thumbs: new Map(this.thumbs),
    }
  }

  async importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void> {
    const isNewer = (a: string, b: string): boolean => a > b // ISO 8601 sorts lexically

    // Tags first — entity_tags references them.
    for (const tag of bundle.tags) {
      const existing = this.tags.get(tag.id)
      if (!existing) this.tags.set(tag.id, { ...tag })
      // Tags don't carry updated_at; we treat existing rows as winning.
    }

    // Entities. Each implicitly carries its tags array; setEntityTags is
    // applied as part of saveX in the live API. For import we explicitly
    // process entity_tags below to honor whatever shape the bundle carries.
    for (const r of bundle.routes) {
      const existing = this.routes.get(r.id)
      if (!existing || isNewer(r.updated_at, existing.updated_at)) {
        this.routes.set(r.id, JSON.parse(JSON.stringify(r)) as Route)
      }
    }
    for (const t of bundle.tracks) {
      const existing = this.tracks.get(t.id)
      if (!existing || isNewer(t.updated_at, existing.updated_at)) {
        this.tracks.set(t.id, JSON.parse(JSON.stringify(t)) as Track)
      }
    }
    for (const w of bundle.waypoints) {
      const existing = this.waypoints.get(w.id)
      if (!existing || isNewer(w.updated_at, existing.updated_at)) {
        this.waypoints.set(w.id, cloneWaypoint(w))
      }
    }
    for (const p of bundle.photos) {
      const existing = this.photos.get(p.id)
      if (!existing || isNewer(p.updated_at, existing.updated_at)) {
        this.photos.set(p.id, JSON.parse(JSON.stringify(p)) as Photo)
      }
    }

    // ATES areas (absent from v1 bundles).
    for (const a of bundle.ates_areas ?? []) {
      const existing = this.atesAreas.get(a.id)
      if (!existing || isNewer(a.updated_at, existing.updated_at)) {
        this.atesAreas.set(a.id, structuredClone(a))
      }
    }

    // Junction rows — additive. Composite-key Set already deduplicates.
    for (const row of bundle.entity_tags) {
      this.entityTags.add(this.tagKey(row.entity_type, row.entity_id, row.tag_id))
    }

    // Blobs — additive (overwrite if present).
    for (const [id, blob] of photos) this.blobs.set(id, blob)
    for (const [id, thumb] of thumbs) this.thumbs.set(id, thumb)
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

// Deep copy, defaulting `icon` for bundles exported before migration 3.
function cloneWaypoint(w: Waypoint): Waypoint {
  const copy = JSON.parse(JSON.stringify(w)) as Waypoint
  return { ...copy, icon: copy.icon ?? null }
}

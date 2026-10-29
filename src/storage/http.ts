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
import { SchemaVersionError } from './errors'
import type { StorageProvider } from './interface'
import { SCHEMA_VERSION } from './migrations'

export interface HttpStorageOptions {
  /** Origin the API lives on. Empty means same origin as the page. */
  baseUrl?: string
  /** Injected in tests to call an in-process server instead of the network. */
  fetchFn?: typeof fetch
}

/** A non-2xx answer from the Couloir server. */
export class HttpStorageError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'HttpStorageError'
  }
}

// How many photo blobs exportAll downloads at once.
const BLOB_FETCH_CONCURRENCY = 4

function segment(value: string): string {
  return encodeURIComponent(value)
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

// The junction rows the SQL export would produce, rebuilt from each entity's
// hydrated tags and sorted the same way (entity_type, entity_id, tag_id).
function entityTagRows(groups: [EntityType, { id: string; tags: string[] }[]][]): EntityTagRow[] {
  const rows: EntityTagRow[] = []
  for (const [entity_type, entities] of groups) {
    for (const entity of entities) {
      for (const tag_id of entity.tags) rows.push({ entity_type, entity_id: entity.id, tag_id })
    }
  }
  const key = (r: EntityTagRow) => [r.entity_type, r.entity_id, r.tag_id]
  return rows.sort((a, b) => {
    const [ka, kb] = [key(a), key(b)]
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1
    }
    return 0
  })
}

/**
 * StorageProvider over the Couloir server's /api (server/app.ts). The server
 * is the source of truth; nothing is cached here beyond what the browser's
 * HTTP cache does for the immutable photo blobs.
 */
export class HttpStorageProvider implements StorageProvider {
  private readonly baseUrl: string
  private readonly fetchFn: typeof fetch

  constructor(options: HttpStorageOptions = {}) {
    this.baseUrl = options.baseUrl ?? ''
    // Wrapped rather than stored bare: calling a detached window.fetch throws
    // "Illegal invocation" in browsers.
    this.fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
  }

  async init(): Promise<void> {
    const health = await this.getJson<{ schemaVersion: number }>('/api/health')
    // A server ahead of this build means a stale cached app; the user needs
    // to reload to get the matching client.
    if (health.schemaVersion > SCHEMA_VERSION) {
      throw new SchemaVersionError(
        `Server database is v${health.schemaVersion}; this app expects v${SCHEMA_VERSION}. ` +
        `Reload the page to update the app.`,
      )
    }
  }

  async close(): Promise<void> {
    // Stateless: nothing to release.
  }

  // --- Routes ---------------------------------------------------------------

  getRoutes(): Promise<Route[]> {
    return this.getJson('/api/routes')
  }

  getRoute(id: string): Promise<Route | null> {
    return this.getJsonOrNull(`/api/routes/${segment(id)}`)
  }

  async saveRoute(route: Route): Promise<void> {
    await this.send(`/api/routes/${segment(route.id)}`, jsonInit('PUT', route))
  }

  async deleteRoute(id: string): Promise<void> {
    await this.send(`/api/routes/${segment(id)}`, { method: 'DELETE' })
  }

  getRouteBySourceHash(hash: string): Promise<Route | null> {
    return this.getJsonOrNull(`/api/routes/by-hash/${segment(hash)}`)
  }

  // --- Tracks ---------------------------------------------------------------

  getTracks(): Promise<Track[]> {
    return this.getJson('/api/tracks')
  }

  getTrack(id: string): Promise<Track | null> {
    return this.getJsonOrNull(`/api/tracks/${segment(id)}`)
  }

  async saveTrack(track: Track): Promise<void> {
    await this.send(`/api/tracks/${segment(track.id)}`, jsonInit('PUT', track))
  }

  async deleteTrack(id: string): Promise<void> {
    await this.send(`/api/tracks/${segment(id)}`, { method: 'DELETE' })
  }

  getTrackBySourceHash(hash: string): Promise<Track | null> {
    return this.getJsonOrNull(`/api/tracks/by-hash/${segment(hash)}`)
  }

  // --- Waypoints ------------------------------------------------------------

  getWaypoints(): Promise<Waypoint[]> {
    return this.getJson('/api/waypoints')
  }

  getWaypoint(id: string): Promise<Waypoint | null> {
    return this.getJsonOrNull(`/api/waypoints/${segment(id)}`)
  }

  async saveWaypoint(waypoint: Waypoint): Promise<void> {
    await this.send(`/api/waypoints/${segment(waypoint.id)}`, jsonInit('PUT', waypoint))
  }

  async deleteWaypoint(id: string): Promise<void> {
    await this.send(`/api/waypoints/${segment(id)}`, { method: 'DELETE' })
  }

  // --- Photos ---------------------------------------------------------------

  getPhotos(): Promise<Photo[]> {
    return this.getJson('/api/photos')
  }

  getPhoto(id: string): Promise<Photo | null> {
    return this.getJsonOrNull(`/api/photos/${segment(id)}`)
  }

  async savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void> {
    const form = new FormData()
    form.append('photo', JSON.stringify(photo))
    form.append('full', blob, `${photo.id}.jpg`)
    form.append('thumb', thumb, `${photo.id}_thumb.jpg`)
    await this.send(`/api/photos/${segment(photo.id)}`, { method: 'PUT', body: form })
  }

  async updatePhotoMetadata(photo: Photo): Promise<void> {
    const res = await this.request(`/api/photos/${segment(photo.id)}`, jsonInit('PATCH', photo))
    // Same message the SQL and in-memory providers throw.
    if (res.status === 404) throw new Error(`photo ${photo.id} not found`)
    await this.check(res)
  }

  getPhotoBlob(id: string): Promise<Blob | null> {
    return this.getBlobOrNull(`/api/photos/${segment(id)}/full`)
  }

  getPhotoThumb(id: string): Promise<Blob | null> {
    return this.getBlobOrNull(`/api/photos/${segment(id)}/thumb`)
  }

  async deletePhoto(id: string): Promise<void> {
    await this.send(`/api/photos/${segment(id)}`, { method: 'DELETE' })
  }

  // --- Tags -----------------------------------------------------------------

  getTags(): Promise<Tag[]> {
    return this.getJson('/api/tags')
  }

  async saveTag(tag: Tag): Promise<void> {
    await this.send(`/api/tags/${segment(tag.id)}`, jsonInit('PUT', tag))
  }

  async deleteTag(id: string): Promise<void> {
    await this.send(`/api/tags/${segment(id)}`, { method: 'DELETE' })
  }

  async setEntityTags(entityType: EntityType, entityId: string, tagIds: string[]): Promise<void> {
    await this.send(
      `/api/entity-tags/${segment(entityType)}/${segment(entityId)}`,
      jsonInit('PUT', { tagIds }),
    )
  }

  // --- ATES areas ----------------------------------------------------------

  getAtesAreas(): Promise<AtesArea[]> {
    return this.getJson('/api/ates-areas')
  }

  async saveAtesArea(area: AtesArea): Promise<void> {
    await this.send(`/api/ates-areas/${segment(area.id)}`, jsonInit('PUT', area))
  }

  async deleteAtesArea(id: string): Promise<void> {
    await this.send(`/api/ates-areas/${segment(id)}`, { method: 'DELETE' })
  }

  // --- Backup ---------------------------------------------------------------

  // Assembled client-side from the list endpoints; the server has no export
  // endpoint (it would have to load every blob to answer one).
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

    const bundle: ExportBundle = {
      bundle_version: BUNDLE_VERSION,
      app_version: APP_VERSION,
      exported_at: new Date().toISOString(),
      routes,
      tracks,
      waypoints,
      photos,
      tags,
      entity_tags: entityTagRows([
        ['route', routes], ['track', tracks], ['waypoint', waypoints], ['photo', photos],
      ]),
      ates_areas,
    }

    const photoBlobs = new Map<string, Blob>()
    const thumbBlobs = new Map<string, Blob>()
    await mapLimit(photos, BLOB_FETCH_CONCURRENCY, async (p) => {
      const [full, thumb] = await Promise.all([this.getPhotoBlob(p.id), this.getPhotoThumb(p.id)])
      if (full) photoBlobs.set(p.id, full)
      if (thumb) thumbBlobs.set(p.id, thumb)
    })

    return { bundle, photos: photoBlobs, thumbs: thumbBlobs }
  }

  async importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void> {
    const form = new FormData()
    form.append('bundle', JSON.stringify(bundle))
    for (const [id, blob] of photos) form.append(`full:${id}`, blob, `${id}.jpg`)
    for (const [id, blob] of thumbs) form.append(`thumb:${id}`, blob, `${id}_thumb.jpg`)
    await this.send('/api/import', { method: 'POST', body: form })
  }

  // --- Transport ------------------------------------------------------------

  private async request(path: string, init?: RequestInit): Promise<Response> {
    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, init)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new Error(`Couloir server unreachable (${path}): ${reason}`)
    }
  }

  // Throws HttpStorageError carrying the server's { error } message.
  private async check(res: Response): Promise<Response> {
    if (res.ok) return res
    let message = res.statusText || `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: unknown }
      if (typeof body.error === 'string') message = body.error
    } catch {
      // Not JSON (a proxy error page, say): keep the status text.
    }
    throw new HttpStorageError(res.status, `Couloir server error ${res.status}: ${message}`)
  }

  private async send(path: string, init: RequestInit): Promise<void> {
    await this.check(await this.request(path, init))
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.check(await this.request(path))
    return (await res.json()) as T
  }

  private async getJsonOrNull<T>(path: string): Promise<T | null> {
    const res = await this.request(path)
    if (res.status === 404) return null
    return (await (await this.check(res)).json()) as T
  }

  private async getBlobOrNull(path: string): Promise<Blob | null> {
    const res = await this.request(path)
    if (res.status === 404) return null
    return await (await this.check(res)).blob()
  }
}

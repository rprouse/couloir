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
import { WorkerClient } from './workerClient'
import StorageWorker from './workerHost?worker'
import type { SqlOp, SqlRow, SqlValue } from './workerProtocol'

export class OPFSStorageProvider implements StorageProvider {
  private client: WorkerClient
  // Once closed, the worker is terminated; further calls would hang forever
  // waiting for replies. Track the state so close() is safely idempotent.
  private closed = false

  constructor() {
    this.client = new WorkerClient(new StorageWorker())
  }

  async init(): Promise<void> {
    await this.client.init()
  }

  async close(): Promise<void> {
    if (this.closed) return
    await this.client.close()
    this.client.terminate()
    this.closed = true
  }

  // --- Routes ---------------------------------------------------------------

  async getRoutes(): Promise<Route[]> {
    const rows = await this.client.all(`SELECT * FROM routes ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('route', ids)
    return rows.map((r) => this.rowToRoute(r, tagMap.get(r.id as string) ?? []))
  }

  async getRoute(id: string): Promise<Route | null> {
    const row = await this.client.one(`SELECT * FROM routes WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('route', [id])
    return this.rowToRoute(row, tagMap.get(id) ?? [])
  }

  async saveRoute(route: Route): Promise<void> {
    const ops: SqlOp[] = [
      {
        sql: `INSERT OR REPLACE INTO routes (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                ates, technical_difficulty,
                distance_m, elevation_gain_m, elevation_loss_m,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.routeToRow(route),
      },
      ...this.replaceTagsOps('route', route.id, route.tags),
    ]
    await this.client.tx(ops)
  }

  async deleteRoute(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'route' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM routes WHERE id = ?`, params: [id] },
    ])
  }

  async getRouteBySourceHash(hash: string): Promise<Route | null> {
    const row = await this.client.one(
      `SELECT * FROM routes WHERE source_hash = ? LIMIT 1`,
      [hash],
    )
    if (!row) return null
    const id = row.id as string
    const tagMap = await this.tagsByEntity('route', [id])
    return this.rowToRoute(row, tagMap.get(id) ?? [])
  }

  // --- Tracks ---------------------------------------------------------------

  async getTracks(): Promise<Track[]> {
    const rows = await this.client.all(`SELECT * FROM tracks ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('track', ids)
    return rows.map((r) => this.rowToTrack(r, tagMap.get(r.id as string) ?? []))
  }

  async getTrack(id: string): Promise<Track | null> {
    const row = await this.client.one(`SELECT * FROM tracks WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('track', [id])
    return this.rowToTrack(row, tagMap.get(id) ?? [])
  }

  async saveTrack(track: Track): Promise<void> {
    const ops: SqlOp[] = [
      {
        sql: `INSERT OR REPLACE INTO tracks (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                distance_m, elevation_gain_m, elevation_loss_m,
                duration_s, moving_time_s, recorded_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.trackToRow(track),
      },
      ...this.replaceTagsOps('track', track.id, track.tags),
    ]
    await this.client.tx(ops)
  }

  async deleteTrack(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'track' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM tracks WHERE id = ?`, params: [id] },
    ])
  }

  async getTrackBySourceHash(hash: string): Promise<Track | null> {
    const row = await this.client.one(
      `SELECT * FROM tracks WHERE source_hash = ? LIMIT 1`,
      [hash],
    )
    if (!row) return null
    const id = row.id as string
    const tagMap = await this.tagsByEntity('track', [id])
    return this.rowToTrack(row, tagMap.get(id) ?? [])
  }

  // --- Waypoints ------------------------------------------------------------

  async getWaypoints(): Promise<Waypoint[]> {
    const rows = await this.client.all(`SELECT * FROM waypoints ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('waypoint', ids)
    return rows.map((r) => this.rowToWaypoint(r, tagMap.get(r.id as string) ?? []))
  }

  async getWaypoint(id: string): Promise<Waypoint | null> {
    const row = await this.client.one(`SELECT * FROM waypoints WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('waypoint', [id])
    return this.rowToWaypoint(row, tagMap.get(id) ?? [])
  }

  async saveWaypoint(waypoint: Waypoint): Promise<void> {
    const ops: SqlOp[] = [
      {
        sql: `INSERT OR REPLACE INTO waypoints (
                id, user_id, name, description,
                lat, lng, elevation_m,
                category, color,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.waypointToRow(waypoint),
      },
      ...this.replaceTagsOps('waypoint', waypoint.id, waypoint.tags),
    ]
    await this.client.tx(ops)
  }

  async deleteWaypoint(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'waypoint' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM waypoints WHERE id = ?`, params: [id] },
    ])
  }

  // --- Photos ---------------------------------------------------------------

  private photoFullPath(id: string): string  { return `photos/${id}.jpg` }
  private photoThumbPath(id: string): string { return `photos/${id}_thumb.jpg` }

  async getPhotos(): Promise<Photo[]> {
    const rows = await this.client.all(`SELECT * FROM photos ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('photo', ids)
    return rows.map((r) => this.rowToPhoto(r, tagMap.get(r.id as string) ?? []))
  }

  async getPhoto(id: string): Promise<Photo | null> {
    const row = await this.client.one(`SELECT * FROM photos WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('photo', [id])
    return this.rowToPhoto(row, tagMap.get(id) ?? [])
  }

  async savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void> {
    // Write blobs first; if either fails we abort before touching SQL so
    // we never end up with a metadata row pointing at a missing file.
    // Read both ArrayBuffers up front: if `blob.arrayBuffer()` rejects,
    // no I/O has happened yet, so no rollback is needed. We assume both
    // Blobs are byte-backed (from `new Blob([bytes])` or canvas .toBlob()),
    // not stream-backed — those would be consumed by the first read.
    const fullBuf = await blob.arrayBuffer()
    const thumbBuf = await thumb.arrayBuffer()
    await this.client.writeBlob(this.photoFullPath(photo.id), fullBuf)
    try {
      await this.client.writeBlob(this.photoThumbPath(photo.id), thumbBuf)
    } catch (err) {
      // Best-effort rollback — if deleteBlob itself rejects, swallow it so
      // the original error wins. (The metadata row was never written, so
      // a leaked blob is the only consequence — no UI will see it.)
      try { await this.client.deleteBlob(this.photoFullPath(photo.id)) } catch { /* swallow */ }
      throw err
    }

    try {
      await this.client.tx([
        {
          sql: `INSERT OR REPLACE INTO photos (
                  id, user_id, name, description,
                  lat, lng, elevation_m,
                  camera_lat, camera_lng, camera_elevation_m, bearing,
                  blob_ref,
                  width, height, file_size_bytes,
                  taken_at,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: this.photoToRow(photo),
        },
        ...this.replaceTagsOps('photo', photo.id, photo.tags),
      ])
    } catch (err) {
      // Best-effort rollback of both blobs. Either swallow may run if the
      // file isn't present (worker tolerates that); if a rollback rejects
      // for another reason, swallow it so the original tx-failure error
      // wins and bubbles up unchanged.
      try { await this.client.deleteBlob(this.photoFullPath(photo.id)) } catch { /* swallow */ }
      try { await this.client.deleteBlob(this.photoThumbPath(photo.id)) } catch { /* swallow */ }
      throw err
    }
  }

  async getPhotoBlob(id: string): Promise<Blob | null> {
    const buf = await this.client.readBlob(this.photoFullPath(id))
    return buf ? new Blob([buf], { type: 'image/jpeg' }) : null
  }

  async getPhotoThumb(id: string): Promise<Blob | null> {
    const buf = await this.client.readBlob(this.photoThumbPath(id))
    return buf ? new Blob([buf], { type: 'image/jpeg' }) : null
  }

  async deletePhoto(id: string): Promise<void> {
    // Row-first ordering: SQL row + entity_tags first, then OPFS blobs.
    // A crash between the two leaves orphan files but no UI references
    // them (getPhoto returns null), which is preferable to the inverse
    // (rows pointing at missing blobs that getPhotoBlob would surface as
    // broken images). Phase 6 backup/restore is the orphan-recovery path.
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'photo' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM photos WHERE id = ?`, params: [id] },
    ])
    // Blob cleanup is post-tx because OPFS isn't transactional with SQLite.
    // The worker's deleteBlob silently tolerates a missing file; other
    // errors (quota, permissions) propagate, so a caller retry will be
    // a no-op for the SQL side and re-attempt the blob delete.
    await this.client.deleteBlob(this.photoFullPath(id))
    await this.client.deleteBlob(this.photoThumbPath(id))
  }

  // --- Tags -----------------------------------------------------------------
  getTags(): Promise<Tag[]> { throw new Error('not implemented') }
  saveTag(_t: Tag): Promise<void> { throw new Error('not implemented') }
  deleteTag(_id: string): Promise<void> { throw new Error('not implemented') }
  setEntityTags(_t: EntityType, _id: string, _ids: string[]): Promise<void> {
    throw new Error('not implemented')
  }

  // --- Backup ---------------------------------------------------------------
  exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    throw new Error('not implemented')
  }
  importAll(
    _b: ExportBundle,
    _p: Map<string, Blob>,
    _t: Map<string, Blob>,
  ): Promise<void> {
    throw new Error('not implemented')
  }

  // --- Row serialization ----------------------------------------------------

  private routeToRow(r: Route): SqlValue[] {
    return [
      r.id, r.user_id, r.name, r.description,
      JSON.stringify(r.geojson),
      r.source_hash, r.source_filename,
      r.color,
      r.ates, r.technical_difficulty,
      r.distance_m, r.elevation_gain_m, r.elevation_loss_m,
      r.created_at, r.updated_at,
    ]
  }

  private rowToRoute(row: SqlRow, tags: string[]): Route {
    return {
      id:                   row.id as string,
      user_id:              row.user_id as string,
      name:                 row.name as string,
      description:          row.description as string,
      geojson:              JSON.parse(row.geojson as string),
      source_hash:          row.source_hash as string,
      source_filename:      (row.source_filename as string | null) ?? null,
      color:                row.color as string,
      ates:                 (row.ates as Route['ates']) ?? null,
      technical_difficulty: (row.technical_difficulty as Route['technical_difficulty']) ?? null,
      distance_m:           Number(row.distance_m),
      elevation_gain_m:     Number(row.elevation_gain_m),
      elevation_loss_m:     Number(row.elevation_loss_m),
      tags,
      created_at:           row.created_at as string,
      updated_at:           row.updated_at as string,
    }
  }

  private trackToRow(t: Track): SqlValue[] {
    return [
      t.id, t.user_id, t.name, t.description,
      JSON.stringify(t.geojson),
      t.source_hash, t.source_filename,
      t.color,
      t.distance_m, t.elevation_gain_m, t.elevation_loss_m,
      t.duration_s, t.moving_time_s,
      t.recorded_at,
      t.created_at, t.updated_at,
    ]
  }

  private rowToTrack(row: SqlRow, tags: string[]): Track {
    return {
      id:               row.id as string,
      user_id:          row.user_id as string,
      name:             row.name as string,
      description:      row.description as string,
      geojson:          JSON.parse(row.geojson as string),
      source_hash:      row.source_hash as string,
      source_filename:  (row.source_filename as string | null) ?? null,
      color:            row.color as string,
      distance_m:       Number(row.distance_m),
      elevation_gain_m: Number(row.elevation_gain_m),
      elevation_loss_m: Number(row.elevation_loss_m),
      duration_s:       row.duration_s === null ? null : Number(row.duration_s),
      moving_time_s:    row.moving_time_s === null ? null : Number(row.moving_time_s),
      recorded_at:      (row.recorded_at as string | null) ?? null,
      tags,
      created_at:       row.created_at as string,
      updated_at:       row.updated_at as string,
    }
  }

  private waypointToRow(w: Waypoint): SqlValue[] {
    return [
      w.id, w.user_id, w.name, w.description,
      w.lat, w.lng, w.elevation_m,
      w.category, w.color,
      w.created_at, w.updated_at,
    ]
  }

  private rowToWaypoint(row: SqlRow, tags: string[]): Waypoint {
    return {
      id:          row.id as string,
      user_id:     row.user_id as string,
      name:        row.name as string,
      description: row.description as string,
      lat:         Number(row.lat),
      lng:         Number(row.lng),
      elevation_m: row.elevation_m === null ? null : Number(row.elevation_m),
      category:    row.category as Waypoint['category'],
      color:       (row.color as string | null) ?? null,
      tags,
      created_at:  row.created_at as string,
      updated_at:  row.updated_at as string,
    }
  }

  private photoToRow(p: Photo): SqlValue[] {
    return [
      p.id, p.user_id, p.name, p.description,
      p.lat, p.lng, p.elevation_m,
      p.camera_lat, p.camera_lng, p.camera_elevation_m, p.bearing,
      p.blob_ref,
      p.width, p.height, p.file_size_bytes,
      p.taken_at,
      p.created_at, p.updated_at,
    ]
  }

  private rowToPhoto(row: SqlRow, tags: string[]): Photo {
    return {
      id:                 row.id as string,
      user_id:            row.user_id as string,
      name:               row.name as string,
      description:        row.description as string,
      lat:                Number(row.lat),
      lng:                Number(row.lng),
      elevation_m:        row.elevation_m === null ? null : Number(row.elevation_m),
      camera_lat:         row.camera_lat === null ? null : Number(row.camera_lat),
      camera_lng:         row.camera_lng === null ? null : Number(row.camera_lng),
      camera_elevation_m: row.camera_elevation_m === null ? null : Number(row.camera_elevation_m),
      bearing:            row.bearing === null ? null : Number(row.bearing),
      blob_ref:           row.blob_ref as string,
      width:              Number(row.width),
      height:             Number(row.height),
      file_size_bytes:    Number(row.file_size_bytes),
      taken_at:           (row.taken_at as string | null) ?? null,
      tags,
      created_at:         row.created_at as string,
      updated_at:         row.updated_at as string,
    }
  }

  // --- Tag hydration --------------------------------------------------------

  private async tagsByEntity(
    entityType: EntityType,
    ids: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>()
    for (const id of ids) result.set(id, [])
    if (ids.length === 0) return result
    // SQLite has a parameter-count limit (~999); for our load-all read
    // pattern, ids.length is bounded by the number of rows in the table —
    // for the MVP this is safely well under the limit.
    const placeholders = ids.map(() => '?').join(',')
    const rows = await this.client.all(
      `SELECT entity_id, tag_id FROM entity_tags
       WHERE entity_type = ? AND entity_id IN (${placeholders})`,
      [entityType, ...ids],
    )
    for (const row of rows) {
      const list = result.get(row.entity_id as string)
      if (list) list.push(row.tag_id as string)
    }
    for (const list of result.values()) list.sort()
    return result
  }

  private replaceTagsOps(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): SqlOp[] {
    const ops: SqlOp[] = [
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = ? AND entity_id = ?`,
        params: [entityType, entityId],
      },
    ]
    const seen = new Set<string>()
    for (const tagId of tagIds) {
      if (seen.has(tagId)) continue
      seen.add(tagId)
      ops.push({
        sql: `INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)`,
        params: [entityType, entityId, tagId],
      })
    }
    return ops
  }
}

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
import { isWaypointIcon } from '../icons/waypointIcons'
import type { StorageProvider } from './interface'
import { ensureSchema } from './schema'
import type { SqlBackend, SqlOp, SqlRow, SqlValue } from './sqlBackend'

// StorageProvider over any SqlBackend. All of Couloir's SQL lives here; the
// server's node:sqlite backend (server/nodeBackend.ts) only supplies the
// connection and blob I/O.
export class SqlStorageProvider implements StorageProvider {
  // Track the state so close() is safely idempotent.
  private closed = false

  constructor(protected db: SqlBackend) {}

  async init(): Promise<void> {
    await this.db.init()
    // Blocks until the schema is at SCHEMA_VERSION, so nothing ever reads
    // from a half-migrated database.
    await ensureSchema(this.db)
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.db.close()
  }

  // --- Routes ---------------------------------------------------------------

  async getRoutes(): Promise<Route[]> {
    const rows = await this.db.all(`SELECT * FROM routes ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('route', ids)
    return rows.map((r) => this.rowToRoute(r, tagMap.get(r.id as string) ?? []))
  }

  async getRoute(id: string): Promise<Route | null> {
    const row = await this.db.one(`SELECT * FROM routes WHERE id = ?`, [id])
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
    await this.db.tx(ops)
  }

  async deleteRoute(id: string): Promise<void> {
    await this.db.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'route' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM routes WHERE id = ?`, params: [id] },
    ])
  }

  async getRouteBySourceHash(hash: string): Promise<Route | null> {
    const row = await this.db.one(
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
    const rows = await this.db.all(`SELECT * FROM tracks ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('track', ids)
    return rows.map((r) => this.rowToTrack(r, tagMap.get(r.id as string) ?? []))
  }

  async getTrack(id: string): Promise<Track | null> {
    const row = await this.db.one(`SELECT * FROM tracks WHERE id = ?`, [id])
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
    await this.db.tx(ops)
  }

  async deleteTrack(id: string): Promise<void> {
    await this.db.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'track' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM tracks WHERE id = ?`, params: [id] },
    ])
  }

  async getTrackBySourceHash(hash: string): Promise<Track | null> {
    const row = await this.db.one(
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
    const rows = await this.db.all(`SELECT * FROM waypoints ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('waypoint', ids)
    return rows.map((r) => this.rowToWaypoint(r, tagMap.get(r.id as string) ?? []))
  }

  async getWaypoint(id: string): Promise<Waypoint | null> {
    const row = await this.db.one(`SELECT * FROM waypoints WHERE id = ?`, [id])
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
                category, color, icon,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.waypointToRow(waypoint),
      },
      ...this.replaceTagsOps('waypoint', waypoint.id, waypoint.tags),
    ]
    await this.db.tx(ops)
  }

  async deleteWaypoint(id: string): Promise<void> {
    await this.db.tx([
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
    const rows = await this.db.all(`SELECT * FROM photos ORDER BY created_at`)
    const ids = rows.map((r) => r.id as string)
    const tagMap = await this.tagsByEntity('photo', ids)
    return rows.map((r) => this.rowToPhoto(r, tagMap.get(r.id as string) ?? []))
  }

  async getPhoto(id: string): Promise<Photo | null> {
    const row = await this.db.one(`SELECT * FROM photos WHERE id = ?`, [id])
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
    await this.db.writeBlob(this.photoFullPath(photo.id), fullBuf)
    try {
      await this.db.writeBlob(this.photoThumbPath(photo.id), thumbBuf)
    } catch (err) {
      // Best-effort rollback — if deleteBlob itself rejects, swallow it so
      // the original error wins. (The metadata row was never written, so
      // a leaked blob is the only consequence — no UI will see it.)
      try { await this.db.deleteBlob(this.photoFullPath(photo.id)) } catch { /* swallow */ }
      throw err
    }

    try {
      await this.db.tx([
        {
          sql: `INSERT OR REPLACE INTO photos (
                  id, user_id, name, description,
                  lat, lng, elevation_m, bearing,
                  blob_ref,
                  width, height, file_size_bytes,
                  taken_at,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: this.photoToRow(photo),
        },
        ...this.replaceTagsOps('photo', photo.id, photo.tags),
      ])
    } catch (err) {
      // Best-effort rollback of both blobs. Either swallow may run if the
      // file isn't present (backends tolerate that); if a rollback rejects
      // for another reason, swallow it so the original tx-failure error
      // wins and bubbles up unchanged.
      try { await this.db.deleteBlob(this.photoFullPath(photo.id)) } catch { /* swallow */ }
      try { await this.db.deleteBlob(this.photoThumbPath(photo.id)) } catch { /* swallow */ }
      throw err
    }
  }

  async updatePhotoMetadata(photo: Photo): Promise<void> {
    const existing = await this.db.one(`SELECT id FROM photos WHERE id = ?`, [photo.id])
    if (!existing) throw new Error(`photo ${photo.id} not found`)
    // Only user-editable columns. blob_ref / dimensions / size are fixed at
    // import, so the stored blobs are never rewritten on a metadata edit.
    await this.db.tx([
      {
        sql: `UPDATE photos
                 SET name = ?, description = ?,
                     lat = ?, lng = ?, elevation_m = ?, bearing = ?,
                     taken_at = ?, updated_at = ?
               WHERE id = ?`,
        params: [
          photo.name, photo.description,
          photo.lat, photo.lng, photo.elevation_m, photo.bearing,
          photo.taken_at, photo.updated_at,
          photo.id,
        ],
      },
      ...this.replaceTagsOps('photo', photo.id, photo.tags),
    ])
  }

  async getPhotoBlob(id: string): Promise<Blob | null> {
    const buf = await this.db.readBlob(this.photoFullPath(id))
    return buf ? new Blob([buf], { type: 'image/jpeg' }) : null
  }

  async getPhotoThumb(id: string): Promise<Blob | null> {
    const buf = await this.db.readBlob(this.photoThumbPath(id))
    return buf ? new Blob([buf], { type: 'image/jpeg' }) : null
  }

  async deletePhoto(id: string): Promise<void> {
    // Row-first ordering: SQL row + entity_tags first, then blobs.
    // A crash between the two leaves orphan files but no UI references
    // them (getPhoto returns null), which is preferable to the inverse
    // (rows pointing at missing blobs that getPhotoBlob would surface as
    // broken images). Phase 6 backup/restore is the orphan-recovery path.
    await this.db.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'photo' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM photos WHERE id = ?`, params: [id] },
    ])
    // Blob cleanup is post-tx because blob storage isn't transactional with SQLite.
    // The backend's deleteBlob silently tolerates a missing file; other
    // errors (quota, permissions) propagate, so a caller retry will be
    // a no-op for the SQL side and re-attempt the blob delete.
    await this.db.deleteBlob(this.photoFullPath(id))
    await this.db.deleteBlob(this.photoThumbPath(id))
  }

  // --- Tags -----------------------------------------------------------------

  async getTags(): Promise<Tag[]> {
    const rows = await this.db.all(`SELECT * FROM tags ORDER BY name`)
    return rows.map(r => ({
      id:         r.id as string,
      name:       r.name as string,
      color:      r.color as string,
      created_at: r.created_at as string,
    }))
  }

  async saveTag(tag: Tag): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
      [tag.id, tag.name, tag.color, tag.created_at],
    )
  }

  async deleteTag(id: string): Promise<void> {
    // ON DELETE CASCADE on entity_tags(tag_id) cleans up junction rows
    // automatically — no application-level cleanup needed (DATA-MODEL.md).
    await this.db.run(`DELETE FROM tags WHERE id = ?`, [id])
  }

  async setEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    await this.db.tx(this.replaceTagsOps(entityType, entityId, tagIds))
  }

  // --- ATES areas ----------------------------------------------------------

  async getAtesAreas(): Promise<AtesArea[]> {
    const rows = await this.db.all(`SELECT * FROM ates_areas ORDER BY name COLLATE NOCASE, id`)
    return rows.map((r) => this.rowToAtesArea(r))
  }

  async saveAtesArea(area: AtesArea): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO ates_areas (
         id, name, source_filename, geojson, imported_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      this.atesAreaToRow(area),
    )
  }

  async deleteAtesArea(id: string): Promise<void> {
    await this.db.run(`DELETE FROM ates_areas WHERE id = ?`, [id])
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

    const junctionRows = await this.db.all(
      `SELECT entity_type, entity_id, tag_id FROM entity_tags
       ORDER BY entity_type, entity_id, tag_id`,
    )
    const entity_tags: EntityTagRow[] = junctionRows.map(r => ({
      entity_type: r.entity_type as EntityType,
      entity_id:   r.entity_id as string,
      tag_id:      r.tag_id as string,
    }))

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

    const photoBlobs = new Map<string, Blob>()
    const thumbBlobs = new Map<string, Blob>()
    for (const p of photos) {
      const full = await this.getPhotoBlob(p.id)
      const thumb = await this.getPhotoThumb(p.id)
      if (full) photoBlobs.set(p.id, full)
      if (thumb) thumbBlobs.set(p.id, thumb)
    }

    return { bundle, photos: photoBlobs, thumbs: thumbBlobs }
  }

  async importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void> {
    // All `updated_at` comparisons below rely on ISO 8601's property that
    // lexical ordering matches chronological ordering. The plain `<=` and
    // `>` operators are correct here; do not change to numeric comparison.
    // Pull current updated_at for every entity in the bundle so we can decide
    // insert-vs-update-vs-skip without making N round-trips.
    const currentUpdatedAt = async (
      table: 'routes' | 'tracks' | 'waypoints' | 'photos' | 'ates_areas',
      ids: string[],
    ): Promise<Map<string, string>> => {
      const result = new Map<string, string>()
      if (ids.length === 0) return result
      // SQLite has a parameter-count cap (~999 by default; modern builds raise it).
      // For MVP-scale backups this stays well under the limit, but if a future
      // backup exceeds ~500 entities of one type, chunk this query. See the
      // matching comment in tagsByEntity().
      const placeholders = ids.map(() => '?').join(',')
      const rows = await this.db.all(
        `SELECT id, updated_at FROM ${table} WHERE id IN (${placeholders})`,
        ids,
      )
      for (const row of rows) result.set(row.id as string, row.updated_at as string)
      return result
    }

    const atesAreas = bundle.ates_areas ?? []  // absent from v1 bundles
    const [
      currentRoutes,
      currentTracks,
      currentWaypoints,
      currentPhotos,
      currentTags,
      currentAtesAreas,
    ] = await Promise.all([
      currentUpdatedAt('routes', bundle.routes.map(r => r.id)),
      currentUpdatedAt('tracks', bundle.tracks.map(t => t.id)),
      currentUpdatedAt('waypoints', bundle.waypoints.map(w => w.id)),
      currentUpdatedAt('photos', bundle.photos.map(p => p.id)),
      // Same SQLite parameter-count cap applies here as in currentUpdatedAt().
      this.db.all(
        `SELECT id FROM tags WHERE id IN (${bundle.tags.map(() => '?').join(',') || 'NULL'})`,
        bundle.tags.map(t => t.id),
      ),
      currentUpdatedAt('ates_areas', atesAreas.map(a => a.id)),
    ])
    const existingTagIds = new Set(currentTags.map(r => r.id as string))

    const ops: SqlOp[] = []

    // Tags — additive. Don't overwrite existing tags (no updated_at to compare).
    for (const tag of bundle.tags) {
      if (existingTagIds.has(tag.id)) continue
      ops.push({
        sql: `INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
        params: [tag.id, tag.name, tag.color, tag.created_at],
      })
    }

    // Routes
    for (const r of bundle.routes) {
      const existingTs = currentRoutes.get(r.id)
      if (existingTs !== undefined && r.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO routes (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                ates, technical_difficulty,
                distance_m, elevation_gain_m, elevation_loss_m,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.routeToRow(r),
      })
    }

    // Tracks
    for (const t of bundle.tracks) {
      const existingTs = currentTracks.get(t.id)
      if (existingTs !== undefined && t.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO tracks (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                distance_m, elevation_gain_m, elevation_loss_m,
                duration_s, moving_time_s, recorded_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.trackToRow(t),
      })
    }

    // Waypoints
    for (const w of bundle.waypoints) {
      const existingTs = currentWaypoints.get(w.id)
      if (existingTs !== undefined && w.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO waypoints (
                id, user_id, name, description,
                lat, lng, elevation_m,
                category, color, icon,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.waypointToRow(w),
      })
    }

    // Photos (metadata only — blobs handled below)
    for (const p of bundle.photos) {
      const existingTs = currentPhotos.get(p.id)
      if (existingTs !== undefined && p.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO photos (
                id, user_id, name, description,
                lat, lng, elevation_m, bearing,
                blob_ref,
                width, height, file_size_bytes,
                taken_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.photoToRow(p),
      })
    }

    // ATES areas — same newer-wins rule as entities.
    for (const a of atesAreas) {
      const existingTs = currentAtesAreas.get(a.id)
      if (existingTs !== undefined && a.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO ates_areas (
                id, name, source_filename, geojson, imported_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
        params: this.atesAreaToRow(a),
      })
    }

    // Junction rows — INSERT OR IGNORE keeps things additive and idempotent.
    for (const row of bundle.entity_tags) {
      ops.push({
        sql: `INSERT OR IGNORE INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)`,
        params: [row.entity_type, row.entity_id, row.tag_id],
      })
    }

    if (ops.length > 0) await this.db.tx(ops)

    // Blobs — write outside the SQL transaction (file ops aren't transactional).
    for (const [id, blob] of photos) {
      await this.db.writeBlob(this.photoFullPath(id), await blob.arrayBuffer())
    }
    for (const [id, thumb] of thumbs) {
      await this.db.writeBlob(this.photoThumbPath(id), await thumb.arrayBuffer())
    }
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
      // ?? null: bundles exported before migration 3 have no icon key.
      w.icon ?? null,
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
      icon:        isWaypointIcon(row.icon) ? row.icon : null,
      tags,
      created_at:  row.created_at as string,
      updated_at:  row.updated_at as string,
    }
  }

  private photoToRow(p: Photo): SqlValue[] {
    return [
      p.id, p.user_id, p.name, p.description,
      p.lat, p.lng, p.elevation_m, p.bearing,
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

  private atesAreaToRow(a: AtesArea): SqlValue[] {
    return [
      a.id, a.name, a.source_filename,
      JSON.stringify(a.geojson),
      a.imported_at, a.updated_at,
    ]
  }

  private rowToAtesArea(row: SqlRow): AtesArea {
    return {
      id:              row.id as string,
      name:            row.name as string,
      source_filename: row.source_filename as string,
      geojson:         JSON.parse(row.geojson as string),
      imported_at:     row.imported_at as string,
      updated_at:      row.updated_at as string,
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
    const rows = await this.db.all(
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

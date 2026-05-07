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
  getWaypoints(): Promise<Waypoint[]> { throw new Error('not implemented') }
  getWaypoint(_id: string): Promise<Waypoint | null> { throw new Error('not implemented') }
  saveWaypoint(_w: Waypoint): Promise<void> { throw new Error('not implemented') }
  deleteWaypoint(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Photos ---------------------------------------------------------------
  getPhotos(): Promise<Photo[]> { throw new Error('not implemented') }
  getPhoto(_id: string): Promise<Photo | null> { throw new Error('not implemented') }
  savePhoto(_p: Photo, _b: Blob, _t: Blob): Promise<void> { throw new Error('not implemented') }
  getPhotoBlob(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  getPhotoThumb(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  deletePhoto(_id: string): Promise<void> { throw new Error('not implemented') }

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

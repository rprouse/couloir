import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate'
import type { StorageProvider } from '../../storage/interface'
import {
  APP_VERSION, BACKUP_MANIFEST_FILE, BACKUP_METADATA_FILE, BUNDLE_VERSION,
  type BackupManifest, type EntityTagRow, type EntityType, type ExportBundle,
  type AtesArea, type Photo, type Route, type Tag, type Track, type Waypoint,
} from '../../types'

export interface BackupSink {
  write(chunk: Uint8Array<ArrayBuffer>): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

// Per-photo thumbnail size guess for the pre-export estimate.
const THUMB_ESTIMATE_BYTES = 12_000

export function backupFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `couloir-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`
}

// Photo bytes + a thumbnail guess per photo + the uncompressed metadata
// JSON. Slightly high, since metadata.json is deflated in the ZIP.
export function estimateBackupBytes(data: {
  routes: Route[]; tracks: Track[]; waypoints: Waypoint[]; photos: Photo[]; tags: Tag[]
  atesAreas?: AtesArea[]
}): number {
  const photoBytes = data.photos.reduce((sum, p) => sum + p.file_size_bytes, 0)
  return photoBytes + data.photos.length * THUMB_ESTIMATE_BYTES + JSON.stringify(data).length
}

// Streams a backup ZIP into `sink`. Photos are read from storage one at a
// time, and each is flushed to the sink before the next is read, so memory
// stays bounded by one photo regardless of library size.
export async function writeBackup(storage: StorageProvider, sink: BackupSink): Promise<BackupManifest> {
  const [routes, tracks, waypoints, photos, tags, ates_areas] = await Promise.all([
    storage.getRoutes(), storage.getTracks(), storage.getWaypoints(), storage.getPhotos(), storage.getTags(),
    storage.getAtesAreas(),
  ])
  const exportedAt = new Date().toISOString()
  const bundle: ExportBundle = {
    bundle_version: BUNDLE_VERSION,
    app_version: APP_VERSION,
    exported_at: exportedAt,
    routes, tracks, waypoints, photos, tags,
    // Entities carry their hydrated tag ids, so the junction rows can be
    // rebuilt here without a storage round-trip.
    entity_tags: [
      ...junctionRows('route', routes), ...junctionRows('track', tracks),
      ...junctionRows('waypoint', waypoints), ...junctionRows('photo', photos),
    ],
    ates_areas,
  }
  const manifest: BackupManifest = {
    bundle_version: BUNDLE_VERSION,
    app_version: APP_VERSION,
    exported_at: exportedAt,
    photo_count: photos.length,
    total_size_bytes: photos.reduce((sum, p) => sum + p.file_size_bytes, 0),
  }

  let writes: Promise<void> = Promise.resolve()
  let zipError: Error | null = null
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      zipError = err
      return
    }
    writes = writes.then(() => sink.write(chunk))
    if (final) writes = writes.then(() => sink.close())
  })

  const add = (name: string, data: Uint8Array, compress: boolean) => {
    // JPEGs are already compressed; deflating them wastes CPU for ~0% gain.
    const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name)
    zip.add(file)
    file.push(data, true)
  }

  try {
    add(BACKUP_MANIFEST_FILE, strToU8(JSON.stringify(manifest, null, 2)), true)
    add(BACKUP_METADATA_FILE, strToU8(JSON.stringify(bundle)), true)
    for (const p of photos) {
      const full = await storage.getPhotoBlob(p.id)
      if (full) add(`photos/${p.id}.jpg`, new Uint8Array(await full.arrayBuffer()), false)
      const thumb = await storage.getPhotoThumb(p.id)
      if (thumb) add(`photos/${p.id}_thumb.jpg`, new Uint8Array(await thumb.arrayBuffer()), false)
      await writes // backpressure: let the sink drain before reading the next photo
      if (zipError) throw zipError
    }
    zip.end()
    await writes
    if (zipError) throw zipError
  } catch (err) {
    await sink.abort?.()
    throw err
  }
  return manifest
}

function junctionRows(type: EntityType, items: Array<{ id: string; tags: string[] }>): EntityTagRow[] {
  return items.flatMap((it) => it.tags.map((tag_id) => ({ entity_type: type, entity_id: it.id, tag_id })))
}

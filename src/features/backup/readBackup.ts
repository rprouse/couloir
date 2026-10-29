import { strFromU8, unzipSync, type Unzipped } from 'fflate'
import {
  BACKUP_MANIFEST_FILE, BACKUP_METADATA_FILE, BUNDLE_VERSION,
  type BackupManifest, type ExportBundle,
} from '../../types'

export class BackupFormatError extends Error {
  name = 'BackupFormatError'
}

export interface ParsedBackup {
  manifest: BackupManifest
  bundle: ExportBundle
  photos: Map<string, Blob>
  thumbs: Map<string, Blob>
}

const PHOTO_ENTRY = /^photos\/([^/]+?)(_thumb)?\.jpg$/

// Collects the archive, then reads it through its central directory with
// fflate's unzipSync. Not the streaming Unzip: fflate's Zip writes every entry
// with a trailing data descriptor, and the streaming reader finds the end of
// such an entry by scanning for the descriptor's signature bytes, which can
// occur inside JPEG data and silently truncate a photo. The central directory
// records exact sizes. importAll takes Maps of every blob anyway, so restore
// is already bounded by the backup's size in memory.
export async function readBackup(chunks: AsyncIterable<Uint8Array>): Promise<ParsedBackup> {
  const parts: Uint8Array[] = []
  for await (const chunk of chunks) parts.push(chunk)

  let entries: Unzipped
  try {
    entries = unzipSync(concat(parts))
  } catch (err) {
    throw new BackupFormatError(`That file isn't a readable ZIP: ${String(err)}`)
  }

  const manifest = readJson<BackupManifest>(entries, BACKUP_MANIFEST_FILE)
  if (typeof manifest.bundle_version !== 'number') {
    throw new BackupFormatError('Not a Couloir backup: the manifest has no bundle_version.')
  }
  if (manifest.bundle_version > BUNDLE_VERSION) {
    throw new BackupFormatError(
      `This backup was made by a newer version of Couloir (format ${manifest.bundle_version}). Update the app to restore it.`,
    )
  }
  const bundle = readJson<ExportBundle>(entries, BACKUP_METADATA_FILE)
  for (const key of ['routes', 'tracks', 'waypoints', 'photos', 'tags', 'entity_tags'] as const) {
    if (!Array.isArray(bundle[key])) throw new BackupFormatError(`The backup's metadata is missing "${key}".`)
  }
  // Optional: v1 backups predate ATES areas.
  if (bundle.ates_areas !== undefined && !Array.isArray(bundle.ates_areas)) {
    throw new BackupFormatError(`The backup's metadata has an invalid "ates_areas".`)
  }

  const photos = new Map<string, Blob>()
  const thumbs = new Map<string, Blob>()
  for (const name of Object.keys(entries)) {
    const m = PHOTO_ENTRY.exec(name)
    if (!m) continue
    const blob = new Blob([entries[name]], { type: 'image/jpeg' })
    // Drop the extracted bytes as soon as the Blob holds them.
    delete entries[name]
    ;(m[2] ? thumbs : photos).set(m[1], blob)
  }
  return { manifest, bundle, photos, thumbs }
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0]
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    bytes.set(p, offset)
    offset += p.length
  }
  return bytes
}

function readJson<T>(entries: Unzipped, name: string): T {
  const bytes = entries[name]
  if (!bytes) throw new BackupFormatError(`Not a Couloir backup: ${name} is missing.`)
  try {
    return JSON.parse(strFromU8(bytes)) as T
  } catch {
    throw new BackupFormatError(`The backup's ${name} is not valid JSON.`)
  }
}

// Chunks of a user-picked file. Falls back to one chunk where Blob.stream()
// isn't available (jsdom).
export async function* fileChunks(file: Blob): AsyncIterable<Uint8Array> {
  if (typeof file.stream !== 'function') {
    yield new Uint8Array(await file.arrayBuffer())
    return
  }
  const reader = file.stream().getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    yield value
  }
}

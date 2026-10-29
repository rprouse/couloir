import { strToU8, zipSync } from 'fflate'
import { InMemoryStorageProvider } from '../../storage/memory'
import { writeBackup, estimateBackupBytes, backupFilename, type BackupSink } from './writeBackup'
import { readBackup, BackupFormatError } from './readBackup'
import { prepareImport } from './prepareImport'
import type { Photo, Route } from '../../types'
import { BUNDLE_VERSION } from '../../types'
import { buildAtesArea } from '../../storage/contract'

const ts = '2026-02-14T12:00:00.000Z'
const route: Route = {
  id: 'r1', user_id: 'local', name: 'Lone Tree', description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116.01, 49.51, 1600]] },
  source_hash: 'h', source_filename: null, color: '#E05C2A', ates: null, technical_difficulty: null,
  distance_m: 1, elevation_gain_m: 100, elevation_loss_m: 0, tags: ['t1'], created_at: ts, updated_at: ts,
}
const photo: Photo = {
  id: 'p1', user_id: 'local', name: 'IMG', description: '', lat: 49.5, lng: -116, elevation_m: null,
  bearing: 90, blob_ref: 'photos/p1.jpg', width: 10, height: 10, file_size_bytes: 4, taken_at: null,
  tags: [], created_at: ts, updated_at: ts,
}

async function seeded(): Promise<InMemoryStorageProvider> {
  const s = new InMemoryStorageProvider()
  await s.init()
  await s.saveTag({ id: 't1', name: 'Steep', color: '#EF4444', created_at: ts })
  await s.saveRoute(route)
  await s.savePhoto(photo, new Blob(['full']), new Blob(['thumb']))
  await s.saveAtesArea(buildAtesArea())
  return s
}

function memorySink(): BackupSink & { chunks: Uint8Array[] } {
  const chunks: Uint8Array[] = []
  return { chunks, write: async (c) => { chunks.push(c) }, close: async () => {} }
}

async function* iterate(chunks: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const c of chunks) yield c
}

const fakeThumb = vi.fn(async () => new Blob(['regenerated']))

describe('backup', () => {
  it('names the file by local date', () => {
    expect(backupFilename(new Date(2026, 1, 4))).toBe('couloir-backup-2026-02-04.zip')
  })

  it('estimates size from photo bytes plus metadata', () => {
    const est = estimateBackupBytes({ routes: [route], tracks: [], waypoints: [], photos: [photo], tags: [] })
    expect(est).toBeGreaterThan(photo.file_size_bytes)
    expect(est).toBeLessThan(1_000_000)
  })

  it('round-trips entities, tags, blobs and thumbnails into an empty store', async () => {
    const sink = memorySink()
    const manifest = await writeBackup(await seeded(), sink)
    expect(manifest).toMatchObject({ bundle_version: BUNDLE_VERSION, photo_count: 1 })

    const parsed = await readBackup(iterate(sink.chunks))
    const prepared = await prepareImport(parsed, fakeThumb)
    const target = new InMemoryStorageProvider()
    await target.init()
    await target.importAll(prepared.bundle, prepared.photos, prepared.thumbs)

    expect((await target.getRoute('r1'))?.tags).toEqual(['t1'])
    expect(await target.getTags()).toHaveLength(1)
    expect(await (await target.getPhotoBlob('p1'))!.text()).toBe('full')
    expect(await (await target.getPhotoThumb('p1'))!.text()).toBe('thumb')
    expect(await target.getAtesAreas()).toEqual([buildAtesArea()])
    expect(fakeThumb).not.toHaveBeenCalled()
  })

  it('is idempotent: importing twice leaves one copy of everything', async () => {
    const sink = memorySink()
    await writeBackup(await seeded(), sink)
    const target = new InMemoryStorageProvider()
    await target.init()
    for (let i = 0; i < 2; i++) {
      const prepared = await prepareImport(await readBackup(iterate(sink.chunks)), fakeThumb)
      await target.importAll(prepared.bundle, prepared.photos, prepared.thumbs)
    }
    expect(await target.getRoutes()).toHaveLength(1)
    expect(await target.getPhotos()).toHaveLength(1)
    expect(await target.getTags()).toHaveLength(1)
  })

  it('round-trips photo bytes that contain ZIP signatures', async () => {
    // JPEG data can contain any byte sequence, including the data-descriptor
    // and header signatures a streaming unzip scans for.
    const bytes = new Uint8Array(200_000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7919) % 251
    bytes.set([0x50, 0x4b, 0x07, 0x08, 1, 2, 3, 4], 1_000)
    bytes.set([0x50, 0x4b, 0x01, 0x02], 2_000)
    bytes.set([0x50, 0x4b, 0x03, 0x04], 3_000)
    const s = new InMemoryStorageProvider()
    await s.init()
    await s.savePhoto(photo, new Blob([bytes]), new Blob(['thumb']))
    const sink = memorySink()
    await writeBackup(s, sink)

    const parsed = await readBackup(iterate(sink.chunks))
    const restored = new Uint8Array(await parsed.photos.get('p1')!.arrayBuffer())
    expect(restored.length).toBe(bytes.length)
    expect(restored.every((b, i) => b === bytes[i])).toBe(true)
    expect(await parsed.thumbs.get('p1')!.text()).toBe('thumb')
  })

  it('regenerates missing thumbnails', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 1, total_size_bytes: 4 })),
      'metadata.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, routes: [], tracks: [], waypoints: [], photos: [photo], tags: [], entity_tags: [] })),
      'photos/p1.jpg': strToU8('full'),
    })
    const prepared = await prepareImport(await readBackup(iterate([zip])), fakeThumb)
    expect(prepared.regeneratedThumbs).toBe(1)
    expect(await prepared.thumbs.get('p1')!.text()).toBe('regenerated')
  })

  it('drops photos whose full-size image is missing', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 1, total_size_bytes: 4 })),
      'metadata.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, routes: [], tracks: [], waypoints: [], photos: [photo], tags: [], entity_tags: [] })),
    })
    const prepared = await prepareImport(await readBackup(iterate([zip])), fakeThumb)
    expect(prepared.bundle.photos).toEqual([])
    expect(prepared.droppedPhotos).toBe(1)
  })

  it('rejects a backup from a newer version', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: BUNDLE_VERSION + 1, app_version: 'x', exported_at: ts, photo_count: 0, total_size_bytes: 0 })),
      'metadata.json': strToU8('{}'),
    })
    await expect(readBackup(iterate([zip]))).rejects.toThrow(/newer version/)
  })

  it('restores a v1 backup, which has no ATES areas', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, photo_count: 0, total_size_bytes: 0 })),
      'metadata.json': strToU8(JSON.stringify({ bundle_version: 1, app_version: 'x', exported_at: ts, routes: [route], tracks: [], waypoints: [], photos: [], tags: [], entity_tags: [] })),
    })
    const prepared = await prepareImport(await readBackup(iterate([zip])), fakeThumb)
    const target = new InMemoryStorageProvider()
    await target.init()
    await target.importAll(prepared.bundle, prepared.photos, prepared.thumbs)
    expect((await target.getRoute('r1'))?.name).toBe('Lone Tree')
    expect(await target.getAtesAreas()).toEqual([])
  })

  it('rejects metadata whose ates_areas is not a list', async () => {
    const zip = zipSync({
      'manifest.json': strToU8(JSON.stringify({ bundle_version: BUNDLE_VERSION, app_version: 'x', exported_at: ts, photo_count: 0, total_size_bytes: 0 })),
      'metadata.json': strToU8(JSON.stringify({ bundle_version: BUNDLE_VERSION, app_version: 'x', exported_at: ts, routes: [], tracks: [], waypoints: [], photos: [], tags: [], entity_tags: [], ates_areas: {} })),
    })
    await expect(readBackup(iterate([zip]))).rejects.toThrow(/ates_areas/)
  })

  it('rejects a ZIP that is not a Couloir backup', async () => {
    await expect(readBackup(iterate([zipSync({ 'hello.txt': strToU8('hi') })])))
      .rejects.toBeInstanceOf(BackupFormatError)
  })
})

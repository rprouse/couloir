// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InMemoryStorageProvider } from '../src/storage/memory'
import {
  buildPhoto, buildRoute, buildTag, buildTrack, buildWaypoint,
} from '../src/storage/contract'
import type { StorageProvider } from '../src/storage/interface'
import { SCHEMA_VERSION } from '../src/storage/migrations'
import type { ExportBundle, Photo } from '../src/types'
import { APP_VERSION, BUNDLE_VERSION } from '../src/types'
import { createApp } from './app'

let storage: InMemoryStorageProvider
let app: ReturnType<typeof createApp>

beforeEach(async () => {
  storage = new InMemoryStorageProvider()
  await storage.init()
  app = createApp({ storage, config: { maptilerKey: 'test-key' } })
})

function put(path: string, body: unknown) {
  return app.request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function photoForm(photo: unknown, full: string | null = 'full-bytes', thumb: string | null = 'thumb-bytes') {
  const form = new FormData()
  form.append('photo', JSON.stringify(photo))
  if (full !== null) form.append('full', new Blob([full], { type: 'image/jpeg' }), 'full.jpg')
  if (thumb !== null) form.append('thumb', new Blob([thumb], { type: 'image/jpeg' }), 'thumb.jpg')
  return form
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error
}

describe('meta endpoints', () => {
  it('reports health and the schema version', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, schemaVersion: SCHEMA_VERSION })
  })

  it('serves the configured Maptiler key, or null', async () => {
    expect(await (await app.request('/api/config')).json()).toEqual({ maptilerKey: 'test-key' })
    const keyless = createApp({ storage, config: { maptilerKey: null } })
    expect(await (await keyless.request('/api/config')).json()).toEqual({ maptilerKey: null })
  })

  it('answers unknown API paths with a JSON 404', async () => {
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect(await errorOf(res)).toBe('not found')
  })
})

describe('routes and tracks', () => {
  it('round-trips a route through PUT, GET, list and DELETE', async () => {
    const route = buildRoute()
    expect((await put('/api/routes/route-1', route)).status).toBe(204)
    expect(await (await app.request('/api/routes/route-1')).json()).toEqual(route)
    expect(await (await app.request('/api/routes')).json()).toEqual([route])

    expect((await app.request('/api/routes/route-1', { method: 'DELETE' })).status).toBe(204)
    expect((await app.request('/api/routes/route-1')).status).toBe(404)
  })

  it('looks routes up by source hash', async () => {
    await storage.saveRoute(buildRoute({ source_hash: 'abc123' }))
    expect((await (await app.request('/api/routes/by-hash/abc123')).json()).id).toBe('route-1')
    expect((await app.request('/api/routes/by-hash/nope')).status).toBe(404)
  })

  it('round-trips a track and looks it up by hash', async () => {
    const track = buildTrack({ source_hash: 'trk' })
    expect((await put('/api/tracks/track-1', track)).status).toBe(204)
    expect(await (await app.request('/api/tracks/track-1')).json()).toEqual(track)
    expect(await (await app.request('/api/tracks')).json()).toEqual([track])
    expect((await (await app.request('/api/tracks/by-hash/trk')).json()).id).toBe('track-1')
    expect((await app.request('/api/tracks/track-1', { method: 'DELETE' })).status).toBe(204)
    expect(await storage.getTrack('track-1')).toBeNull()
  })
})

describe('waypoints', () => {
  it('round-trips a waypoint', async () => {
    const wp = buildWaypoint()
    expect((await put('/api/waypoints/wp-1', wp)).status).toBe(204)
    expect(await (await app.request('/api/waypoints/wp-1')).json()).toEqual(wp)
    expect(await (await app.request('/api/waypoints')).json()).toEqual([wp])
    expect((await app.request('/api/waypoints/wp-1', { method: 'DELETE' })).status).toBe(204)
    expect((await app.request('/api/waypoints/wp-1')).status).toBe(404)
  })
})

describe('request guards', () => {
  it('rejects a body whose id differs from the URL', async () => {
    const res = await put('/api/routes/route-1', buildRoute({ id: 'other' }))
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toMatch(/does not match/)
    expect(await storage.getRoutes()).toEqual([])
  })

  it('rejects malformed and non-object JSON bodies', async () => {
    const malformed = await app.request('/api/routes/route-1', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{nope',
    })
    expect(malformed.status).toBe(400)
    expect((await put('/api/routes/route-1', 'just a string')).status).toBe(400)
    expect((await put('/api/routes/route-1', null)).status).toBe(400)
  })

  it.each([
    ['/api/routes/..%2F..%2Fetc'],
    ['/api/photos/..%2F..%2Fetc%2Fpasswd/full'],
    ['/api/photos/a%20b/thumb'],
    [`/api/waypoints/${'x'.repeat(65)}`],
  ])('rejects the unsafe id in %s', async (path) => {
    const res = await app.request(path)
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toMatch(/invalid id/)
  })

  it('turns storage failures into a logged JSON 500', async () => {
    const failing = { getRoutes: () => Promise.reject(new Error('disk on fire')) } as unknown as StorageProvider
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      const res = await createApp({ storage: failing, config: { maptilerKey: null } }).request('/api/routes')
      expect(res.status).toBe(500)
      expect(await errorOf(res)).toBe('disk on fire')
      expect(String(stderr.mock.calls[0][0])).toMatch(/GET \/api\/routes: .*disk on fire/)
    } finally {
      stderr.mockRestore()
    }
  })
})

describe('photos', () => {
  it('saves a photo from multipart and serves its metadata and blobs', async () => {
    const photo = buildPhoto()
    const res = await app.request('/api/photos/photo-1', { method: 'PUT', body: photoForm(photo) })
    expect(res.status).toBe(204)

    expect(await (await app.request('/api/photos/photo-1')).json()).toEqual(photo)
    expect(await (await app.request('/api/photos')).json()).toEqual([photo])

    const full = await app.request('/api/photos/photo-1/full')
    expect(full.status).toBe(200)
    expect(full.headers.get('Content-Type')).toBe('image/jpeg')
    expect(full.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect(await full.text()).toBe('full-bytes')
    expect(await (await app.request('/api/photos/photo-1/thumb')).text()).toBe('thumb-bytes')
  })

  it('requires both blobs and valid metadata on upload', async () => {
    const photo = buildPhoto()
    const noThumb = await app.request('/api/photos/photo-1', { method: 'PUT', body: photoForm(photo, 'f', null) })
    expect(noThumb.status).toBe(400)
    expect(await errorOf(noThumb)).toMatch(/thumb file is required/)

    const badJson = new FormData()
    badJson.append('photo', '{nope')
    expect((await app.request('/api/photos/photo-1', { method: 'PUT', body: badJson })).status).toBe(400)
    expect(await storage.getPhotos()).toEqual([])
  })

  it('404s for missing photos and blobs', async () => {
    expect((await app.request('/api/photos/nope')).status).toBe(404)
    expect((await app.request('/api/photos/nope/full')).status).toBe(404)
    expect((await app.request('/api/photos/nope/thumb')).status).toBe(404)
  })

  it('PATCH edits metadata and tags without touching the blobs', async () => {
    const photo = buildPhoto()
    await storage.savePhoto(photo, new Blob(['full-bytes']), new Blob(['thumb-bytes']))
    await storage.saveTag(buildTag({ id: 't1' }))

    const edited: Photo = { ...photo, name: 'Renamed', lat: 49.7, tags: ['t1'] }
    const res = await app.request('/api/photos/photo-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edited),
    })
    expect(res.status).toBe(204)
    const fetched = await storage.getPhoto('photo-1')
    expect(fetched).toMatchObject({ name: 'Renamed', lat: 49.7, tags: ['t1'] })
    expect(await (await app.request('/api/photos/photo-1/full')).text()).toBe('full-bytes')
  })

  it('PATCH 404s for a photo that does not exist', async () => {
    const res = await app.request('/api/photos/photo-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPhoto()),
    })
    expect(res.status).toBe(404)
  })

  it('DELETE removes the photo and its blobs', async () => {
    await storage.savePhoto(buildPhoto(), new Blob(['a']), new Blob(['b']))
    expect((await app.request('/api/photos/photo-1', { method: 'DELETE' })).status).toBe(204)
    expect(await storage.getPhoto('photo-1')).toBeNull()
    expect((await app.request('/api/photos/photo-1/full')).status).toBe(404)
  })
})

describe('tags', () => {
  it('saves, lists and deletes tags', async () => {
    const tag = buildTag()
    expect((await put('/api/tags/tag-1', tag)).status).toBe(204)
    expect(await (await app.request('/api/tags')).json()).toEqual([tag])
    expect((await app.request('/api/tags/tag-1', { method: 'DELETE' })).status).toBe(204)
    expect(await storage.getTags()).toEqual([])
  })

  it('replaces an entity\'s tag links', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1'] }))
    const res = await put('/api/entity-tags/route/route-1', { tagIds: ['t2', 't3'] })
    expect(res.status).toBe(204)
    expect((await storage.getRoute('route-1'))?.tags).toEqual(['t2', 't3'])
  })

  it('validates the entity type and tag id list', async () => {
    expect((await put('/api/entity-tags/glacier/route-1', { tagIds: [] })).status).toBe(400)
    expect((await put('/api/entity-tags/route/route-1', { tagIds: 't1' })).status).toBe(400)
    expect((await put('/api/entity-tags/route/route-1', { tagIds: [1] })).status).toBe(400)
    expect((await put('/api/entity-tags/route/route-1', {})).status).toBe(400)
  })
})

describe('import', () => {
  function bundleOf(overrides: Partial<ExportBundle> = {}): ExportBundle {
    return {
      bundle_version: BUNDLE_VERSION,
      app_version: APP_VERSION,
      exported_at: '2026-10-26T00:00:00.000Z',
      routes: [], tracks: [], waypoints: [], photos: [], tags: [], entity_tags: [],
      ...overrides,
    }
  }

  it('restores entities, tag links and every photo\'s blobs', async () => {
    const p1 = buildPhoto({ id: 'p1' })
    const p2 = buildPhoto({ id: 'p2' })
    const form = new FormData()
    form.append('bundle', JSON.stringify(bundleOf({
      routes: [buildRoute()],
      photos: [p1, p2],
      tags: [buildTag()],
      entity_tags: [{ entity_type: 'route', entity_id: 'route-1', tag_id: 'tag-1' }],
    })))
    for (const id of ['p1', 'p2']) {
      form.append(`full:${id}`, new Blob([`${id}-full`]), `${id}.jpg`)
      form.append(`thumb:${id}`, new Blob([`${id}-thumb`]), `${id}_thumb.jpg`)
    }

    const res = await app.request('/api/import', { method: 'POST', body: form })
    expect(res.status).toBe(204)
    expect((await storage.getRoute('route-1'))?.tags).toEqual(['tag-1'])
    expect((await storage.getPhotos()).map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(await (await app.request('/api/photos/p2/full')).text()).toBe('p2-full')
    expect(await (await app.request('/api/photos/p1/thumb')).text()).toBe('p1-thumb')
  })

  it('rejects a missing or foreign bundle', async () => {
    expect((await app.request('/api/import', { method: 'POST', body: new FormData() })).status).toBe(400)
    const foreign = new FormData()
    foreign.append('bundle', JSON.stringify({ hello: 'world' }))
    const res = await app.request('/api/import', { method: 'POST', body: foreign })
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toMatch(/not a Couloir export/)
  })

  it('rejects an unsafe photo id in a blob field name', async () => {
    const form = new FormData()
    form.append('bundle', JSON.stringify(bundleOf()))
    form.append('full:../../evil', new Blob(['x']), 'evil.jpg')
    const res = await app.request('/api/import', { method: 'POST', body: form })
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toMatch(/invalid id/)
  })
})

describe('database snapshot download', () => {
  it('serves the snapshot as an attachment that is never cached', async () => {
    const bytes = new TextEncoder().encode('SQLite format 3 (stand-in bytes)')
    const withSnapshot = createApp({ storage, config: { maptilerKey: null }, databaseSnapshot: async () => bytes })
    const res = await withSnapshot.request('/api/backup/db')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/vnd.sqlite3')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="couloir-\d{8}-\d{4}\.db"$/)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  })

  it('404s where no database snapshot is available', async () => {
    expect((await app.request('/api/backup/db')).status).toBe(404)
  })
})

describe('static site', () => {
  let dist: string
  let site: ReturnType<typeof createApp>

  beforeEach(async () => {
    dist = await mkdtemp(join(tmpdir(), 'couloir-dist-'))
    await mkdir(join(dist, 'assets'))
    await writeFile(join(dist, 'index.html'), '<!doctype html><title>Couloir</title>')
    await writeFile(join(dist, 'assets', 'index-abc123.js'), 'console.log(1)')
    await writeFile(join(dist, 'sw.js'), 'self.skipWaiting()')
    site = createApp({ storage, config: { maptilerKey: null }, staticDir: dist })
  })

  afterEach(async () => {
    await rm(dist, { recursive: true, force: true })
  })

  it('serves index.html at the root, revalidated on every load', async () => {
    const res = await site.request('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/html/)
    expect(res.headers.get('Cache-Control')).toBe('no-cache')
    expect(await res.text()).toContain('<title>Couloir</title>')
  })

  it('caches hashed bundles forever but revalidates the service worker', async () => {
    const bundle = await site.request('/assets/index-abc123.js')
    expect(bundle.status).toBe(200)
    expect(bundle.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable')
    expect((await site.request('/sw.js')).headers.get('Cache-Control')).toBe('no-cache')
  })

  it('falls back to index.html for client-side paths', async () => {
    const res = await site.request('/routes/some-route')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>Couloir</title>')
  })

  it('404s a missing file instead of handing back index.html', async () => {
    expect((await site.request('/assets/missing-999.js')).status).toBe(404)
  })

  it('keeps /api answers and errors as JSON', async () => {
    expect(await (await site.request('/api/health')).json()).toMatchObject({ ok: true })
    const missing = await site.request('/api/nope')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'not found' })
  })

  it('refuses to serve files outside the site directory', async () => {
    await writeFile(join(dist, '..', 'couloir-secret.txt'), 'secret')
    try {
      for (const path of ['/../couloir-secret.txt', '/%2e%2e/couloir-secret.txt', '/assets/..%2f..%2fcouloir-secret.txt']) {
        const res = await site.request(path)
        expect(res.status).toBe(404)
        expect(await res.text()).not.toContain('secret')
      }
    } finally {
      await rm(join(dist, '..', 'couloir-secret.txt'), { force: true })
    }
  })
})

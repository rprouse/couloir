import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { serveStatic } from '@hono/node-server/serve-static'
import type { StorageProvider } from '../src/storage/interface'
import { SCHEMA_VERSION } from '../src/storage/migrations'
import type { AtesArea, EntityType, ExportBundle, Photo, Route, Tag, Track, Waypoint } from '../src/types'
import { logError } from './log'

export interface AppConfig {
  /** Served to clients that have no key of their own. Null when unset. */
  maptilerKey: string | null
}

// Ids end up in file paths (photos/{id}.jpg), so anything outside this set is
// refused before it reaches storage. Covers UUIDs and the short ids tests and
// dev helpers use.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const ENTITY_TYPES: readonly EntityType[] = ['route', 'track', 'waypoint', 'photo']

// Photos are immutable per id: edits go through PATCH and never touch the
// bytes, so browsers can cache them forever.
const IMMUTABLE = 'public, max-age=31536000, immutable'
const BLOB_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': IMMUTABLE,
}

const API_PATH = /^\/api(\/|$)/
const HAS_EXTENSION = /\.[^/]+$/

function badRequest(message: string): never {
  throw new HTTPException(400, { message })
}

function notFound(what: string): never {
  throw new HTTPException(404, { message: `${what} not found` })
}

function checkId(id: string): string {
  if (!ID_PATTERN.test(id)) badRequest(`invalid id: ${id}`)
  return id
}

function idParam(c: Context): string {
  return checkId(c.req.param('id') ?? '')
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return badRequest('body must be JSON')
  }
}

function parseJson(text: unknown, field: string): unknown {
  if (typeof text !== 'string') badRequest(`${field} is required`)
  try {
    return JSON.parse(text)
  } catch {
    return badRequest(`${field} must be JSON`)
  }
}

// The body's id must be present and match the URL, so a PUT can never write
// a different row than the one it addresses.
function entityFor<T extends { id: string }>(body: unknown, id: string): T {
  if (typeof body !== 'object' || body === null) badRequest('body must be an object')
  if ((body as { id?: unknown }).id !== id) badRequest('body id does not match the URL')
  return body as T
}

function blobField(form: Record<string, string | File>, field: string): File {
  const value = form[field]
  if (!(value instanceof File)) badRequest(`${field} file is required`)
  return value
}

async function blobResponse(c: Context, blob: Blob | null, what: string): Promise<Response> {
  if (!blob) notFound(what)
  return c.body(new Uint8Array(await blob.arrayBuffer()), 200, BLOB_HEADERS)
}

// Serves the built SPA from `staticDir` for everything outside /api.
// Vite's hashed bundles under assets/ never change, so they're cached forever;
// index.html, sw.js and the manifest must be revalidated so a deploy shows up.
// Extension-less paths that aren't files fall back to index.html (client-side
// navigation); a missing file with an extension stays a 404.
function mountStaticSite(app: Hono, staticDir: string): void {
  const files = serveStatic({ root: staticDir })
  const indexHtml = serveStatic({ root: staticDir, path: 'index.html' })
  // Set on the returned response: serveStatic's onFound hook runs after the
  // response is built, so headers added there are lost.
  // When the file is missing serveStatic hands back whatever next() resolved
  // to (Hono's context, not a Response), so only touch a real response.
  const withCaching = <T>(res: T, path: string): T => {
    if (res instanceof Response) {
      res.headers.set('Cache-Control', path.startsWith('/assets/') ? IMMUTABLE : 'no-cache')
    }
    return res
  }

  app.get('*', async (c, next) =>
    API_PATH.test(c.req.path) ? next() : withCaching(await files(c, next), c.req.path))
  app.get('*', async (c, next) =>
    API_PATH.test(c.req.path) || HAS_EXTENSION.test(c.req.path)
      ? next()
      : withCaching(await indexHtml(c, next), '/index.html'))
}

/**
 * The Couloir JSON/blob API: one route per StorageProvider method under /api,
 * plus the built SPA when `staticDir` is given. Takes a provider rather than a
 * backend so routes stay thin and tests can run against the in-memory provider.
 */
export function createApp({ storage, config, staticDir, databaseSnapshot }: {
  storage: StorageProvider
  config: AppConfig
  /** Directory holding the built SPA (dist/). Omitted in dev, where Vite serves it. */
  staticDir?: string
  /** A fresh, consistent copy of the SQLite file, for GET /api/backup/db. Omitted where there's no database file. */
  databaseSnapshot?: () => Promise<Uint8Array>
}): Hono {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ ok: true, schemaVersion: SCHEMA_VERSION }))
  app.get('/api/config', (c) => c.json({ maptilerKey: config.maptilerKey }))

  // --- Routes and tracks ----------------------------------------------------

  app.get('/api/routes', async (c) => c.json(await storage.getRoutes()))
  app.get('/api/routes/by-hash/:hash', async (c) =>
    c.json((await storage.getRouteBySourceHash(c.req.param('hash'))) ?? notFound('route')))
  app.get('/api/routes/:id', async (c) =>
    c.json((await storage.getRoute(idParam(c))) ?? notFound('route')))
  app.put('/api/routes/:id', async (c) => {
    await storage.saveRoute(entityFor<Route>(await jsonBody(c), idParam(c)))
    return c.body(null, 204)
  })
  app.delete('/api/routes/:id', async (c) => {
    await storage.deleteRoute(idParam(c))
    return c.body(null, 204)
  })

  app.get('/api/tracks', async (c) => c.json(await storage.getTracks()))
  app.get('/api/tracks/by-hash/:hash', async (c) =>
    c.json((await storage.getTrackBySourceHash(c.req.param('hash'))) ?? notFound('track')))
  app.get('/api/tracks/:id', async (c) =>
    c.json((await storage.getTrack(idParam(c))) ?? notFound('track')))
  app.put('/api/tracks/:id', async (c) => {
    await storage.saveTrack(entityFor<Track>(await jsonBody(c), idParam(c)))
    return c.body(null, 204)
  })
  app.delete('/api/tracks/:id', async (c) => {
    await storage.deleteTrack(idParam(c))
    return c.body(null, 204)
  })

  // --- Waypoints ------------------------------------------------------------

  app.get('/api/waypoints', async (c) => c.json(await storage.getWaypoints()))
  app.get('/api/waypoints/:id', async (c) =>
    c.json((await storage.getWaypoint(idParam(c))) ?? notFound('waypoint')))
  app.put('/api/waypoints/:id', async (c) => {
    await storage.saveWaypoint(entityFor<Waypoint>(await jsonBody(c), idParam(c)))
    return c.body(null, 204)
  })
  app.delete('/api/waypoints/:id', async (c) => {
    await storage.deleteWaypoint(idParam(c))
    return c.body(null, 204)
  })

  // --- Photos ---------------------------------------------------------------

  app.get('/api/photos', async (c) => c.json(await storage.getPhotos()))
  app.get('/api/photos/:id', async (c) =>
    c.json((await storage.getPhoto(idParam(c))) ?? notFound('photo')))
  app.get('/api/photos/:id/full', async (c) =>
    blobResponse(c, await storage.getPhotoBlob(idParam(c)), 'photo'))
  app.get('/api/photos/:id/thumb', async (c) =>
    blobResponse(c, await storage.getPhotoThumb(idParam(c)), 'photo thumbnail'))
  // New photo: multipart with `photo` (JSON metadata), `full` and `thumb`.
  app.put('/api/photos/:id', async (c) => {
    const id = idParam(c)
    const form = await c.req.parseBody()
    const photo = entityFor<Photo>(parseJson(form.photo, 'photo'), id)
    await storage.savePhoto(photo, blobField(form, 'full'), blobField(form, 'thumb'))
    return c.body(null, 204)
  })
  // Metadata edit: row and tags only, blobs untouched.
  app.patch('/api/photos/:id', async (c) => {
    const id = idParam(c)
    const photo = entityFor<Photo>(await jsonBody(c), id)
    if (!(await storage.getPhoto(id))) notFound('photo')
    await storage.updatePhotoMetadata(photo)
    return c.body(null, 204)
  })
  app.delete('/api/photos/:id', async (c) => {
    await storage.deletePhoto(idParam(c))
    return c.body(null, 204)
  })

  // --- Tags -----------------------------------------------------------------

  app.get('/api/tags', async (c) => c.json(await storage.getTags()))
  app.put('/api/tags/:id', async (c) => {
    await storage.saveTag(entityFor<Tag>(await jsonBody(c), idParam(c)))
    return c.body(null, 204)
  })
  app.delete('/api/tags/:id', async (c) => {
    await storage.deleteTag(idParam(c))
    return c.body(null, 204)
  })
  app.put('/api/entity-tags/:type/:id', async (c) => {
    const type = c.req.param('type') as EntityType
    if (!ENTITY_TYPES.includes(type)) badRequest(`invalid entity type: ${type}`)
    const body = await jsonBody(c)
    const tagIds = (body as { tagIds?: unknown } | null)?.tagIds
    if (!Array.isArray(tagIds) || !tagIds.every((t) => typeof t === 'string')) {
      badRequest('tagIds must be an array of strings')
    }
    await storage.setEntityTags(type, idParam(c), tagIds)
    return c.body(null, 204)
  })

  // --- ATES areas ----------------------------------------------------------

  app.get('/api/ates-areas', async (c) => c.json(await storage.getAtesAreas()))
  app.put('/api/ates-areas/:id', async (c) => {
    await storage.saveAtesArea(entityFor<AtesArea>(await jsonBody(c), idParam(c)))
    return c.body(null, 204)
  })
  app.delete('/api/ates-areas/:id', async (c) => {
    await storage.deleteAtesArea(idParam(c))
    return c.body(null, 204)
  })

  // --- Backup ---------------------------------------------------------------

  // The database alone (no photos) as a download: a quick off-box copy. The
  // ZIP export in Settings is the complete backup.
  app.get('/api/backup/db', async (c) => {
    if (!databaseSnapshot) notFound('database snapshot')
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
    return c.body(new Uint8Array(await databaseSnapshot()), 200, {
      'Content-Type': 'application/vnd.sqlite3',
      'Content-Disposition': `attachment; filename="couloir-${stamp}.db"`,
      'Cache-Control': 'no-store',
    })
  })

  // Restore from a backup: multipart with `bundle` (ExportBundle JSON) and a
  // `full:{id}` / `thumb:{id}` file per photo. Export has no endpoint: the
  // client assembles the bundle from the list endpoints and blob URLs.
  app.post('/api/import', async (c) => {
    const form = await c.req.parseBody()
    const bundle = parseJson(form.bundle, 'bundle') as ExportBundle
    if (typeof bundle !== 'object' || bundle === null || typeof bundle.bundle_version !== 'number') {
      badRequest('bundle is not a Couloir export')
    }
    const photos = new Map<string, Blob>()
    const thumbs = new Map<string, Blob>()
    for (const [key, value] of Object.entries(form)) {
      const match = /^(full|thumb):(.+)$/.exec(key)
      if (!match) continue
      if (!(value instanceof File)) badRequest(`${key} must be a file`)
      ;(match[1] === 'full' ? photos : thumbs).set(checkId(match[2]), value)
    }
    await storage.importAll(bundle, photos, thumbs)
    return c.body(null, 204)
  })

  if (staticDir) mountStaticSite(app, staticDir)

  // --- Errors ---------------------------------------------------------------

  app.notFound((c) => c.json({ error: 'not found' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    logError(`${c.req.method} ${c.req.path}`, err)
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
  })

  return app
}

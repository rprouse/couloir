import { buildPhoto } from './contract'
import { SchemaVersionError } from './errors'
import { HttpStorageError, HttpStorageProvider } from './http'
import { SCHEMA_VERSION } from './migrations'

// Transport behaviour against a scripted fetch. The full API round trip is
// covered by server/httpProvider.test.ts, which runs the StorageProvider
// contract through the real server app.

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>

function provider(handler: Handler, baseUrl?: string) {
  const calls: { url: string; method: string }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET' })
    return handler(String(input), init)
  }) as typeof fetch
  return { storage: new HttpStorageProvider({ fetchFn, baseUrl }), calls }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('HttpStorageProvider', () => {
  describe('init', () => {
    it('succeeds when the server schema matches', async () => {
      const { storage, calls } = provider(() => json({ ok: true, schemaVersion: SCHEMA_VERSION }))
      await expect(storage.init()).resolves.toBeUndefined()
      expect(calls).toEqual([{ url: '/api/health', method: 'GET' }])
    })

    it('throws SchemaVersionError when the server is ahead of this build', async () => {
      const { storage } = provider(() => json({ ok: true, schemaVersion: SCHEMA_VERSION + 1 }))
      const err = await storage.init().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(SchemaVersionError)
      expect(String(err)).toMatch(/Reload the page/)
    })

    it('reports an unreachable server clearly', async () => {
      const { storage } = provider(() => { throw new TypeError('Failed to fetch') })
      await expect(storage.init()).rejects.toThrow(/Couloir server unreachable \(\/api\/health\): Failed to fetch/)
    })
  })

  it('prefixes every request with the base URL', async () => {
    const { storage, calls } = provider(() => json([]), 'https://couloir.example')
    await storage.getRoutes()
    expect(calls[0].url).toBe('https://couloir.example/api/routes')
  })

  it('URL-encodes ids and hashes', async () => {
    const { storage, calls } = provider(() => json(null, 404))
    await storage.getRouteBySourceHash('a/b?c')
    expect(calls[0].url).toBe('/api/routes/by-hash/a%2Fb%3Fc')
  })

  it('maps 404 to null on single-entity and blob reads', async () => {
    const { storage } = provider(() => json({ error: 'route not found' }, 404))
    expect(await storage.getRoute('r1')).toBeNull()
    expect(await storage.getPhotoBlob('p1')).toBeNull()
    expect(await storage.getPhotoThumb('p1')).toBeNull()
  })

  it('surfaces the server error message and status on failure', async () => {
    const { storage } = provider(() => json({ error: 'disk on fire' }, 500))
    const err = await storage.getRoute('r1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HttpStorageError)
    expect((err as HttpStorageError).status).toBe(500)
    expect((err as Error).message).toBe('Couloir server error 500: disk on fire')
  })

  it('falls back to the status text when the error body is not JSON', async () => {
    const { storage } = provider(() => new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }))
    await expect(storage.deleteRoute('r1')).rejects.toThrow('Couloir server error 502: Bad Gateway')
  })

  it('does not treat a 404 on a write as success', async () => {
    const { storage } = provider(() => json({ error: 'not found' }, 404))
    await expect(storage.deleteTag('t1')).rejects.toBeInstanceOf(HttpStorageError)
  })

  it('updatePhotoMetadata throws the providers\' "not found" error on 404', async () => {
    const { storage, calls } = provider(() => json({ error: 'photo not found' }, 404))
    await expect(storage.updatePhotoMetadata(buildPhoto())).rejects.toThrow('photo photo-1 not found')
    expect(calls[0]).toEqual({ url: '/api/photos/photo-1', method: 'PATCH' })
  })

  it('uses the global fetch when none is injected', async () => {
    const fetchSpy = vi.fn(async () => json([]))
    vi.stubGlobal('fetch', fetchSpy)
    try {
      expect(await new HttpStorageProvider().getTags()).toEqual([])
      expect(fetchSpy).toHaveBeenCalledWith('/api/tags', undefined)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

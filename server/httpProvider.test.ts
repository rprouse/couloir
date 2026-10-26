// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPhoto, buildRoute, buildTag, storageContract } from '../src/storage/contract'
import { HttpStorageProvider } from '../src/storage/http'
import type { StorageProvider } from '../src/storage/interface'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { createApp } from './app'
import { NodeSqlBackend } from './nodeBackend'

// The whole stack the browser will use, minus the network: HttpStorageProvider
// → Hono app (in-process via app.fetch) → SqlStorageProvider → node:sqlite and
// files in a temp directory.

const tempDirs: string[] = []
const servers: StorageProvider[] = []

async function serverStack(): Promise<HttpStorageProvider> {
  const dir = await mkdtemp(join(tmpdir(), 'couloir-http-'))
  tempDirs.push(dir)
  const storage = new SqlStorageProvider(new NodeSqlBackend(dir))
  await storage.init()
  servers.push(storage)
  const app = createApp({ storage, config: { maptilerKey: null } })
  return new HttpStorageProvider({
    fetchFn: async (input, init) => app.fetch(new Request(new URL(String(input), 'http://couloir.test'), init)),
  })
}

async function teardown(): Promise<void> {
  for (const s of servers.splice(0)) await s.close()
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
}

storageContract('HttpStorageProvider → API → SqlStorageProvider', {
  create: serverStack,
  cleanup: teardown,
})

describe('HttpStorageProvider end to end', () => {
  afterEach(teardown)

  it('exports the same bundle as the server-side provider', async () => {
    const http = await serverStack()
    await http.init()
    await http.saveTag(buildTag({ id: 'a', name: 'A' }))
    await http.saveTag(buildTag({ id: 'b', name: 'B' }))
    await http.saveRoute(buildRoute({ id: 'r2', source_hash: 'h2', tags: ['b', 'a'] }))
    await http.saveRoute(buildRoute({ id: 'r1', tags: ['a'] }))
    await http.savePhoto(buildPhoto({ tags: ['b'] }), new Blob(['f']), new Blob(['t']))

    const viaHttp = await http.exportAll()
    const viaSql = await servers[0].exportAll()

    const strip = (b: typeof viaHttp.bundle) => ({ ...b, exported_at: '' })
    expect(strip(viaHttp.bundle)).toEqual(strip(viaSql.bundle))
    expect(await viaHttp.photos.get('photo-1')?.text()).toBe('f')
    expect(await viaHttp.thumbs.get('photo-1')?.text()).toBe('t')
  })

  it('handles ids and hashes that need URL encoding', async () => {
    const http = await serverStack()
    await http.init()
    await http.saveRoute(buildRoute({ source_hash: 'a/b c?d#e' }))
    expect((await http.getRouteBySourceHash('a/b c?d#e'))?.id).toBe('route-1')
  })
})

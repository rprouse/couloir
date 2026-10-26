// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { storageContract, buildRoute } from '../src/storage/contract'
import { SchemaVersionError } from '../src/storage/errors'
import { SCHEMA_VERSION } from '../src/storage/migrations'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { NodeSqlBackend } from './nodeBackend'

const tempDirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'couloir-test-'))
  tempDirs.push(dir)
  return dir
}

async function removeTempDirs(): Promise<void> {
  for (const dir of tempDirs.splice(0)) await rm(dir, { recursive: true, force: true })
}

storageContract('SqlStorageProvider on NodeSqlBackend', {
  create: async () => new SqlStorageProvider(new NodeSqlBackend(await tempDir())),
  cleanup: removeTempDirs,
})

describe('NodeSqlBackend', () => {
  let dir: string
  const open: NodeSqlBackend[] = []

  async function backend(): Promise<NodeSqlBackend> {
    const b = new NodeSqlBackend(dir)
    open.push(b)
    return b
  }

  beforeEach(async () => {
    dir = await tempDir()
  })

  afterEach(async () => {
    for (const b of open.splice(0)) await b.close()
    await removeTempDirs()
  })

  it('persists data across reopening the same directory', async () => {
    const first = new SqlStorageProvider(await backend())
    await first.init()
    await first.saveRoute(buildRoute())
    await first.close()

    const second = new SqlStorageProvider(await backend())
    await second.init()
    expect((await second.getRoute('route-1'))?.name).toBe('Test Route')
    await second.close()
  })

  it('records the schema version and lays out the data directory', async () => {
    const db = await backend()
    await new SqlStorageProvider(db).init()
    expect(await db.one(`SELECT version FROM schema_version`)).toEqual({ version: SCHEMA_VERSION })
    expect((await readdir(dir)).sort()).toEqual(
      expect.arrayContaining(['couloir.db', 'photos']),
    )
  })

  it('opens the database in WAL mode with foreign keys enforced', async () => {
    const db = await backend()
    await db.init()
    expect(await db.one('PRAGMA journal_mode')).toEqual({ journal_mode: 'wal' })
    expect(await db.one('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 })
  })

  it('refuses a database newer than this build', async () => {
    const db = await backend()
    await new SqlStorageProvider(db).init()
    await db.run(`UPDATE schema_version SET version = ?`, [SCHEMA_VERSION + 1])
    await db.close()

    await expect(new SqlStorageProvider(await backend()).init())
      .rejects.toBeInstanceOf(SchemaVersionError)
  })

  it('rolls back the whole transaction when one op fails', async () => {
    const db = await backend()
    await new SqlStorageProvider(db).init()
    await expect(db.tx([
      { sql: `INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`, params: ['t1', 'A', '#fff', 'now'] },
      { sql: `INSERT INTO no_such_table VALUES (1)` },
    ])).rejects.toThrow()
    expect(await db.all(`SELECT id FROM tags`)).toEqual([])
  })

  it('writes blobs atomically and reads them back', async () => {
    const db = await backend()
    await db.init()
    await db.writeBlob('photos/p1.jpg', new TextEncoder().encode('jpeg-bytes').buffer as ArrayBuffer)
    const read = await db.readBlob('photos/p1.jpg')
    expect(new TextDecoder().decode(read!)).toBe('jpeg-bytes')
    expect(await readdir(join(dir, 'photos'))).toEqual(['p1.jpg'])
  })

  it('treats missing blobs as null on read and a no-op on delete', async () => {
    const db = await backend()
    await db.init()
    expect(await db.readBlob('photos/missing.jpg')).toBeNull()
    await expect(db.deleteBlob('photos/missing.jpg')).resolves.toBeUndefined()
  })

  it('rejects blob paths that escape the data directory', async () => {
    const db = await backend()
    await db.init()
    const bytes = new ArrayBuffer(1)
    await expect(db.writeBlob('../escape.jpg', bytes)).rejects.toThrow(/escapes/)
    await expect(db.readBlob('photos/../../escape.jpg')).rejects.toThrow(/escapes/)
    await expect(db.deleteBlob('/etc/passwd')).rejects.toThrow(/escapes/)
  })
})

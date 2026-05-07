/// <reference lib="webworker" />

// wa-sqlite@1.0.0 (npm) ships an async OPFS VFS but not OPFSCoopSyncVFS; we
// pair the async wasm factory with OriginPrivateFileSystemVFS until a newer
// wa-sqlite is published. See src/storage/wa-sqlite.d.ts for the rationale.
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import * as SQLite from 'wa-sqlite'
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url'
import { MIGRATIONS, SCHEMA_VERSION } from './migrations'
import type {
  Request,
  Response,
  SqlOp,
  SqlRow,
  SqlValue,
} from './workerProtocol'

const DB_FILENAME = 'couloir.db'
const PHOTOS_DIR = 'photos'

let sqlite3: SQLite.SQLiteAPI | null = null
let dbHandle: number | null = null

async function init(): Promise<void> {
  if (sqlite3 !== null) return
  // `locateFile` redirects the wasm fetch to the URL emitted by Vite — without
  // this, the factory looks for `wa-sqlite.wasm` next to the .mjs which fails
  // when the module is bundled and served from a hashed path.
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl })
  const api = SQLite.Factory(module)
  const vfs = new OriginPrivateFileSystemVFS()
  api.vfs_register(vfs, true)
  const handle = await api.open_v2(DB_FILENAME)
  sqlite3 = api
  dbHandle = handle
  await ensureSchema()
}

async function close(): Promise<void> {
  if (sqlite3 && dbHandle !== null) await sqlite3.close(dbHandle)
  sqlite3 = null
  dbHandle = null
}

function api(): SQLite.SQLiteAPI {
  if (!sqlite3 || dbHandle === null) throw new Error('worker: not initialized')
  return sqlite3
}

function db(): number {
  if (dbHandle === null) throw new Error('worker: not initialized')
  return dbHandle
}

// ---- SQL helpers -----------------------------------------------------------

async function exec(sql: string): Promise<void> {
  await api().exec(db(), sql)
}

async function all(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
  const rows: SqlRow[] = []
  for await (const stmt of api().statements(db(), sql)) {
    if (params.length > 0) api().bind_collection(stmt, params)
    while ((await api().step(stmt)) === SQLite.SQLITE_ROW) {
      const cols = api().column_names(stmt)
      const values = api().row(stmt)
      const row: SqlRow = {}
      for (let i = 0; i < cols.length; i++) row[cols[i]] = values[i]
      rows.push(row)
    }
  }
  return rows
}

async function one(sql: string, params: SqlValue[] = []): Promise<SqlRow | null> {
  const rows = await all(sql, params)
  return rows[0] ?? null
}

async function run(sql: string, params: SqlValue[] = []): Promise<void> {
  for await (const stmt of api().statements(db(), sql)) {
    if (params.length > 0) api().bind_collection(stmt, params)
    while ((await api().step(stmt)) === SQLite.SQLITE_ROW) {
      // discard rows
    }
  }
}

async function tx(ops: SqlOp[]): Promise<void> {
  await exec('BEGIN')
  try {
    for (const op of ops) await run(op.sql, op.params ?? [])
    await exec('COMMIT')
  } catch (err) {
    await exec('ROLLBACK')
    throw err
  }
}

// ---- Schema migration ------------------------------------------------------

async function ensureSchema(): Promise<void> {
  // schema_version table may not exist yet on a fresh DB; check via sqlite_master.
  const meta = await one(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`,
  )
  let current = 0
  if (meta) {
    const row = await one(`SELECT version FROM schema_version LIMIT 1`)
    if (row && typeof row.version === 'number') current = row.version
  }

  if (current === SCHEMA_VERSION) return
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `SchemaVersionError: Database is v${current}; this build expects ` +
      `v${SCHEMA_VERSION}. Refresh or downgrade the app.`,
    )
  }

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    await exec('BEGIN')
    try {
      // Migration files contain multi-statement SQL; exec() handles that.
      await api().exec(db(), m.sql)
      await run(
        `INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)`,
        [m.version, new Date().toISOString()],
      )
      await exec('COMMIT')
    } catch (err) {
      await exec('ROLLBACK')
      throw err
    }
  }
}

// ---- OPFS blob ops ---------------------------------------------------------

async function getPhotosDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return await root.getDirectoryHandle(PHOTOS_DIR, { create: true })
}

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

async function writeBlob(path: string, data: ArrayBuffer): Promise<void> {
  const dir = await getPhotosDir()
  const file = await dir.getFileHandle(basename(path), { create: true })
  const writable = await file.createWritable()
  await writable.write(data)
  await writable.close()
}

async function readBlob(path: string): Promise<ArrayBuffer | null> {
  try {
    const dir = await getPhotosDir()
    const file = await dir.getFileHandle(basename(path), { create: false })
    const f = await file.getFile()
    return await f.arrayBuffer()
  } catch {
    return null
  }
}

async function deleteBlob(path: string): Promise<void> {
  try {
    const dir = await getPhotosDir()
    await dir.removeEntry(basename(path))
  } catch {
    // missing file is not an error
  }
}

// ---- Message dispatch ------------------------------------------------------

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.addEventListener('message', async (event: MessageEvent<Request>) => {
  const req = event.data
  try {
    let result: unknown = undefined
    switch (req.type) {
      case 'init':       await init();                              break
      case 'close':      await close();                             break
      case 'all':        result = await all(req.sql, req.params);   break
      case 'one':        result = await one(req.sql, req.params);   break
      case 'run':        await run(req.sql, req.params);            break
      case 'tx':         await tx(req.ops);                         break
      case 'writeBlob':  await writeBlob(req.path, req.data);       break
      case 'readBlob':   result = await readBlob(req.path);         break
      case 'deleteBlob': await deleteBlob(req.path);                break
    }
    const response = { id: req.id, ok: true, result } as Response
    // Transfer ArrayBuffer results to avoid a structured-clone copy.
    const transfer: Transferable[] = result instanceof ArrayBuffer ? [result] : []
    scope.postMessage(response, transfer)
  } catch (err) {
    const response: Response = { id: req.id, ok: false, error: String(err) }
    scope.postMessage(response)
  }
})

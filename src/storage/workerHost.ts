/// <reference lib="webworker" />

// We use AccessHandlePoolVFS — the OPFS VFS that uses synchronous file
// system access handles directly, paired with the regular (non-Asyncify)
// wa-sqlite build. The other OPFS VFS shipped in wa-sqlite@1.0.0
// (OriginPrivateFileSystemVFS, async) routes every file op through
// Asyncify; its callbacks throw OPFS NotFoundError into the wasm bridge
// during normal SQLite housekeeping (xDelete on stale journals, etc.)
// and abort the entire SQLite session. AccessHandlePoolVFS pre-allocates
// a pool of OPFS sync access handles in a managed directory, so SQLite's
// xDelete, xAccess, xLock all work synchronously without async-VFS
// fragility. Tradeoff: single-tab use only (the pool's sync handles are
// exclusive), which matches the architecture document's requirements.
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite.wasm?url'
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js'
import { SchemaVersionError } from './errors'
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
  // AccessHandlePoolVFS keeps all its files inside a single OPFS directory
  // so they don't collide with the photos/ directory or anything else. The
  // VFS pre-allocates a pool of sync access handles in this directory; the
  // logical DB filename ("couloir.db") becomes a handle in the pool, not a
  // discrete OPFS file at the root.
  const vfs = new AccessHandlePoolVFS('/couloir-db')
  await vfs.isReady
  api.vfs_register(vfs, true)
  const handle = await api.open_v2(DB_FILENAME)
  sqlite3 = api
  dbHandle = handle
  // foreign_keys is connection-scoped in SQLite, so it must be set per
  // connection (here in init) rather than in a migration. We route the
  // PRAGMA through run() (statements iterator) rather than legacy
  // api.exec() for consistency with the rest of the file.
  await run('PRAGMA foreign_keys = ON;')
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

// Single-statement execute. We deliberately do NOT use the legacy
// api().exec(db, sql) multi-statement path — on wa-sqlite-async paired with
// OriginPrivateFileSystemVFS that path corrupts the wasm such that the next
// statements()-based query crashes. Routing every statement through
// statements()/step() (here via run) keeps the wasm in a consistent state.
async function exec(sql: string): Promise<void> {
  await run(sql)
}

async function all(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
  const rows: SqlRow[] = []
  let index = 0
  for await (const stmt of api().statements(db(), sql)) {
    // Only bind params to the first statement in multi-statement SQL.
    // Subsequent statements must be parameterless; if they contain
    // placeholders, that's a programmer error and wa-sqlite will throw.
    if (index === 0 && params.length > 0) api().bind_collection(stmt, params)
    while ((await api().step(stmt)) === SQLite.SQLITE_ROW) {
      const cols = api().column_names(stmt)
      const values = api().row(stmt)
      const row: SqlRow = {}
      for (let i = 0; i < cols.length; i++) row[cols[i]] = values[i]
      rows.push(row)
    }
    index++
  }
  return rows
}

async function one(sql: string, params: SqlValue[] = []): Promise<SqlRow | null> {
  const rows = await all(sql, params)
  return rows[0] ?? null
}

async function run(sql: string, params: SqlValue[] = []): Promise<void> {
  let index = 0
  for await (const stmt of api().statements(db(), sql)) {
    // Only bind params to the first statement in multi-statement SQL.
    // Subsequent statements must be parameterless; if they contain
    // placeholders, that's a programmer error and wa-sqlite will throw.
    if (index === 0 && params.length > 0) api().bind_collection(stmt, params)
    while ((await api().step(stmt)) === SQLite.SQLITE_ROW) {
      // discard rows
    }
    index++
  }
}

async function tx(ops: SqlOp[]): Promise<void> {
  await exec('BEGIN')
  try {
    for (const op of ops) await run(op.sql, op.params ?? [])
    await exec('COMMIT')
  } catch (err) {
    try { await exec('ROLLBACK') } catch { /* swallow — preserve original */ }
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
    // MAX, not LIMIT 1: builds before the single-row fix below appended a row
    // per migration, so a DB can hold both 1 and 2. The highest is current.
    const row = await one(`SELECT MAX(version) AS version FROM schema_version`)
    if (row && typeof row.version === 'number') current = row.version
  }

  if (current === SCHEMA_VERSION) return
  if (current > SCHEMA_VERSION) {
    // Throw the real class instance so String(err) produces
    // "SchemaVersionError: <message>" via the class's `name`. The main-thread
    // client unwraps this prefix and rehydrates a SchemaVersionError.
    throw new SchemaVersionError(
      `Database is v${current}; this build expects v${SCHEMA_VERSION}. ` +
      `Refresh or downgrade the app.`,
    )
  }

  // Migration SQL must contain only transactional statements. Do not include
  // VACUUM, ATTACH, or PRAGMAs that must run outside a transaction (e.g.
  // journal_mode) — they'll be silently ignored or throw inside BEGIN/COMMIT.
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    await exec('BEGIN')
    try {
      // Migration files contain multi-statement SQL. We iterate via the
      // `statements()` async iterator (run helper) rather than the legacy
      // `api().exec(db, sql)` path: on wa-sqlite-async + OriginPrivateFileSystemVFS
      // the legacy exec can leave the wasm in a bad state after the first
      // statement, so subsequent SELECTs against newly-created tables crash
      // with "memory access out of bounds". Iterating via statements() steps
      // each statement to completion under the async VFS contract.
      await run(m.sql)
      // `version` is the primary key, so INSERT OR REPLACE with a new version
      // appends rather than replaces. Clear first to keep the table single-row.
      await run(`DELETE FROM schema_version`)
      await run(
        `INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`,
        [m.version, new Date().toISOString()],
      )
      await exec('COMMIT')
    } catch (err) {
      try { await exec('ROLLBACK') } catch { /* swallow — preserve original */ }
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

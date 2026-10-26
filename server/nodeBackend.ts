import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { SqlBackend, SqlOp, SqlRow, SqlValue } from '../src/storage/sqlBackend'
import { DatabaseSync } from './sqlite'

const DB_FILENAME = 'couloir.db'
const PHOTOS_DIR = 'photos'

function isErrnoCode(err: unknown, code: string): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === code
}

// SqlBackend over node:sqlite plus plain files, all under one data directory:
//
//   {dataDir}/couloir.db        SQLite database (WAL mode)
//   {dataDir}/photos/{id}.jpg   full-size photos, and {id}_thumb.jpg thumbnails
//
// node:sqlite is synchronous; the methods are async because SqlBackend is.
export class NodeSqlBackend implements SqlBackend {
  private readonly root: string
  private db: DatabaseSync | null = null

  constructor(dataDir: string) {
    this.root = resolve(dataDir)
  }

  async init(): Promise<void> {
    if (this.db) return
    await mkdir(resolve(this.root, PHOTOS_DIR), { recursive: true })
    const db = new DatabaseSync(resolve(this.root, DB_FILENAME))
    // WAL lets the backup snapshot read while the app writes, and survives a
    // hard container stop better than the rollback journal. foreign_keys is
    // per-connection, so it's set here rather than in a migration. node:sqlite
    // already defaults it on; the PRAGMA states the requirement explicitly
    // (the entity_tags cascade on tag delete depends on it).
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec('PRAGMA busy_timeout = 5000')
    this.db = db
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db = null
  }

  async all(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
    return this.connection().prepare(sql).all(...params) as SqlRow[]
  }

  async one(sql: string, params: SqlValue[] = []): Promise<SqlRow | null> {
    return (this.connection().prepare(sql).get(...params) as SqlRow | undefined) ?? null
  }

  async run(sql: string, params: SqlValue[] = []): Promise<void> {
    // exec handles multi-statement SQL (migration files) but can't bind
    // parameters; prepare binds parameters but runs only one statement.
    if (params.length === 0) this.connection().exec(sql)
    else this.connection().prepare(sql).run(...params)
  }

  async tx(ops: SqlOp[]): Promise<void> {
    const db = this.connection()
    db.exec('BEGIN')
    try {
      for (const op of ops) await this.run(op.sql, op.params ?? [])
      db.exec('COMMIT')
    } catch (err) {
      try { db.exec('ROLLBACK') } catch { /* swallow — preserve original */ }
      throw err
    }
  }

  async writeBlob(path: string, data: ArrayBuffer): Promise<void> {
    const target = this.blobPath(path)
    await mkdir(dirname(target), { recursive: true })
    // Write then rename, so a crash mid-write never leaves a truncated photo
    // at the real path.
    const temp = `${target}.tmp`
    await writeFile(temp, new Uint8Array(data))
    await rename(temp, target)
  }

  async readBlob(path: string): Promise<ArrayBuffer | null> {
    try {
      const buf = await readFile(this.blobPath(path))
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    } catch (err) {
      if (isErrnoCode(err, 'ENOENT')) return null
      throw err
    }
  }

  async deleteBlob(path: string): Promise<void> {
    await rm(this.blobPath(path), { force: true })
  }

  private connection(): DatabaseSync {
    if (!this.db) throw new Error('NodeSqlBackend: not initialized')
    return this.db
  }

  // The HTTP layer validates ids before they reach a path; this is the
  // backstop that keeps every blob inside the data directory regardless.
  private blobPath(path: string): string {
    const full = resolve(this.root, path)
    if (!full.startsWith(this.root + sep)) {
      throw new Error(`blob path escapes the data directory: ${path}`)
    }
    return full
  }
}

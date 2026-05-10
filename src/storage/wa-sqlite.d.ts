// Minimal ambient module declarations for the wa-sqlite surface we use.
// We only declare what the worker actually calls; expand on demand.
//
// NOTE: wa-sqlite@1.0.0 (the only published npm version) does not include the
// `OPFSCoopSyncVFS` referenced in the original plan — that VFS lives only on
// the GitHub master branch in newer wa-sqlite revisions. Until a newer version
// is published, we use `OriginPrivateFileSystemVFS` (async) plus the async
// wasm factory `wa-sqlite-async.mjs`. The architectural properties we care
// about (worker-hosted, OPFS-backed, single-tab) are preserved.

declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  type Module = unknown
  type FactoryOptions = { locateFile?: (path: string) => string }
  const factory: (opts?: FactoryOptions) => Promise<Module>
  export default factory
}

declare module 'wa-sqlite' {
  export const SQLITE_ROW: number
  export const SQLITE_DONE: number
  export const SQLITE_OK: number

  type Pointer = number
  type SQLValue = string | number | bigint | Uint8Array | null

  interface Statement {
    readonly _stmt: Pointer
  }

  export interface SQLiteAPI {
    open_v2(filename: string): Promise<Pointer>
    close(db: Pointer): Promise<number>
    exec(
      db: Pointer,
      sql: string,
      callback?: (row: SQLValue[], columns: string[]) => void,
    ): Promise<number>
    statements(db: Pointer, sql: string): AsyncIterable<Statement>
    bind_collection(stmt: Statement, values: SQLValue[] | Record<string, SQLValue>): number
    step(stmt: Statement): Promise<number>
    reset(stmt: Statement): Promise<number>
    column_names(stmt: Statement): string[]
    row(stmt: Statement): SQLValue[]
    vfs_register(vfs: unknown, makeDefault?: boolean): number
  }

  export function Factory(module: unknown): SQLiteAPI
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
  export class OriginPrivateFileSystemVFS {
    constructor()
    readonly name: string
    close(): Promise<void>
    // handleAsync is the protocol shim wa-sqlite's VFS.Base provides for
    // routing async work through the wasm bridge. We declare it so subclass
    // overrides (TolerantOPFSVFS) can call it without a cast.
    handleAsync<T>(fn: () => Promise<T>): T | Promise<T>
    // xDelete and the other VFS callbacks return either a number (SQLITE
    // result code) or a Promise<number> when handleAsync defers — declare
    // only the methods we override.
    xDelete(name: string, syncDir: number): number | Promise<number>
  }
}

declare module 'wa-sqlite/dist/wa-sqlite-async.wasm?url' {
  const url: string
  export default url
}

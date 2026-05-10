// Minimal ambient module declarations for the wa-sqlite surface we use.
// We only declare what the worker actually calls; expand on demand.
//
// NOTE: wa-sqlite@1.0.0 (the only published npm version) does not include the
// `OPFSCoopSyncVFS` referenced in the original Phase 2 plan — that VFS lives
// only on the GitHub master branch. We use `AccessHandlePoolVFS` (the other
// OPFS VFS shipped in 1.0.0) paired with the regular (non-Asyncify) wasm
// factory `wa-sqlite.mjs`. AccessHandlePoolVFS uses synchronous OPFS sync
// access handles directly, avoiding the async-VFS-callback-into-wasm path
// that aborts SQLite during routine housekeeping (xDelete on stale
// journals, etc.). Architectural properties (worker-hosted, OPFS-backed,
// single-tab) are preserved.

declare module 'wa-sqlite/dist/wa-sqlite.mjs' {
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

declare module 'wa-sqlite/src/examples/AccessHandlePoolVFS.js' {
  export class AccessHandlePoolVFS {
    constructor(directoryPath: string)
    readonly name: string
    readonly isReady: Promise<void>
    close(): Promise<void>
  }
}

declare module 'wa-sqlite/dist/wa-sqlite.wasm?url' {
  const url: string
  export default url
}

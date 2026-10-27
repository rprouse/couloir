// The narrow surface SqlStorageProvider needs from a SQLite connection plus
// blob storage. server/nodeBackend.ts implements it over node:sqlite; keeping
// the seam lets the SQL be tested against fakes and stay backend-agnostic.

export type SqlValue = string | number | bigint | null | Uint8Array

export interface SqlOp {
  sql: string
  params?: SqlValue[]
}

export interface SqlRow {
  [column: string]: SqlValue
}

export interface SqlBackend {
  /** Open the connection. Schema migration is the provider's job, not the backend's. */
  init(): Promise<void>
  close(): Promise<void>
  all(sql: string, params?: SqlValue[]): Promise<SqlRow[]>
  one(sql: string, params?: SqlValue[]): Promise<SqlRow | null>
  /** Execute SQL and discard rows. Parameterless SQL may contain several statements. */
  run(sql: string, params?: SqlValue[]): Promise<void>
  /** Run every op inside one transaction; roll back and rethrow on the first failure. */
  tx(ops: SqlOp[]): Promise<void>
  writeBlob(path: string, data: ArrayBuffer): Promise<void>
  /** Null when the blob doesn't exist. */
  readBlob(path: string): Promise<ArrayBuffer | null>
  /** A missing blob is not an error. */
  deleteBlob(path: string): Promise<void>
}

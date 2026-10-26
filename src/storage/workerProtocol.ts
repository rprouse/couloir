// Wire protocol between the main-thread storage client and the OPFS worker.
// All requests carry a numeric `id`; the worker echoes it on the response so
// the client can match against an in-flight promise.

import type { SqlOp, SqlRow, SqlValue } from './sqlBackend'

export type { SqlOp, SqlRow, SqlValue }

export type Request =
  | { id: number; type: 'init' }
  | { id: number; type: 'close' }
  | { id: number; type: 'all'; sql: string; params?: SqlValue[] }
  | { id: number; type: 'one'; sql: string; params?: SqlValue[] }
  | { id: number; type: 'run'; sql: string; params?: SqlValue[] }
  | { id: number; type: 'tx'; ops: SqlOp[] }
  | { id: number; type: 'writeBlob'; path: string; data: ArrayBuffer }
  | { id: number; type: 'readBlob'; path: string }
  | { id: number; type: 'deleteBlob'; path: string }

export type Response =
  | { id: number; ok: true; result: SqlRow[] | SqlRow | null | ArrayBuffer | undefined }
  | { id: number; ok: false; error: string }

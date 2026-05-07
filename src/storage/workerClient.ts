import type {
  Request,
  Response,
  SqlOp,
  SqlRow,
  SqlValue,
} from './workerProtocol'

// Distributes `Omit` across a discriminated union so that variant-specific
// fields (`sql`, `ops`, `path`, ...) are preserved on each branch.
type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never

// One in-flight RPC per request id. The client posts a Request and resolves
// the corresponding promise when a Response with the matching id arrives.
export class WorkerClient {
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()

  constructor(private worker: Worker) {
    this.worker.addEventListener('message', this.onMessage)
  }

  private onMessage = (event: MessageEvent<Response>): void => {
    const msg = event.data
    const slot = this.pending.get(msg.id)
    if (!slot) return
    this.pending.delete(msg.id)
    if (msg.ok) slot.resolve(msg.result)
    else slot.reject(new Error(msg.error))
  }

  // `Request` is a discriminated union; `Omit<Request, 'id'>` collapses the
  // per-variant fields, so we use a distributive helper that preserves the
  // narrowing across each member of the union.
  private send<T>(
    req: DistributiveOmit<Request, 'id'>,
    transfer: Transferable[] = [],
  ): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      })
      this.worker.postMessage({ ...req, id } as Request, transfer)
    })
  }

  init(): Promise<void> {
    return this.send<void>({ type: 'init' })
  }

  close(): Promise<void> {
    return this.send<void>({ type: 'close' })
  }

  all(sql: string, params?: SqlValue[]): Promise<SqlRow[]> {
    return this.send<SqlRow[]>({ type: 'all', sql, params })
  }

  one(sql: string, params?: SqlValue[]): Promise<SqlRow | null> {
    return this.send<SqlRow | null>({ type: 'one', sql, params })
  }

  run(sql: string, params?: SqlValue[]): Promise<void> {
    return this.send<void>({ type: 'run', sql, params })
  }

  tx(ops: SqlOp[]): Promise<void> {
    return this.send<void>({ type: 'tx', ops })
  }

  writeBlob(path: string, data: ArrayBuffer): Promise<void> {
    // Transfer ownership of the buffer — we don't need it on the main thread
    // after the post.
    return this.send<void>({ type: 'writeBlob', path, data }, [data])
  }

  readBlob(path: string): Promise<ArrayBuffer | null> {
    return this.send<ArrayBuffer | null>({ type: 'readBlob', path })
  }

  deleteBlob(path: string): Promise<void> {
    return this.send<void>({ type: 'deleteBlob', path })
  }

  terminate(): void {
    this.worker.terminate()
  }
}

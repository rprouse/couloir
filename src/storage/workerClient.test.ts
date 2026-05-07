import { SchemaVersionError } from './errors'
import { WorkerClient } from './workerClient'

// Builds a fake Worker that echoes a single failure response to every
// postMessage. The protocol layer is exercised in isolation — no real
// wa-sqlite, no OPFS, no wasm module. We only care that the client's
// onMessage handler classifies the error string correctly.
function makeFakeWorker(error: string): Worker {
  const listeners: Record<string, ((e: MessageEvent | Event) => void) | undefined> = {}
  const fake = {
    addEventListener: (name: string, handler: (e: MessageEvent | Event) => void) => {
      listeners[name] = handler
    },
    removeEventListener: () => {},
    postMessage: (msg: { id: number }) => {
      // Microtask defer so the client has time to register the pending slot
      // before the response fires.
      queueMicrotask(() => {
        listeners.message?.(
          new MessageEvent('message', {
            data: { id: msg.id, ok: false, error },
          }),
        )
      })
    },
    terminate: () => {},
  }
  return fake as unknown as Worker
}

describe('WorkerClient — error rehydration', () => {
  it('rehydrates SchemaVersionError from the wire prefix', async () => {
    const fake = makeFakeWorker(
      'SchemaVersionError: Database is v2; this build expects v1.',
    )
    const client = new WorkerClient(fake)
    await expect(client.init()).rejects.toBeInstanceOf(SchemaVersionError)
  })

  it('preserves the unwrapped message on the rehydrated error', async () => {
    const fake = makeFakeWorker(
      'SchemaVersionError: Database is v2; this build expects v1.',
    )
    const client = new WorkerClient(fake)
    await expect(client.init()).rejects.toThrow(
      'Database is v2; this build expects v1.',
    )
  })

  it('rejects other errors as plain Error', async () => {
    const fake = makeFakeWorker('something else broke')
    const client = new WorkerClient(fake)
    await expect(client.init()).rejects.toThrow('something else broke')
    const fake2 = makeFakeWorker('something else broke')
    const client2 = new WorkerClient(fake2)
    await expect(client2.init()).rejects.not.toBeInstanceOf(SchemaVersionError)
  })
})

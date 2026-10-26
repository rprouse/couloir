import { SqlStorageProvider } from './sqlProvider'
import { WorkerClient } from './workerClient'
import StorageWorker from './workerHost?worker'

// Browser storage: SqlStorageProvider over wa-sqlite + OPFS, running in a
// dedicated worker that the WorkerClient talks to.
export class OPFSStorageProvider extends SqlStorageProvider {
  private worker: WorkerClient

  constructor() {
    const worker = new WorkerClient(new StorageWorker())
    super(worker)
    this.worker = worker
  }

  async close(): Promise<void> {
    if (this.closed) return
    await super.close()
    // Once terminated, further calls would hang forever waiting for replies;
    // the base class's closed flag stops them reaching the worker.
    this.worker.terminate()
  }
}

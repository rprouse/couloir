import { join } from 'node:path'
import type { Hono } from 'hono'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { createApp } from './app'
import { snapshotBytes } from './backups'
import { NodeSqlBackend } from './nodeBackend'

// Dev-server entry, loaded by devPlugin through ssrLoadModule. Editing server
// code re-evaluates this module, so the open database lives on globalThis:
// one connection to ./data for the life of the dev server, while the app
// itself is rebuilt on each request to pick up route changes. No scheduled
// backups in dev.
interface DevDatabase {
  backend: NodeSqlBackend
  storage: SqlStorageProvider
  dataDir: string
}

const globalStore = globalThis as typeof globalThis & {
  __couloirDevDatabase?: Promise<DevDatabase>
}

function devDatabase(): Promise<DevDatabase> {
  globalStore.__couloirDevDatabase ??= (async () => {
    const dataDir = process.env.DATA_DIR ?? './data'
    const backend = new NodeSqlBackend(dataDir)
    const storage = new SqlStorageProvider(backend)
    await storage.init()
    return { backend, storage, dataDir }
  })()
  return globalStore.__couloirDevDatabase
}

export async function createDevApp(): Promise<Hono> {
  const { backend, storage, dataDir } = await devDatabase()
  return createApp({
    storage,
    config: { maptilerKey: process.env.MAPTILER_KEY || null },
    databaseSnapshot: () => snapshotBytes(backend, join(dataDir, 'backups')),
  })
}

import type { Hono } from 'hono'
import type { StorageProvider } from '../src/storage/interface'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { createApp } from './app'
import { NodeSqlBackend } from './nodeBackend'

// Dev-server entry, loaded by devPlugin through ssrLoadModule. Editing server
// code re-evaluates this module, so the open database lives on globalThis:
// one connection to ./data for the life of the dev server, while the app
// itself is rebuilt on each request to pick up route changes.
const globalStore = globalThis as typeof globalThis & {
  __couloirDevStorage?: Promise<StorageProvider>
}

function devStorage(): Promise<StorageProvider> {
  globalStore.__couloirDevStorage ??= (async () => {
    const storage = new SqlStorageProvider(new NodeSqlBackend(process.env.DATA_DIR ?? './data'))
    await storage.init()
    return storage
  })()
  return globalStore.__couloirDevStorage
}

export async function createDevApp(): Promise<Hono> {
  return createApp({
    storage: await devStorage(),
    config: { maptilerKey: process.env.MAPTILER_KEY || null },
  })
}

import { serve } from '@hono/node-server'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { createApp } from './app'
import { NodeSqlBackend } from './nodeBackend'

// Minimal entry: API only. Static SPA serving, graceful shutdown and backups
// arrive in Tasks 8.5 and 8.7.
const port = Number(process.env.PORT ?? 8080)
const storage = new SqlStorageProvider(new NodeSqlBackend(process.env.DATA_DIR ?? './data'))
await storage.init()

const app = createApp({ storage, config: { maptilerKey: process.env.MAPTILER_KEY || null } })
serve({ fetch: app.fetch, port }, () => {
  process.stdout.write(`couloir listening on :${port}\n`)
})

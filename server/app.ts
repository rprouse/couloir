import { Hono } from 'hono'
import { SCHEMA_VERSION } from '../src/storage/migrations'

export function createApp(): Hono {
  const app = new Hono()
  app.get('/api/health', (c) => c.json({ ok: true, schemaVersion: SCHEMA_VERSION }))
  return app
}

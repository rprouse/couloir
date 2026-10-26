import { DatabaseSync } from './sqlite'
import { serve } from '@hono/node-server'
import { MIGRATIONS } from '../src/storage/migrations'
import { createApp } from './app'

// Spike entry (Task 8.0): proves node:sqlite, ?raw migrations and hono all
// survive the SSR bundle. Replaced by the real entry in Task 8.5.
const db = new DatabaseSync(':memory:')
db.exec(MIGRATIONS[0].sql)
const tables = db.prepare(`SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'`).get()

const port = Number(process.env.PORT ?? 8080)
serve({ fetch: createApp().fetch, port }, () => {
  process.stdout.write(`couloir spike on :${port}, tables=${JSON.stringify(tables)}\n`)
})

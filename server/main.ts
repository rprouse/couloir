import { serve } from '@hono/node-server'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { createApp } from './app'
import { scheduleBackups, snapshotBytes } from './backups'
import { logError } from './log'
import { NodeSqlBackend } from './nodeBackend'

// Production entry, bundled to dist-server/main.js. Serves the built SPA from
// dist/ (next to dist-server/) and the API, backed by DATA_DIR.
//
//   PORT          listen port (8080)
//   DATA_DIR      couloir.db + photos/ (./data)
//   STATIC_DIR    built SPA (../dist relative to this file)
//   MAPTILER_KEY  optional key served to browsers that have none
//   BACKUP_KEEP   daily database snapshots to keep in DATA_DIR/backups (14)

// How long in-flight requests get to finish on shutdown before the database
// is closed anyway. Docker's default stop grace period is 10 s.
const SHUTDOWN_GRACE_MS = 5000

const here = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT ?? 8080)
const dataDir = resolve(process.env.DATA_DIR ?? './data')
const staticDir = resolve(process.env.STATIC_DIR ?? resolve(here, '../dist'))
const maptilerKey = process.env.MAPTILER_KEY || null
const backupKeep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 14) || 14)
const backupDir = join(dataDir, 'backups')

const backend = new NodeSqlBackend(dataDir)
const storage = new SqlStorageProvider(backend)
await storage.init()

const stopBackups = scheduleBackups({ db: backend, dir: backupDir, keep: backupKeep })
const app = createApp({
  storage,
  config: { maptilerKey },
  staticDir,
  databaseSnapshot: () => snapshotBytes(backend, backupDir),
})
const server = serve({ fetch: app.fetch, port }, () => {
  process.stdout.write(
    `couloir listening on :${port} (data ${dataDir}, ` +
    `maptiler key ${maptilerKey ? 'from env' : 'not set'}, keeping ${backupKeep} daily backups)\n`,
  )
})

// Stop taking requests, let in-flight ones finish, then close the database so
// the WAL is checkpointed and `docker stop` never leaves it mid-write.
let stopping = false
function shutdown(signal: string): void {
  if (stopping) return
  stopping = true
  process.stdout.write(`couloir: ${signal}, shutting down\n`)
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    // Let a snapshot in progress finish before the database goes away.
    stopBackups().then(() => storage.close()).then(
      () => process.exit(0),
      (err: unknown) => {
        logError('closing the database', err)
        process.exit(1)
      },
    )
  }
  server.close(finish)
  // Keep-alive sockets would otherwise hold close() open until they time out.
  if ('closeIdleConnections' in server) server.closeIdleConnections()
  setTimeout(finish, SHUTDOWN_GRACE_MS).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

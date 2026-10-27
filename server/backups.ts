import { mkdir, readdir, readFile, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { logError } from './log'

// Daily database snapshots in {DATA_DIR}/backups. Photos aren't copied: they
// are immutable files already on the volume, covered by whatever backs up the
// volume (Unraid's appdata backup, say). The ZIP export in Settings is the
// all-in-one copy.

/** Anything that can write a consistent copy of its database to a new file. */
export interface Snapshotter {
  snapshotTo(targetPath: string): Promise<void>
}

const DAY_MS = 24 * 60 * 60 * 1000
const BACKUP_FILE = /^couloir-\d{8}\.db$/

/** couloir-YYYYMMDD.db, in UTC so the name doesn't depend on the container's zone. */
export function backupFileName(now: Date): string {
  return `couloir-${now.toISOString().slice(0, 10).replaceAll('-', '')}.db`
}

/**
 * Snapshot into `dir`, replacing today's file if there is one. Goes through a
 * temp file and a rename, so a failed snapshot never clobbers a good one.
 */
export async function snapshot(db: Snapshotter, dir: string, now: Date): Promise<string> {
  await mkdir(dir, { recursive: true })
  const target = join(dir, backupFileName(now))
  const temp = `${target}.tmp`
  await rm(temp, { force: true })
  await db.snapshotTo(temp)
  await rename(temp, target)
  return target
}

/** Delete all but the newest `keep` snapshots in `dir`. Returns the names removed. */
export async function prune(dir: string, keep: number): Promise<string[]> {
  const names = (await readdir(dir)).filter((name) => BACKUP_FILE.test(name))
  // The date is in the name, so name order is age order.
  const stale = names.sort().reverse().slice(Math.max(keep, 1))
  for (const name of stale) await rm(join(dir, name), { force: true })
  return stale
}

/** Snapshot to a temp file in `dir`, read it, and remove it. For download. */
export async function snapshotBytes(db: Snapshotter, dir: string): Promise<Uint8Array> {
  await mkdir(dir, { recursive: true })
  const temp = join(dir, `.download-${process.pid}-${Date.now()}.db`)
  try {
    await db.snapshotTo(temp)
    return await readFile(temp)
  } finally {
    await rm(temp, { force: true })
  }
}

/**
 * Snapshot and prune now, then every 24 hours. Failures are logged and the
 * schedule carries on. Returns a stop function that resolves once any run in
 * progress has finished, so the database can be closed safely after it.
 */
export function scheduleBackups(opts: {
  db: Snapshotter
  dir: string
  keep: number
  intervalMs?: number
  now?: () => Date
}): () => Promise<void> {
  const now = opts.now ?? (() => new Date())
  let inFlight: Promise<void> | null = null
  const backup = async () => {
    try {
      const file = await snapshot(opts.db, opts.dir, now())
      const removed = await prune(opts.dir, opts.keep)
      process.stdout.write(
        `couloir: backup ${file}${removed.length ? `, pruned ${removed.join(', ')}` : ''}\n`,
      )
    } catch (err) {
      logError('scheduled backup', err)
    }
  }
  // A tick that arrives while a snapshot is still running is skipped, not
  // queued: runs never overlap, and a slow disk can't build up a backlog.
  const run = () => {
    if (inFlight) return
    inFlight = backup().finally(() => {
      inFlight = null
    })
  }
  run()
  const timer = setInterval(run, opts.intervalMs ?? DAY_MS)
  // Never keep the process alive just for backups.
  timer.unref()
  return async () => {
    clearInterval(timer)
    await inFlight
  }
}

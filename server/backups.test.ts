// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildRoute } from '../src/storage/contract'
import { SqlStorageProvider } from '../src/storage/sqlProvider'
import { backupFileName, prune, scheduleBackups, snapshot, snapshotBytes } from './backups'
import { NodeSqlBackend } from './nodeBackend'
import { DatabaseSync } from './sqlite'

let dataDir: string
let backupDir: string
let backend: NodeSqlBackend
let storage: SqlStorageProvider

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'couloir-backup-'))
  backupDir = join(dataDir, 'backups')
  backend = new NodeSqlBackend(dataDir)
  storage = new SqlStorageProvider(backend)
  await storage.init()
  await storage.saveRoute(buildRoute({ name: 'Snapshot me' }))
})

afterEach(async () => {
  await storage.close()
  await rm(dataDir, { recursive: true, force: true })
})

// Open a snapshot file on its own and read the routes back.
function routeNamesIn(file: string): string[] {
  const db = new DatabaseSync(file)
  try {
    return (db.prepare('SELECT name FROM routes').all() as { name: string }[]).map((r) => r.name)
  } finally {
    db.close()
  }
}

describe('backupFileName', () => {
  it('names snapshots by UTC date', () => {
    expect(backupFileName(new Date('2026-10-26T23:30:00-07:00'))).toBe('couloir-20261027.db')
  })
})

describe('snapshot', () => {
  it('writes a self-contained copy that opens and holds the data', async () => {
    const file = await snapshot(backend, backupDir, new Date('2026-10-26T12:00:00Z'))
    expect(file).toBe(join(backupDir, 'couloir-20261026.db'))
    expect(routeNamesIn(file)).toEqual(['Snapshot me'])
  })

  it('replaces the same day\'s snapshot and leaves no temp file', async () => {
    const day = new Date('2026-10-26T08:00:00Z')
    await snapshot(backend, backupDir, day)
    await storage.saveRoute(buildRoute({ name: 'Renamed later that day' }))
    const file = await snapshot(backend, backupDir, new Date('2026-10-26T20:00:00Z'))
    expect(routeNamesIn(file)).toEqual(['Renamed later that day'])
    expect(await readdir(backupDir)).toEqual(['couloir-20261026.db'])
  })

  it('works while the app keeps writing', async () => {
    const writes = Promise.all(
      Array.from({ length: 20 }, (_, i) => storage.saveRoute(buildRoute({ id: `r${i}`, source_hash: `h${i}` }))),
    )
    const file = await snapshot(backend, backupDir, new Date('2026-10-26T12:00:00Z'))
    await writes
    expect(routeNamesIn(file).length).toBeGreaterThanOrEqual(1)
  })
})

describe('prune', () => {
  it('keeps the newest N snapshots and ignores other files', async () => {
    await snapshot(backend, backupDir, new Date('2026-10-20T00:00:00Z'))
    for (const day of ['20261021', '20261022', '20261023']) {
      await writeFile(join(backupDir, `couloir-${day}.db`), '')
    }
    await writeFile(join(backupDir, 'notes.txt'), 'keep me')

    expect(await prune(backupDir, 2)).toEqual(['couloir-20261021.db', 'couloir-20261020.db'])
    expect((await readdir(backupDir)).sort()).toEqual(['couloir-20261022.db', 'couloir-20261023.db', 'notes.txt'])
  })

  it('always keeps at least the newest snapshot', async () => {
    await snapshot(backend, backupDir, new Date('2026-10-26T00:00:00Z'))
    expect(await prune(backupDir, 0)).toEqual([])
  })
})

describe('snapshotBytes', () => {
  it('returns a database image and cleans up its temp file', async () => {
    const bytes = await snapshotBytes(backend, backupDir)
    expect(new TextDecoder().decode(bytes.subarray(0, 15))).toBe('SQLite format 3')
    expect(await readdir(backupDir)).toEqual([])
  })
})

describe('scheduleBackups', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Generous: CI runners and containers snapshot far slower than a dev box.
  const WAIT = { timeout: 10_000 }

  it('snapshots and prunes immediately, then on each interval', async () => {
    let day = 1
    const stop = scheduleBackups({
      db: backend,
      dir: backupDir,
      keep: 2,
      intervalMs: 20,
      now: () => new Date(Date.UTC(2026, 9, day++)),
    })
    try {
      // At least four runs have started (days 1-4).
      await vi.waitFor(() => expect(day).toBeGreaterThan(4), WAIT)
    } finally {
      await stop()
    }
    // Counted after stop(): mid-run there can briefly be keep + 1 files.
    const names = (await readdir(backupDir)).sort()
    expect(names).toHaveLength(2)
    expect(names.every((n) => /^couloir-202610\d\d\.db$/.test(n))).toBe(true)
  })

  it('skips ticks while a snapshot is still running instead of queueing them', async () => {
    // The fake writes no file, so each run's rename fails and is logged.
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    let active = 0
    let maxActive = 0
    let calls = 0
    let release: () => void = () => {}
    const slow = {
      snapshotTo: async () => {
        calls++
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise<void>((resolve) => { release = resolve })
        active--
      },
    }
    const stop = scheduleBackups({ db: slow, dir: backupDir, keep: 2, intervalMs: 5 })
    try {
      // Let many ticks pass while the first snapshot is held open.
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(calls).toBe(1)
      release()
      await vi.waitFor(() => expect(calls).toBe(2), WAIT)
      release()
    } finally {
      const stopped = stop()
      release()
      await stopped
    }
    expect(maxActive).toBe(1)
  })

  it('logs a failed snapshot and keeps going', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const failing = { snapshotTo: () => Promise.reject(new Error('disk full')) }
    const stop = scheduleBackups({ db: failing, dir: backupDir, keep: 2, intervalMs: 20 })
    try {
      await vi.waitFor(() => expect(stderr.mock.calls.length).toBeGreaterThanOrEqual(2), WAIT)
    } finally {
      await stop()
    }
    expect(String(stderr.mock.calls[0][0])).toMatch(/scheduled backup: .*disk full/)
  })
})

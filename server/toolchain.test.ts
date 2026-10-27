// @vitest-environment node
import { DatabaseSync } from './sqlite'
import { MIGRATIONS } from '../src/storage/migrations'
import { InMemoryStorageProvider } from '../src/storage/memory'
import { createApp } from './app'

describe('server toolchain', () => {
  it('runs the shared migrations and round-trips a row', () => {
    const db = new DatabaseSync(':memory:')
    for (const m of MIGRATIONS) db.exec(m.sql)
    db.prepare(`INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`)
      .run('t1', 'Couloir', '#fff', '2026-10-26T00:00:00.000Z')
    const row = db.prepare(`SELECT id, name FROM tags`).get()
    expect(row).toEqual({ id: 't1', name: 'Couloir' })
    const count = db.prepare(`SELECT count(*) AS n FROM tags`).get() as { n: unknown }
    expect(typeof count.n).toBe('number')
  })

  it('serves /api/health through hono', async () => {
    const res = await createApp({
      storage: new InMemoryStorageProvider(),
      config: { maptilerKey: null },
    }).request('/api/health')
    expect(await res.json()).toEqual({ ok: true, schemaVersion: MIGRATIONS.length })
  })
})

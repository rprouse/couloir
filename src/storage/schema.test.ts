import { SchemaVersionError } from './errors'
import { MIGRATIONS, SCHEMA_VERSION } from './migrations'
import { ensureSchema } from './schema'
import type { SqlRow, SqlValue } from './sqlBackend'

// Records every statement ensureSchema issues and answers its two probes
// (does schema_version exist? what version is it?) from `version`.
function fakeDb(version: number | null, failOn?: (sql: string) => boolean) {
  const statements: string[] = []
  return {
    statements,
    async one(sql: string): Promise<SqlRow | null> {
      if (sql.includes('sqlite_master')) return version === null ? null : { name: 'schema_version' }
      if (sql.includes('MAX(version)')) return { version }
      throw new Error(`unexpected query: ${sql}`)
    },
    async run(sql: string, _params?: SqlValue[]): Promise<void> {
      statements.push(sql)
      if (failOn?.(sql)) throw new Error('migration failed')
    },
  }
}

describe('ensureSchema', () => {
  it('runs every migration on a fresh database, each in its own transaction', async () => {
    const db = fakeDb(null)
    await ensureSchema(db)
    for (const m of MIGRATIONS) expect(db.statements).toContain(m.sql)
    expect(db.statements.filter((s) => s === 'BEGIN')).toHaveLength(MIGRATIONS.length)
    expect(db.statements.filter((s) => s === 'COMMIT')).toHaveLength(MIGRATIONS.length)
  })

  it('runs only the migrations after the current version', async () => {
    const db = fakeDb(1)
    await ensureSchema(db)
    expect(db.statements).not.toContain(MIGRATIONS[0].sql)
    expect(db.statements).toContain(MIGRATIONS[1].sql)
  })

  it('does nothing when the database is current', async () => {
    const db = fakeDb(SCHEMA_VERSION)
    await ensureSchema(db)
    expect(db.statements).toEqual([])
  })

  it('throws SchemaVersionError when the database is newer than the build', async () => {
    const db = fakeDb(SCHEMA_VERSION + 1)
    await expect(ensureSchema(db)).rejects.toBeInstanceOf(SchemaVersionError)
    expect(db.statements).toEqual([])
  })

  it('rolls back and rethrows when a migration fails', async () => {
    const db = fakeDb(null, (sql) => sql === MIGRATIONS[0].sql)
    await expect(ensureSchema(db)).rejects.toThrow('migration failed')
    expect(db.statements).toContain('ROLLBACK')
    expect(db.statements).not.toContain('COMMIT')
  })
})

import { SchemaVersionError } from './errors'
import { MIGRATIONS, SCHEMA_VERSION } from './migrations'
import type { SqlBackend } from './sqlBackend'

/**
 * Bring the database up to SCHEMA_VERSION, applying each pending migration in
 * its own transaction. Throws SchemaVersionError if the database is newer than
 * this build: an older build must never operate on a newer schema.
 */
export async function ensureSchema(db: Pick<SqlBackend, 'one' | 'run'>): Promise<void> {
  // schema_version table may not exist yet on a fresh DB; check via sqlite_master.
  const meta = await db.one(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`,
  )
  let current = 0
  if (meta) {
    // MAX, not LIMIT 1: builds before the single-row fix below appended a row
    // per migration, so a DB can hold both 1 and 2. The highest is current.
    const row = await db.one(`SELECT MAX(version) AS version FROM schema_version`)
    if (row && typeof row.version === 'number') current = row.version
  }

  if (current === SCHEMA_VERSION) return
  if (current > SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `Database is v${current}; this build expects v${SCHEMA_VERSION}. ` +
      `Refresh or downgrade the app.`,
    )
  }

  // Migration SQL must contain only transactional statements. Do not include
  // VACUUM, ATTACH, or PRAGMAs that must run outside a transaction (e.g.
  // journal_mode) — they'll be silently ignored or throw inside BEGIN/COMMIT.
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    await db.run('BEGIN')
    try {
      await db.run(m.sql)
      // `version` is the primary key, so INSERT OR REPLACE with a new version
      // appends rather than replaces. Clear first to keep the table single-row.
      await db.run(`DELETE FROM schema_version`)
      await db.run(
        `INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`,
        [m.version, new Date().toISOString()],
      )
      await db.run('COMMIT')
    } catch (err) {
      try { await db.run('ROLLBACK') } catch { /* swallow — preserve original */ }
      throw err
    }
  }
}

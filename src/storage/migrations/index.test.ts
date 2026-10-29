import { MIGRATIONS, SCHEMA_VERSION } from './index'

describe('MIGRATIONS', () => {
  it('is contiguous from 1 and ends at SCHEMA_VERSION', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(
      Array.from({ length: SCHEMA_VERSION }, (_, i) => i + 1),
    )
  })

  it('migration 2 moves camera_* into lat/lng/elevation_m and drops the columns', () => {
    const sql = MIGRATIONS.find((m) => m.version === 2)?.sql ?? ''
    expect(sql).toMatch(/SET\s+lat\s*=\s*camera_lat/i)
    for (const col of ['camera_lat', 'camera_lng', 'camera_elevation_m']) {
      expect(sql).toMatch(new RegExp(`DROP COLUMN ${col}\\b`, 'i'))
    }
  })

  it('migration 3 adds the nullable waypoint icon column', () => {
    const sql = MIGRATIONS.find((m) => m.version === 3)?.sql ?? ''
    expect(sql).toMatch(/ALTER TABLE waypoints ADD COLUMN icon TEXT\s*;/i)
  })
})

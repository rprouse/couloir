# Couloir - Data Model

## TypeScript Types

These are the canonical types used throughout the application. The SQLite schema below is derived from these types.

```typescript
// src/types/index.ts

export type EntityType = 'route' | 'track' | 'waypoint' | 'photo'

export type ATES = 'simple' | 'challenging' | 'complex' | 'extreme'

export type TechnicalDifficulty = 'easy' | 'moderate' | 'hard' | 'expert'

export type WaypointCategory =
  | 'entry_gate'
  | 'cliff_band'
  | 'rollover'
  | 'hazard'
  | 'skin_track'
  | 'cache'
  | 'summit'
  | 'poi'
  | 'other'

export interface Tag {
  id: string           // uuid
  name: string
  color: string        // hex color string '#RRGGBB'
  created_at: string   // ISO 8601
}

export interface Route {
  id: string           // uuid
  user_id: string      // 'local' until there are multiple users
  name: string
  description: string
  geojson: GeoJSON.LineString  // parsed from GPX, stored as JSON string in DB
  source_hash: string  // SHA-256 of the imported GPX bytes (for dedup detection)
  source_filename: string | null  // original filename, display only
  color: string        // hex color for map rendering
  ates: ATES | null                      // Avalanche Terrain Exposure Scale
  technical_difficulty: TechnicalDifficulty | null
  distance_m: number   // metres, derived from geometry
  elevation_gain_m: number
  elevation_loss_m: number
  tags: string[]       // array of tag ids; hydrated from entity_tags by storage layer
  created_at: string   // ISO 8601, set by app via new Date().toISOString()
  updated_at: string   // ISO 8601, set by app on every save
}

export interface Track {
  id: string
  user_id: string
  name: string
  description: string
  geojson: GeoJSON.LineString
  source_hash: string
  source_filename: string | null
  color: string
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  duration_s: number | null      // total elapsed time: last_ts - first_ts
  moving_time_s: number | null   // sum of inter-point dt where speed >= MOVING_SPEED_THRESHOLD_M_S
  recorded_at: string | null     // ISO 8601, from first GPX timestamp
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Waypoint {
  id: string
  user_id: string
  name: string
  description: string
  lat: number
  lng: number
  elevation_m: number | null
  category: WaypointCategory
  color: string | null  // overrides category default if set
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  user_id: string
  name: string
  description: string

  // Where the photo was taken. Seeded from EXIF GPS when present, otherwise
  // placed by the user; draggable while the photo is being created or edited.
  lat: number
  lng: number
  elevation_m: number | null            // EXIF GPSAltitude, else terrain lookup
  bearing: number | null                // 0-359, compass direction the camera faced

  blob_ref: string                      // 'photos/{id}.jpg'
  width: number
  height: number
  file_size_bytes: number
  taken_at: string | null

  tags: string[]
  created_at: string
  updated_at: string
}

// Fields a photo edit may change. File metadata (blob_ref, dimensions, size)
// is fixed at import.
export type PhotoMetadataPatch = Partial<Pick<
  Photo,
  'name' | 'description' | 'lat' | 'lng' | 'elevation_m' | 'bearing' | 'taken_at' | 'tags'
>>

// Backup bundle — written as `metadata.json` inside the ZIP archive
export interface ExportBundle {
  bundle_version: number     // start at 1; increment for breaking format changes
  app_version: string        // for diagnostics
  exported_at: string        // ISO 8601
  routes: Route[]
  tracks: Track[]
  waypoints: Waypoint[]
  photos: Photo[]            // metadata only; blobs live alongside in `photos/{id}.jpg`
  tags: Tag[]
  entity_tags: EntityTagRow[] // serialised junction rows
}

export interface EntityTagRow {
  entity_type: EntityType
  entity_id: string
  tag_id: string
}

// Manifest — written as `manifest.json` at the root of the ZIP archive
export interface BackupManifest {
  bundle_version: number
  app_version: string
  exported_at: string
  photo_count: number
  total_size_bytes: number
}
```

---

## SQLite Schema

```sql
-- src/storage/migrations/1.sql
-- Keep types portable (plain TEXT/REAL/INTEGER) so moving to another
-- SQL engine later stays cheap.

-- Note: PRAGMAs are intentionally NOT in this migration.
-- `PRAGMA foreign_keys = ON` is connection-scoped, so we run it from
-- NodeSqlBackend.init() (server/nodeBackend.ts) on every open, along with
-- journal_mode = WAL and busy_timeout, rather than once during migration.

CREATE TABLE schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#888888',
  created_at  TEXT NOT NULL          -- set by app, ISO 8601
);

CREATE TABLE routes (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL DEFAULT 'local',
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  geojson               TEXT NOT NULL,        -- JSON string of GeoJSON LineString
  source_hash           TEXT NOT NULL,        -- SHA-256 of imported GPX bytes
  source_filename       TEXT,
  color                 TEXT NOT NULL DEFAULT '#E05C2A',
  ates                  TEXT,                 -- simple | challenging | complex | extreme
  technical_difficulty  TEXT,                 -- easy | moderate | hard | expert
  distance_m            REAL NOT NULL DEFAULT 0,
  elevation_gain_m      REAL NOT NULL DEFAULT 0,
  elevation_loss_m      REAL NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE tracks (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL DEFAULT 'local',
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  geojson           TEXT NOT NULL,
  source_hash       TEXT NOT NULL,
  source_filename   TEXT,
  color             TEXT NOT NULL DEFAULT '#2A7BE0',
  distance_m        REAL NOT NULL DEFAULT 0,
  elevation_gain_m  REAL NOT NULL DEFAULT 0,
  elevation_loss_m  REAL NOT NULL DEFAULT 0,
  duration_s        REAL,                     -- nullable: GPX may have no timestamps
  moving_time_s     REAL,                     -- nullable: same condition
  recorded_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE waypoints (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL DEFAULT 'local',
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  elevation_m   REAL,
  category      TEXT NOT NULL DEFAULT 'poi',
  color         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE photos (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL DEFAULT 'local',
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',

  -- Where the photo was taken
  lat                 REAL NOT NULL,
  lng                 REAL NOT NULL,
  elevation_m         REAL,
  bearing             REAL,                   -- 0-359 degrees

  blob_ref            TEXT NOT NULL,          -- path under DATA_DIR, e.g. photos/{id}.jpg
  width               INTEGER NOT NULL,
  height              INTEGER NOT NULL,
  file_size_bytes     INTEGER NOT NULL,
  taken_at            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- Tags are stored in a single junction table for all four entity types.
-- ON DELETE CASCADE on tag_id removes references automatically when a tag is deleted.
CREATE TABLE entity_tags (
  entity_type  TEXT NOT NULL,                 -- 'route' | 'track' | 'waypoint' | 'photo'
  entity_id    TEXT NOT NULL,
  tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_type, entity_id, tag_id)
);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
```

**Notes**:

- No `photo_routes` or `photo_tracks` tables. Photos relate to routes and tracks visually, by spatial proximity on the map; there are no explicit links.
- No `idx_waypoints_lat_lng` or `idx_photos_lat_lng` indexes. The current read pattern is "load all rows" and B-tree indexes on independent dimensions don't accelerate spatial queries. Re-introduce an `rtree` virtual table if viewport-based filtering is added later.
- All timestamps are ISO 8601 strings, set by the app via `new Date().toISOString()` at insert and update time. There are no SQL `DEFAULT (datetime('now'))` defaults — a row inserted without explicit timestamps is a bug, not a fallback case.
- `entity_tags` has a foreign key on `tag_id` (cleaned up automatically when a tag is deleted) but **no foreign key on `entity_id`** — it would have to span four tables. The storage layer is responsible for deleting matching `entity_tags` rows when an entity is deleted: each of `deleteRoute`/`deleteTrack`/`deleteWaypoint`/`deletePhoto` runs `DELETE FROM entity_tags WHERE entity_type = ? AND entity_id = ?` in the same transaction as the entity row delete.

---

## Default Values and Constants

```typescript
// src/types/index.ts (or a constants file)

// Default colors per entity type
export const DEFAULTS = {
  route: { color: '#E05C2A' },   // burnt orange
  track: { color: '#2A7BE0' },   // sky blue
}

// Default color and icon per waypoint category
export const WAYPOINT_CATEGORIES: Record<WaypointCategory, {
  label: string
  color: string
  icon: string   // icon identifier for map symbol
}> = {
  entry_gate:  { label: 'Entry Gate',        color: '#22C55E', icon: 'gate' },
  cliff_band:  { label: 'Cliff Band',        color: '#EF4444', icon: 'warning' },
  rollover:    { label: 'Rollover',          color: '#F59E0B', icon: 'arrow-down' },
  hazard:      { label: 'Hazard',            color: '#EF4444', icon: 'hazard' },
  skin_track:  { label: 'Skin Track',        color: '#A78BFA', icon: 'track' },
  cache:       { label: 'Cache',             color: '#60A5FA', icon: 'cache' },
  summit:      { label: 'Summit',            color: '#FBBF24', icon: 'summit' },
  poi:         { label: 'Point of Interest', color: '#94A3B8', icon: 'poi' },
  other:       { label: 'Other',             color: '#94A3B8', icon: 'pin' },
}

// ATES (Avalanche Terrain Exposure Scale) display labels
export const ATES_LABELS: Record<ATES, string> = {
  simple:      'Simple (Class 1)',
  challenging: 'Challenging (Class 2)',
  complex:     'Complex (Class 3)',
  extreme:     'Extreme (Class 4)',
}

// Technical difficulty display labels
export const TECHNICAL_DIFFICULTY_LABELS: Record<TechnicalDifficulty, string> = {
  easy:     'Easy',
  moderate: 'Moderate',
  hard:     'Hard',
  expert:   'Expert',
}

// Movement-speed threshold for moving-time computation.
// 0.14 m/s ≈ 0.5 km/h. Anything slower is treated as "stopped" (transition,
// rest, eating). Tuned for backcountry skinning, where uphill skinning at
// ~1.5 km/h is "moving". The only fudge factor in the system; revisit if
// recorded tracks consistently show surprising moving-time values.
export const MOVING_SPEED_THRESHOLD_M_S = 0.14

// Map settings defaults
export const MAP_DEFAULTS = {
  center: [-115.063, 49.504] as [number, number],  // Fernie, BC
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  basemap: 'outdoor' as Basemap,
}

export type Basemap = 'satellite' | 'outdoor' | 'winter'

// Photo clustering defaults (used by the MapLibre photos source)
export const PHOTO_CLUSTER = {
  clusterMaxZoom: 13,
  clusterRadius: 50,
}

// Photo re-encoding (src/utils/image.ts). The full-size cap keeps a 24 MP
// phone photo around 2-3 MB on the server while leaving plenty of zoom detail.
export const PHOTO_MAX_EDGE_PX = 4096
export const PHOTO_THUMB_EDGE_PX = 128
export const PHOTO_JPEG_QUALITY = 0.9
```

---

## GeoJSON Structures

Routes and tracks are stored as GeoJSON with elevation in the Z coordinate:

```json
{
  "type": "LineString",
  "coordinates": [
    [-116.123, 49.456, 1820.5],
    [-116.124, 49.457, 1835.2]
  ]
}
```

The elevation profile is derived from the Z coordinates at render time — no separate elevation array is stored.

**Multi-segment GPX tracks**: trackpoints from all `<trkseg>` elements are concatenated into a single `LineString` for storage and rendering. `duration_s` and `moving_time_s` are computed across all trackpoints.

Waypoints and photos are rendered from individual coordinate fields (`lat`, `lng`) rather than GeoJSON, assembled into a GeoJSON `FeatureCollection` by the layer components at render time. Photos are clustered at their position (see `PHOTO_CLUSTER` constants).

---

## ID Generation

All entity IDs are UUIDs generated client-side by `newId()` (`src/utils/id.ts`): `crypto.randomUUID()` where available, otherwise a v4 UUID built from `crypto.getRandomValues` (plain-HTTP origins lack `randomUUID`). The server never assigns IDs; it validates them (`^[A-Za-z0-9_-]{1,64}$`) because they become photo file names. Client-side UUIDs also keep IDs globally unique if offline sync is ever added.

---

## Tag Storage and Hydration

Tags are stored in the `entity_tags` junction table. The TypeScript types still expose `tags: string[]` on each entity for convenience; the storage layer hydrates this array on read and writes through to the junction table on save.

When a tag is deleted, `ON DELETE CASCADE` automatically removes every junction row referencing it. No application-level cleanup is required.

Reverse queries ("all entities that have tag X") use the index on `entity_tags(tag_id)`.

---

## Schema Versioning

```sql
CREATE TABLE schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
```

Single-row table. `ensureSchema` (`src/storage/schema.ts`), run by the server's `SqlStorageProvider.init()`, reads the current version on startup, compares to a `SCHEMA_VERSION` constant in code, and applies any pending migrations from `src/storage/migrations/{n}.sql` in numeric order. Each migration is wrapped in a transaction.

If the DB version is **greater** than the build's `SCHEMA_VERSION`, the server throws `SchemaVersionError` and refuses to start: an older build must not silently operate on a newer database. The browser makes the same check against `/api/health` and asks for a reload.

Initial schema is migration `1.sql`. Future schema changes are numbered sequentially.

Migration `2.sql` (Phase 5) collapses the photo subject/camera split into a single position: rows with `camera_lat`/`camera_lng` adopt them as `lat`/`lng` (and `camera_elevation_m` as `elevation_m`), then the three `camera_*` columns are dropped.

---

## Deferred schema changes

Intentionally *not* added now; each is a small migration when its feature arrives (see ARCHITECTURE.md, "Deferred items"):

- **Multiple users:** nothing to add. `user_id` already exists on every entity table; the server would start filtering by it.
- **Offline sync:** `deleted_at TEXT` on every entity table, with all read paths gaining `WHERE deleted_at IS NULL`, plus whatever per-device sync state the chosen approach needs.

Only the cheapest, no-runtime-cost preparation has been done (`user_id`, client-generated UUIDs, ISO 8601 timestamps).

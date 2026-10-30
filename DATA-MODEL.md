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
  color: string | null       // overrides the category colour if set
  icon: WaypointIcon | null  // Material Symbol name; overrides the category icon if set
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

// ATES terrain ratings (Phase 12), imported from Avalanche Canada KMZ files.
// One AtesArea per downloaded area. Not tagged, not searchable.
export type AtesClass = 'non_avalanche' | ATES   // zones can also be Class 0
export const ATES_CLASS_LABELS: Record<AtesClass, string>   // 'Non-avalanche (Class 0)' + ATES_LABELS

export type LngLat = [number, number]            // 2D: ATES has no elevation

export interface AtesPolygon { type: 'Polygon'; coordinates: LngLat[][] }  // outer ring, then holes
export interface AtesLineString { type: 'LineString'; coordinates: LngLat[] }
export interface AtesPoint { type: 'Point'; coordinates: LngLat }

// Feature<G, P> = { type: 'Feature'; geometry: G; properties: P }
export type AtesFeature =
  | Feature<AtesPolygon, { kind: 'zone'; ates: AtesClass; description: string }>  // description = the ATES class definition
  | Feature<AtesLineString, { kind: 'ates_line'; ates: AtesClass; name: string }>
  | Feature<AtesPolygon, { kind: 'area' }>                                     // the area boundary
  | Feature<AtesLineString, { kind: 'avalanche_path'; name: string }>
  | Feature<AtesPoint, { kind: 'decision_point'; name: string; description: string }>
  | Feature<AtesLineString, { kind: 'access_route'; name: string; description: string }>
  | Feature<AtesPoint, { kind: 'poi'; poi: AtesPoiType; name: string; description: string }>

// From point_of_interest_{type}_styles; unknown types become 'other'.
type AtesPoiType = 'parking' | 'cabin' | 'destination' | 'other'

export interface AtesArea {
  id: string
  name: string               // the KML Document name, e.g. 'Tunnel Creek South'
  source_filename: string
  geojson: { type: 'FeatureCollection'; features: AtesFeature[] }
  imported_at: string        // first import; kept when the area is re-imported
  updated_at: string
}

// Backup bundle — written as `metadata.json` inside the ZIP archive
export interface ExportBundle {
  bundle_version: number     // BUNDLE_VERSION (2); increment for breaking format changes
  app_version: string        // for diagnostics
  exported_at: string        // ISO 8601
  routes: Route[]
  tracks: Track[]
  waypoints: Waypoint[]
  photos: Photo[]            // metadata only; blobs live alongside in `photos/{id}.jpg`
  tags: Tag[]
  entity_tags: EntityTagRow[] // serialised junction rows
  ates_areas?: AtesArea[]    // bundle v2; absent from v1 bundles, which restore with no areas
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
  icon          TEXT,                        -- added by migration 3
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

-- src/storage/migrations/4.sql (Phase 12)
-- ATES terrain ratings, one row per imported area. geojson is the
-- AtesArea FeatureCollection. Not tagged.
CREATE TABLE ates_areas (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  geojson         TEXT NOT NULL,
  imported_at     TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
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
  route: { color: '#2A7BE0' },   // sky blue
  track: { color: '#E05C2A' },   // burnt orange
}

// Default color and icon per waypoint category. A waypoint's own `icon` and
// `color` override these; null means "use the category's".
export const WAYPOINT_CATEGORIES: Record<WaypointCategory, {
  label: string
  color: string
  icon: WaypointIcon   // Material Symbol name from the catalogue in src/icons/waypointIcons.ts
}> = {
  entry_gate:  { label: 'Entry Gate',        color: '#22C55E', icon: 'fence' },
  cliff_band:  { label: 'Cliff Band',        color: '#EF4444', icon: 'landslide' },
  rollover:    { label: 'Rollover',          color: '#F59E0B', icon: 'arrow_downward' },
  hazard:      { label: 'Hazard',            color: '#EF4444', icon: 'warning' },
  skin_track:  { label: 'Skin Track',        color: '#A78BFA', icon: 'route' },
  cache:       { label: 'Cache',             color: '#60A5FA', icon: 'backpack' },
  summit:      { label: 'Summit',            color: '#FBBF24', icon: 'landscape' },
  poi:         { label: 'Point of Interest', color: '#94A3B8', icon: 'star' },
  other:       { label: 'Other',             color: '#94A3B8', icon: 'location_on' },
}

// WaypointIcon (src/icons/waypointIcons.ts) is the union of the ~29 curated
// Material Symbol names in WAYPOINT_ICONS: skiing, ski touring, parking,
// camp, cabin, hut, summit, warning, … grouped Travel / Shelter / Terrain /
// Safety / General for the picker. Unknown names read back as null.

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

ATES areas store a `FeatureCollection` of 2D (`[lng, lat]`) features, each with a `kind` property (`zone`, `ates_line`, `area`, `avalanche_path`, `decision_point`, `access_route`, `poi`). Zones and ATES lines also carry their `ates` class. A real area (Tunnel Creek South) is about 235 KB of GeoJSON. The map layer merges every area into one source and stamps each feature with `areaId` and `areaName`.

Waypoints and photos are rendered from individual coordinate fields (`lat`, `lng`) rather than GeoJSON, assembled into a GeoJSON `FeatureCollection` by the layer components at render time. Photos are not clustered; a photo's `bearing` rides along as a feature property (omitted when null) to rotate its direction arrow.

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

Migration `3.sql` (Phase 10) adds the nullable `waypoints.icon` column. Existing rows get `NULL` and keep their category icon; ZIP bundles exported before it carry no `icon` key and import as `NULL`.

Migration `4.sql` (Phase 12) adds the `ates_areas` table. The ZIP backup format goes to `BUNDLE_VERSION` 2 with an `ates_areas` list in `metadata.json`; version 1 bundles have no such key and restore without touching existing areas.

---

## Deferred schema changes

Intentionally *not* added now; each is a small migration when its feature arrives (see ARCHITECTURE.md, "Deferred items"):

- **Multiple users:** nothing to add. `user_id` already exists on every entity table; the server would start filtering by it.
- **Offline sync:** `deleted_at TEXT` on every entity table, with all read paths gaining `WHERE deleted_at IS NULL`, plus whatever per-device sync state the chosen approach needs.

Only the cheapest, no-runtime-cost preparation has been done (`user_id`, client-generated UUIDs, ISO 8601 timestamps).

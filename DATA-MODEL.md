# Couloir - Data Model

## TypeScript Types

These are the canonical types used throughout the application. The SQLite schema below is derived from these types.

```typescript
// src/types/index.ts

export type EntityType = 'route' | 'track' | 'waypoint' | 'photo'

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'expert'

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
  color: string        // hex color string
  created_at: string   // ISO 8601
}

export interface Route {
  id: string           // uuid
  name: string
  description: string
  geojson: GeoJSON.LineString  // parsed from GPX, stored as JSON string in DB
  gpx_raw: string      // original GPX XML
  color: string        // hex color for map rendering
  difficulty: Difficulty | null
  distance_m: number   // metres, derived from geometry
  elevation_gain_m: number
  elevation_loss_m: number
  tags: string[]       // array of tag ids
  created_at: string
  updated_at: string
}

export interface Track {
  id: string
  name: string
  description: string
  geojson: GeoJSON.LineString
  gpx_raw: string
  color: string
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  duration_s: number | null    // seconds, null if no timestamps in GPX
  recorded_at: string | null   // ISO 8601, from first GPX timestamp
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Waypoint {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  elevation_m: number | null
  category: WaypointCategory
  color: string        // overrides category default if set
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  name: string
  description: string
  lat: number          // location of the photographer / camera
  lng: number
  elevation_m: number | null
  bearing: number | null  // 0-359, direction camera was pointing
  blob_ref: string     // OPFS filename: `photos/{id}.jpg`
                       // future: S3 URL when cloud sync is added
  width: number        // pixels
  height: number       // pixels
  file_size_bytes: number
  taken_at: string | null  // user-supplied date, not EXIF
  tags: string[]
  created_at: string
  updated_at: string
}

// Junction types for associations
export interface PhotoRoute {
  photo_id: string
  route_id: string
}

export interface PhotoTrack {
  photo_id: string
  track_id: string
}

// Export bundle for backup/restore
export interface ExportBundle {
  version: number      // bundle schema version, start at 1
  exported_at: string
  routes: Route[]
  tracks: Track[]
  waypoints: Waypoint[]
  photos: Photo[]      // metadata only, blobs exported separately
  tags: Tag[]
  photo_routes: PhotoRoute[]
  photo_tracks: PhotoTrack[]
}
```

---

## SQLite Schema

```sql
-- src/storage/schema.sql
-- This schema is designed to be forward-compatible with Postgres
-- when cloud sync is added. Avoid SQLite-specific types and features.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#888888',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routes (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  geojson           TEXT NOT NULL,   -- JSON string of GeoJSON LineString
  gpx_raw           TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#E05C2A',
  difficulty        TEXT,            -- easy | moderate | hard | expert | null
  distance_m        REAL NOT NULL DEFAULT 0,
  elevation_gain_m  REAL NOT NULL DEFAULT 0,
  elevation_loss_m  REAL NOT NULL DEFAULT 0,
  tags              TEXT NOT NULL DEFAULT '[]',  -- JSON array of tag ids
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tracks (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  geojson           TEXT NOT NULL,
  gpx_raw           TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#2A7BE0',
  distance_m        REAL NOT NULL DEFAULT 0,
  elevation_gain_m  REAL NOT NULL DEFAULT 0,
  elevation_loss_m  REAL NOT NULL DEFAULT 0,
  duration_s        REAL,
  recorded_at       TEXT,
  tags              TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waypoints (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  elevation_m   REAL,
  category      TEXT NOT NULL DEFAULT 'poi',
  color         TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  lat              REAL NOT NULL,
  lng              REAL NOT NULL,
  elevation_m      REAL,
  bearing          REAL,           -- 0-359 degrees
  blob_ref         TEXT NOT NULL,  -- OPFS path or future S3 URL
  width            INTEGER NOT NULL DEFAULT 0,
  height           INTEGER NOT NULL DEFAULT 0,
  file_size_bytes  INTEGER NOT NULL DEFAULT 0,
  taken_at         TEXT,
  tags             TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Junction tables for photo associations
CREATE TABLE IF NOT EXISTS photo_routes (
  photo_id   TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  route_id   TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, route_id)
);

CREATE TABLE IF NOT EXISTS photo_tracks (
  photo_id   TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  track_id   TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, track_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_routes_updated_at    ON routes(updated_at);
CREATE INDEX IF NOT EXISTS idx_tracks_recorded_at   ON tracks(recorded_at);
CREATE INDEX IF NOT EXISTS idx_waypoints_lat_lng    ON waypoints(lat, lng);
CREATE INDEX IF NOT EXISTS idx_photos_lat_lng       ON photos(lat, lng);
CREATE INDEX IF NOT EXISTS idx_photo_routes_route   ON photo_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_photo_tracks_track   ON photo_tracks(track_id);
```

---

## Default Values and Constants

```typescript
// Default colors per entity type
export const DEFAULTS = {
  route: {
    color: '#E05C2A',   // burnt orange
  },
  track: {
    color: '#2A7BE0',   // sky blue
  },
}

// Default color and icon per waypoint category
export const WAYPOINT_CATEGORIES: Record<WaypointCategory, {
  label: string
  color: string
  icon: string   // icon identifier for map symbol
}> = {
  entry_gate:  { label: 'Entry Gate',   color: '#22C55E', icon: 'gate' },
  cliff_band:  { label: 'Cliff Band',   color: '#EF4444', icon: 'warning' },
  rollover:    { label: 'Rollover',     color: '#F59E0B', icon: 'arrow-down' },
  hazard:      { label: 'Hazard',       color: '#EF4444', icon: 'hazard' },
  skin_track:  { label: 'Skin Track',   color: '#A78BFA', icon: 'track' },
  cache:       { label: 'Cache',        color: '#60A5FA', icon: 'cache' },
  summit:      { label: 'Summit',       color: '#FBBF24', icon: 'summit' },
  poi:         { label: 'Point of Interest', color: '#94A3B8', icon: 'poi' },
  other:       { label: 'Other',        color: '#94A3B8', icon: 'pin' },
}

// Map settings defaults
export const MAP_DEFAULTS = {
  center: [-116.0, 49.5] as [number, number],  // Fernie, BC
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  basemap: 'outdoor' as Basemap,
}

export type Basemap = 'satellite' | 'outdoor' | 'winter'
```

---

## GeoJSON Structures

Routes and tracks are stored as GeoJSON with elevation in the Z coordinate:

```json
{
  "type": "LineString",
  "coordinates": [
    [-116.123, 49.456, 1820.5],
    [-116.124, 49.457, 1835.2],
    ...
  ]
}
```

The elevation profile is derived from the Z coordinates at render time - no separate elevation array is stored.

Waypoints and photos are rendered from individual coordinate fields (`lat`, `lng`) rather than GeoJSON, assembled into a GeoJSON FeatureCollection by the layer components at render time.

---

## ID Generation

All entity IDs are UUIDs generated client-side using `crypto.randomUUID()`. This is intentional - it ensures IDs are globally unique when cloud sync is added, with no ID conflicts between devices.

---

## Tag Storage

Tags are stored as a JSON array of tag IDs in each entity row (e.g. `'["abc123", "def456"]'`). This is a deliberate denormalization for the local-first SQLite context. Junction tables for tags would add query complexity with no practical benefit at this scale.

When querying entities by tag, the filter is applied in JavaScript after fetching, not in SQL. Entity counts per layer are small enough (hundreds, not millions) that this is perfectly fast.

---

## Schema Versioning

A `schema_version` table tracks the applied migration version:

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The OPFS storage implementation checks this on startup and applies any pending migrations before the app loads. Start at version 1.

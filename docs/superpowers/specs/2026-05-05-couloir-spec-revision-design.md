# Couloir spec revision — design rationale

**Date**: 2026-05-05
**Status**: Approved by user; ready for implementation planning.
**Scope**: Initial revision of the four-file spec (`SPEC.md`, `ARCHITECTURE.md`, `DATA-MODEL.md`, `TASKS.md`) before any code is written.

## Why this document exists

The original spec was solid but contained a number of inconsistencies, missing decisions, and quietly load-bearing assumptions that would have been expensive to fix later. This document records the decisions made during a structured critique pass, in one place, with the *why* — so that the four spec files can be read for *what to build* without losing the reasoning behind the choices.

If a future change conflicts with anything here, it's worth re-reading the reasoning before overriding it.

---

## 1. Storage layer

### 1.1 Database engine

**Decision**: Keep `wa-sqlite` with the `OPFSCoopSyncVFS` backend. Drop PGlite from consideration.

**Why**:
- The planned sync libraries (PowerSync, ElectricSQL) are SQLite-on-the-client → Postgres-on-the-server. Postgres-in-the-browser (PGlite) doesn't align with that architecture; it would solve a problem we don't have.
- PGlite is still labeled alpha by its maintainers and ships ~3 MB gzipped vs ~600 KB for SQLite WASM.
- `wa-sqlite` reached 1.0 in July 2024. Its `OPFSCoopSyncVFS` does not require COOP/COEP cross-origin-isolation headers (unlike the official `@sqlite.org/sqlite-wasm`), which materially simplifies dev and deployment.

**Caveats to document in the spec**:
- Single dedicated worker per page; opening the app in two tabs will lock or fail. Acceptable for a single-user app.
- OPFS is unavailable in Safari incognito mode.

### 1.2 Schema migration framework

**Decision**: Build a minimal migration framework now; ship with only `v1` defined.

**Why**: Inventing a migration framework under pressure (during the *first* schema change) is the worst time to do it. The minimal version is short, and the convention ("every change is a numbered file") removes a class of future ambiguity.

**Shape**:
```
src/storage/migrations/{n}.sql            (numeric order; transaction-wrapped)
src/storage/opfs.ts:: ensureSchema()      (compares schema_version to SCHEMA_VERSION constant)
SCHEMA_VERSION = 1
```

Forward-version detection (DB version > app version) throws `SchemaVersionError` so an older build can't silently corrupt a newer DB.

**Schema-table fix**: the original `schema_version` table had no PK. Tightened to `(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`.

### 1.3 Sync-aware columns now; soft delete deferred

**Decision**: Every entity table gets `user_id TEXT NOT NULL DEFAULT 'local'` and app-managed ISO 8601 timestamps. Soft delete (`deleted_at`) is *not* added now.

**Why**: This splits sync-readiness into "free-now" wins and "real-cost" wins. `user_id` is invisible until needed and saves a backfill migration later. Timestamp discipline (always ISO 8601, always set in code, never via SQL `DEFAULT (datetime('now'))`) removes the format-mismatch bug *and* gives sync engines an `updated_at` they can trust. Soft delete imposes a real ongoing tax (`WHERE deleted_at IS NULL` on every list query) for a benefit that arrives only with sync. Not worth paying yet.

**Documented in `ARCHITECTURE.md`** under "Sync-deferred items": the migration shape for adding `deleted_at` when the time comes.

---

## 2. Data model

### 2.1 No entity-to-entity associations

**Decision**: Remove all entity-to-entity associations. Photos do not link to routes, tracks, or waypoints. Routes do not link to waypoints.

**Why**: Spatial proximity on the map *is* the association. An explicit link layer duplicates information the map already shows and creates two ways for state to drift (the link says yes, the geometry says no). For a single-user atlas, this simplification is unambiguously a win.

**What's dropped**: `photo_routes` and `photo_tracks` tables, `linkPhotoToRoute` / `linkPhotoToTrack` / `unlinkPhoto` methods, `PhotoRoute` and `PhotoTrack` types, the corresponding arrays in `ExportBundle`, and the "Associate with route/track" UI in the photo viewer (Task 5.4).

### 2.2 Tags via a single junction table

**Decision**: Tags are stored in a junction table:

```sql
CREATE TABLE entity_tags (
  entity_type  TEXT NOT NULL,    -- 'route' | 'track' | 'waypoint' | 'photo'
  entity_id    TEXT NOT NULL,
  tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_type, entity_id, tag_id)
);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
```

The TypeScript types still expose `tags: string[]` on each entity; the storage layer hydrates this at read time and writes through to the junction table on save.

**Why**:
- Tag deletion cleanup is automatic via `ON DELETE CASCADE` (the original inline-array design left the cleanup behavior undefined).
- Reverse queries ("all entities with tag X") become a one-row index lookup instead of a full-table scan.
- Sync engines version each (entity, tag) row independently; no parent-row contention if two devices touch the same entity.

### 2.3 Drop `gpx_raw`; add `source_hash` and `source_filename`

**Decision**: Routes and tracks no longer store the original GPX XML. They gain:

- `source_hash TEXT NOT NULL` — SHA-256 of the imported GPX bytes.
- `source_filename TEXT` — original filename, for display only.

**Why**: The raw XML is ~75% of each row's storage cost and serves features that don't exist (post-MVP "export to GPX" can synthesize from stored data with fidelity adequate for personal re-use). The hash gives us deduplication at import time as a positive side effect — the *one* useful thing the raw XML was implicitly providing.

**Import behavior**: on import, compute hash; if a route/track with the same hash exists, prompt "you've already imported this — replace, skip, or import as new copy?"

### 2.4 Photo coordinate semantics: subject vs camera

**Decision**: Photos have *two* coordinate sets.

```typescript
// Subject — the terrain depicted; user-placed pin (draggable).
lat:                number
lng:                number
elevation_m:        number | null

// Camera — preserved from EXIF; rarely edited.
camera_lat:         number | null
camera_lng:         number | null
camera_elevation_m: number | null
bearing:            number | null
```

**Why**: A recon photo answers "what does this terrain look like?" and the more useful pin is the subject (the terrain), not the camera (where the photographer was standing). But the camera position has independent value — it tells you the perspective the photo was shot from, and is required for the future "bearing arrow / FOV cone" visualization. Storing both costs three nullable columns and gives both the present and the future.

**MVP rendering**: only the subject pin appears on the map. The camera fields surface in the photo detail panel as read-only text ("Shot from: 49.512, -116.034").

**Future feature** (already in the post-MVP backlog, now data-supported): camera icon at `camera_lat`/`camera_lng` with arrow in `bearing` direction.

### 2.5 Track time: total + moving

**Decision**: Replace single `duration_s` with two fields:

- `duration_s` — total elapsed time (last_ts − first_ts).
- `moving_time_s` — sum of inter-point durations where instantaneous speed ≥ `MOVING_SPEED_THRESHOLD_M_S` (0.14 m/s ≈ 0.5 km/h).

Both nullable when GPX has no timestamps.

**Why**: A 6-hour ski day with 1.5 hours of breaks/lifts/transitions tells a different story from a 4.5-hour pure-effort tour. The user wants both numbers. The threshold (`0.14 m/s`) is the only fudge factor in the system; it lives in `DATA-MODEL.md` constants for easy adjustment.

**Multi-segment GPX**: trackpoints from all `<trkseg>` elements are concatenated into one `LineString`. Time fields are computed as above. No `MultiLineString` storage — segment-level analysis is not a planned feature.

### 2.6 Route difficulty: ATES + technical, both nullable

**Decision**: Replace single `difficulty` with two fields:

- `ates: ATES | null` — Avalanche Terrain Exposure Scale (`simple | challenging | complex | extreme`).
- `technical_difficulty: TechnicalDifficulty | null` — skiing-technical scale (`easy | moderate | hard | expert`).

Tracks remain rating-free (recorded reality doesn't need a planning-grade rating).

**Why**: ATES is the standard rating in Canada (Avalanche Canada, Parks Canada, published guidebooks). Adopting it makes the library speak the same language as the user's other information sources. Technical difficulty captures a different axis — pure ski difficulty — that ATES doesn't. Both being nullable means the user fills in only what they care about for any given route.

---

## 3. Photo import pipeline

### 3.1 Format support: JPEG and PNG only

**Decision**: Reject HEIC at import with a guidance message ("HEIC is not supported. On iPhone: Settings → Camera → Formats → Most Compatible").

**Why**: HEIC requires a ~1 MB WASM decoder dependency and produces multi-second conversion times on mobile. For an app where the user controls capture, "flip one iOS setting" is acceptable friction.

### 3.2 EXIF processing

**Decision**: At import, read EXIF via `exifr` and use the data as follows:

| EXIF tag | Use |
|---|---|
| `Orientation` | Apply to canvas; re-encode upright JPEG. |
| `GPSLatitude` / `GPSLongitude` | Prefill `camera_lat` / `camera_lng` (and seed `lat`/`lng` to the same point so the subject pin starts somewhere sensible). |
| `GPSImgDirection` | Prefill `bearing`. |
| `GPSAltitude` | Prefill `camera_elevation_m`. |
| `DateTimeOriginal` | Prefill `taken_at`. |

Re-encoded JPEG has all EXIF stripped (privacy + smaller files).

**Why**: Prefill-with-override is the correct UX pattern: zero cost when EXIF is wrong (just drag/edit), high value when it's right.

### 3.3 Placement flow

**Decision**:

```
File picked or dropped
  → reject if not JPEG/PNG
  → read EXIF tags
  → decode → canvas → apply orientation → re-encode JPEG (EXIF stripped)
  → generate thumbnail (max 128px) → photos/{id}_thumb.jpg
  → store full → photos/{id}.jpg

If EXIF GPS present:
  • map flies to GPS coordinates
  • subject pin drops at GPS location, draggable
  • detail panel opens in 'create' mode with prefilled bearing/elevation/taken_at
  • user adjusts subject pin and any field, saves

If EXIF GPS absent:
  • placement-mode flow: thumbnail follows cursor; click map to pin
  • create mode opens after click
```

Subject pin is the only on-map element pre-save. Camera position is captured silently from EXIF.

### 3.4 Width / height columns

**Decision**: Drop `DEFAULT 0` from `width` and `height` columns. Both populated from re-encoded JPEG at import; no row should ever have `0` for either.

---

## 4. State management

### 4.1 Two parallel state machines in the UI Zustand slice

**Decision**:

```typescript
type PanelState =
  | { mode: 'idle' }
  | { mode: 'view';   entityType: EntityType; entityId: string }
  | { mode: 'edit';   entityType: EntityType; entityId: string; draft: EntityDraft }
  | { mode: 'create'; entityType: 'waypoint' | 'photo'; draft: EntityDraft }

type PlacementState =
  | { mode: 'idle' }
  | { mode: 'waypoint' }
  | { mode: 'photo'; blob: Blob; exif: ExifData; preview: string }
```

Transitions go through explicit actions:
- `openEntity(type, id)` — idle/view/edit/create → view
- `editCurrent()` — view → edit
- `closePanel()` — anything → idle
- `startWaypointPlacement()` — idle → placement.waypoint
- `startPhotoPlacement(blob, exif)` — idle → placement.photo
- `completePlacement(lat, lng)` — placement → panel.create
- `cancelPlacement()` — placement → idle

**Why**: The same panel doubles as view/edit/create mode for four entity types, and placement mode runs in parallel on the map. Without a discriminated-union state machine, invalid combinations (edit form open with no entity, two pending placements, edit + placement simultaneously) become representable and silently buggy. Keeping panel state and placement state *separate* (not one combined union) lets the map subscribe to placement only and the panel subscribe to panel state only — they communicate via actions, not shared state.

### 4.2 ESC handler precedence

**Decision**: One global keyboard hook. Precedence: cancel placement first, else exit edit (back to view), else close panel.

---

## 5. Map / API key

### 5.1 Maptiler error handling

**Decision**: Three explicit failure points are surfaced to the user:

1. **Startup style fetch**: non-2xx response → inline error + auto-open Settings panel with key field focused.
2. **Runtime tile errors**: subscribe to MapLibre `error` event; if rate exceeds 3 errors in 10 seconds, show a non-modal banner ("Tile loading is failing — your key may be invalid or over quota").
3. **Key change**: re-create map sources (no full page reload).

**Why**: The current spec had no error UX for any of these failure modes. A blank map can mean the key is wrong, the quota is exceeded, or the network is bad — all visually identical without explicit capture. The user is the *only* user; getting them unstuck quickly is the entire UX.

No on-save validation probe (which was in my original recommendation) — runtime monitoring is sufficient and avoids an extra network call in the Settings flow.

### 5.2 Photo clustering

**Decision**: Photos use native MapLibre clustering.

```
photos-source        cluster: true, clusterMaxZoom: 13, clusterRadius: 50

photos-clusters      circle layer; filter ['has', 'point_count']
photos-cluster-count text layer; shows point_count
photos-thumbnails    symbol layer; filter ['!', ['has', 'point_count']]
```

Click a cluster → map zooms to its bounds. Click a thumbnail → detail panel.

**Why**: 100+ photos at low zoom in valley overview are unreadable as individual thumbnails. Clustering matches user expectation from every other map app.

---

## 6. Backup

### 6.1 ZIP bundle export

**Decision**: Replace JSON-only export with a ZIP bundle written via `fflate` (~9 KB minified, streaming-capable):

```
couloir-backup-2026-05-05.zip
  manifest.json          { bundle_version, app_version, exported_at, photo_count, total_size_bytes }
  metadata.json          ExportBundle (entities, tags, settings)
  photos/{id}.jpg        full-size blob per photo
  photos/{id}_thumb.jpg  thumbnail per photo (regenerable on import if missing)
```

**Why**: JSON-only is not a real backup for an atlas where photos are most of the value. A user who exports, then later restores from the JSON, would silently lose every photo — worst-case UX.

**Import**: additive, not destructive. Existing IDs are updated when the bundle's `updated_at` is newer; new IDs are inserted. Thumbnails regenerated if missing from the bundle.

**UI**: pre-export size estimate displayed in Settings ("Backup will be ~412 MB. Continue?").

---

## 7. Polish

### 7.1 Color validation at boundary

**Decision**: Validate `#RRGGBB` at form-input boundary via `/^#[0-9a-fA-F]{6}$/`. Storage stays permissive.

**Why**: Boundary validation lets every layer downstream assume well-formedness; defensive checks scattered through rendering code go away.

### 7.2 Drop unused indexes

**Decision**: Remove `idx_waypoints_lat_lng` and `idx_photos_lat_lng`.

**Why**: No read pattern in the spec uses range queries on these columns ("load all rows" doesn't benefit from the index). B-tree indexes on two independent dimensions don't help spatial queries even when introduced. If viewport-based filtering arrives later, switch to SQLite's `rtree` extension at that point — it's the only thing that helps.

### 7.3 Debug utility

**Decision**:

```typescript
// src/utils/debug.ts
const ENABLED = typeof localStorage !== 'undefined' &&
                localStorage.getItem('couloir_debug') === '1'

export function debug(...args: unknown[]): void {
  if (ENABLED) console.log('[couloir]', ...args)
}
```

User can enable via DevTools: `localStorage.setItem('couloir_debug', '1')`. Documented in `ARCHITECTURE.md`.

---

## 8. Things deliberately deferred

These came up during the critique but were intentionally *not* added now:

- **Soft delete (`deleted_at`)** — not worth the read-path tax until sync arrives. Migration shape documented.
- **Multi-tab coordination** — single-user, single-tab is sufficient.
- **HEIC support** — covered by user-side iOS setting.
- **Per-segment `MultiLineString` track storage** — moving-time computation already gives the user the value they wanted from segments.
- **Spatial (R-tree) indexes** — no read pattern needs them yet.
- **Bearing cone / FOV footprint visualization** — already in post-MVP; data fields now exist to support it.
- **Export back to GPX** — already in post-MVP; will synthesize from GeoJSON when implemented.
- **Tag rename UI** — implicit in the data model (single tags row update); UI deferred.

---

## What this doesn't change

- Tech stack at a high level (React + Vite + TypeScript + MapLibre + Maptiler).
- Phased task structure.
- Single-user / local-first / sync-ready posture.
- Folder structure (modulo new files for migrations and EXIF).
- Dark theme, mobile-aware, map-primary UI principles.

The spec was solid on direction; the changes here are about consistency, completeness, and removing speculation.

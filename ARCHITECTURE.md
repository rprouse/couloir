# Couloir - Architecture

## Guiding Principles

- **Local-first**: All data lives in the browser. No network dependency for core functionality.
- **Storage abstraction**: All data access goes through a storage interface. The implementation is swappable without touching application code.
- **Sync-aware schema**: The local SQLite schema is shaped so that adopting a sync backend is a code change, not a schema redesign. We pay the costs that are nearly free now and defer those that aren't (see "Sync-deferred items" below).
- **One codebase**: The same React app runs as a desktop web app, a PWA, and (eventually) a Capacitor mobile app.

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite | Component model suits a panel-heavy map app; Vite is fast; good PWA support |
| Language | TypeScript | Type safety is worth it for a data-model-heavy app |
| Map renderer | MapLibre GL JS | Open source, Maptiler-compatible, excellent 3D terrain support |
| Terrain & tiles | Maptiler | RGB terrain tiles, satellite, topo, and winter basemaps |
| Local database | wa-sqlite (async build) with `OriginPrivateFileSystemVFS` | wa-sqlite 1.0.0 on npm doesn't ship `OPFSCoopSyncVFS`, so we use the async-build OPFS VFS that does ship; it has the same architectural properties (no COOP/COEP requirement, OPFS access handles serialized via WebLocks) |
| Photo storage | OPFS blobs alongside SQLite | Self-contained, no server required |
| State management | Zustand | Lightweight, no boilerplate, works well with async storage layer |
| Styling | CSS Modules + CSS custom properties | Scoped styles, no runtime cost, easy theming |
| Charts | Recharts | Elevation profiles; React-native, lightweight |
| GPX parsing | Custom parser (`DOMParser`) | GPX is simple XML; no library dependency needed |
| EXIF parsing | `exifr` | Small, fast, reads only the tags we need (orientation, GPS, bearing, altitude, date) |
| ZIP backup | `fflate` | ~9 KB minified, streaming-capable; used for the export bundle |
| Build | Vite | Fast HMR, good PWA plugin support |

---

## Project Structure

```
couloir/
├── public/
│   └── icons/                 # App icons (icon.svg source + rendered PNGs)
├── src/
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # Root component, layout shell
│   ├── storage/
│   │   ├── interface.ts       # StorageProvider interface (the abstraction)
│   │   ├── errors.ts          # SchemaVersionError, StorageNotInitializedError
│   │   ├── provider.ts        # getStorage / setStorage DI seam
│   │   ├── memory.ts          # InMemoryStorageProvider (used by tests)
│   │   ├── opfs.ts            # OPFSStorageProvider main-thread shell (RPC client)
│   │   ├── workerProtocol.ts  # Wire types between main thread and worker
│   │   ├── workerClient.ts    # postMessage RPC wrapper (rejects pending on worker death, rehydrates SchemaVersionError)
│   │   ├── workerHost.ts      # Worker entry: wa-sqlite + OPFS VFS + ensureSchema + blob ops
│   │   ├── wa-sqlite.d.ts     # Ambient declarations for the wa-sqlite surface we use
│   │   └── migrations/
│   │       ├── 1.sql          # Initial schema (source of truth for v1)
│   │       └── index.ts       # MIGRATIONS list + SCHEMA_VERSION constant
│   ├── dev/
│   │   └── devConsole.ts      # window.__couloir helper, dev-only
│   ├── store/
│   │   ├── index.ts           # Zustand store root
│   │   ├── routes.ts          # Route slice
│   │   ├── tracks.ts          # Track slice
│   │   ├── waypoints.ts       # Waypoint slice
│   │   ├── photos.ts          # Photo slice
│   │   ├── tags.ts            # Tag slice
│   │   └── ui.ts              # Panel state, placement state, layer toggles, etc.
│   ├── map/
│   │   ├── MapView.tsx        # MapLibre GL JS wrapper
│   │   ├── layers/
│   │   │   ├── RoutesLayer.tsx
│   │   │   ├── TracksLayer.tsx
│   │   │   ├── WaypointsLayer.tsx
│   │   │   ├── PhotosLayer.tsx
│   │   │   └── SlopeLayer.tsx  # Raster slope overlay (slope:// tiles)
│   │   ├── slope/
│   │   │   ├── slopeMath.ts    # terrain-rgb decode, ground resolution, Horn slope
│   │   │   ├── slopeBands.ts   # Avalanche angle bands + RGBA colouring
│   │   │   ├── slopeProtocol.ts # slope:// MapLibre protocol (DEM fetch → PNG)
│   │   │   └── browserCodec.ts # createImageBitmap / OffscreenCanvas decode+encode
│   │   ├── controls/
│   │   │   ├── TerrainControl.tsx # 3D terrain + slope overlay toggles
│   │   │   ├── SlopeLegend.tsx
│   │   │   └── BasemapControl.tsx
│   │   └── mapConfig.ts       # Maptiler styles, source definitions
│   ├── panels/
│   │   ├── LayerPanel/        # Layer toggles, item counts, filter by tag
│   │   ├── DetailPanel/       # Route/track/waypoint/photo view/edit/create
│   │   ├── SettingsPanel/     # API key, map defaults, export/import, tags
│   │   └── SearchPanel/       # Global search
│   ├── features/
│   │   ├── routes/            # Route import, form, list
│   │   ├── tracks/            # Track import, form, list
│   │   ├── waypoints/         # Waypoint creation, form
│   │   └── photos/            # Photo upload, EXIF processing, placement, viewer
│   ├── components/
│   │   ├── ElevationProfile/  # Recharts elevation chart
│   │   ├── TagPicker/
│   │   ├── IconPicker/
│   │   └── FileDropzone/
│   ├── hooks/
│   │   ├── useStorage.ts      # Storage provider hook
│   │   ├── useMap.ts          # MapLibre map instance access
│   │   ├── useGpx.ts          # GPX parsing hook
│   │   └── useEscapeKey.ts    # Global ESC handler with placement/edit/close precedence
│   ├── utils/
│   │   ├── gpx.ts             # GPX parser
│   │   ├── exif.ts            # EXIF reading (orientation, GPS, bearing, altitude, date)
│   │   ├── image.ts           # Re-encode JPEG with applied orientation, generate thumbnails
│   │   ├── hash.ts            # SHA-256 of bytes (for source_hash)
│   │   ├── geo.ts             # Coordinate utilities, distance, elevation
│   │   ├── format.ts          # Distance, elevation, duration formatting; isValidHex
│   │   ├── debug.ts           # Debug-logging helper, gated by localStorage flag
│   │   └── backup.ts          # ZIP read/write via fflate
│   └── types/
│       └── index.ts           # Shared TypeScript types
```

---

## Storage Interface

All data access in application code must go through the `StorageProvider` interface, never directly to the SQLite implementation. This is the key abstraction that makes the backend swappable.

```typescript
// src/storage/interface.ts

export interface StorageProvider {
  // Routes
  getRoutes(): Promise<Route[]>
  getRoute(id: string): Promise<Route | null>
  saveRoute(route: Route): Promise<void>
  deleteRoute(id: string): Promise<void>
  getRouteBySourceHash(hash: string): Promise<Route | null>

  // Tracks
  getTracks(): Promise<Track[]>
  getTrack(id: string): Promise<Track | null>
  saveTrack(track: Track): Promise<void>
  deleteTrack(id: string): Promise<void>
  getTrackBySourceHash(hash: string): Promise<Track | null>

  // Waypoints
  getWaypoints(): Promise<Waypoint[]>
  getWaypoint(id: string): Promise<Waypoint | null>
  saveWaypoint(waypoint: Waypoint): Promise<void>
  deleteWaypoint(id: string): Promise<void>

  // Photos
  getPhotos(): Promise<Photo[]>
  getPhoto(id: string): Promise<Photo | null>
  savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void>
  updatePhotoMetadata(photo: Photo): Promise<void>
  getPhotoBlob(id: string): Promise<Blob | null>
  getPhotoThumb(id: string): Promise<Blob | null>
  deletePhoto(id: string): Promise<void>

  // Tags
  getTags(): Promise<Tag[]>
  saveTag(tag: Tag): Promise<void>
  deleteTag(id: string): Promise<void>
  setEntityTags(entityType: EntityType, entityId: string, tagIds: string[]): Promise<void>
  // Reads of tag arrays are baked into the entity getters above (the storage layer
  // hydrates `tags: string[]` from the entity_tags junction table).

  // Backup
  exportAll(): Promise<{ bundle: ExportBundle; photos: Map<string, Blob>; thumbs: Map<string, Blob> }>
  importAll(bundle: ExportBundle, photos: Map<string, Blob>, thumbs: Map<string, Blob>): Promise<void>
}
```

The OPFS implementation (`src/storage/opfs.ts`) is the only file that contains SQLite calls. When a sync backend is added, a new implementation file is created and injected at the app root — zero changes to feature code.

`updatePhotoMetadata` rewrites only the row and tag junction rows; it never touches OPFS blobs. All photo edits (including drag-to-reposition) use it.

**Notable absences**: there are no `linkPhotoToRoute` / `linkPhotoToTrack` / `unlinkPhoto` methods. Photos do not link to routes, tracks, or waypoints; spatial proximity on the map is the relationship.

---

## VFS Choice and OPFS Caveats

We use `wa-sqlite`'s `OriginPrivateFileSystemVFS` paired with the async `wa-sqlite-async.mjs` build. (The plan originally specified `OPFSCoopSyncVFS` but that VFS only ships in unreleased wa-sqlite versions; the published 1.0.0 npm package only carries `OriginPrivateFileSystemVFS`. The substitute preserves the relevant architectural properties.) Three important properties:

- It does **not** require COOP/COEP (cross-origin-isolation) headers. The Vite dev server can stay simple, and third-party iframes/images keep working.
- It serializes access to the database file via OPFS sync access handles + Web Locks, which makes it effectively single-tab. Opening Couloir in two tabs at once will cause the second tab's `init()` to block (or fail) when the first holds the access handle. Acceptable for a single-user app; not acceptable for multi-tab use without coordination.
- The async build forwards every wa-sqlite operation through a worker round-trip. Latency overhead is small for the CRUD-heavy workload Couloir produces.

**Browser support caveats:**

- **Safari incognito**: OPFS is unavailable. The app cannot operate in Safari private browsing.
- **Chrome incognito**: 100 MB OPFS quota cap.
- **All browsers**: OPFS quotas are dynamic and can be reclaimed by the OS under storage pressure. Backups (the ZIP export) are the user's only protection against this.

These limitations are documented in the user-facing settings panel as "Storage requirements."

---

## Maptiler Integration

The Maptiler API key is stored in `localStorage` under the key `couloir_maptiler_key`. It is read at app startup and injected into all map style URLs and terrain source URLs.

### Style URLs

```
Satellite:  https://api.maptiler.com/maps/satellite/style.json?key={KEY}
Outdoor:    https://api.maptiler.com/maps/outdoor-v2/style.json?key={KEY}
Winter:     https://api.maptiler.com/maps/winter-v2/style.json?key={KEY}
```

### Terrain Source

```javascript
map.addSource('maptiler-dem', {
  type: 'raster-dem',
  url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${KEY}`,
  tileSize: 256
})

map.setTerrain({
  source: 'maptiler-dem',
  exaggeration: 1.5  // user-adjustable, stored in settings
})
```

The map will not initialize if no API key is set. The app shows the settings panel with a prompt to enter the key.

### Slope Overlay

Slope-angle shading is computed in the browser from the same terrain-rgb tiles as 3D terrain. No third-party slope tiles are involved.

- `main.tsx` registers a MapLibre custom protocol, `slope://{z}/{x}/{y}` (`src/map/slope/slopeProtocol.ts`). The handler reads the Maptiler key live from the settings store.
- For each tile, it looks up the DEM tile URL template from `terrain-rgb-v2/tiles.json`. This is fetched once per key and cached; a failed lookup is dropped from the cache so the next tile retries. It then fetches the matching DEM tile, using MapLibre's abort signal.
- Decode: `elevation = -10000 + (R·65536 + G·256 + B) · 0.1`. `createImageBitmap` is called with `colorSpaceConversion: 'none'` so colour management can't alter the encoded elevations.
- Slope: Horn's 3×3 method. Ground pixel size comes from the tile's centre latitude. Pixels past the tile edge are linearly extrapolated, so seams stay minimal without fetching neighbouring tiles.
- Colours (`SLOPE_BANDS`): 12–24° green, 25–29° yellow, 30–34° orange, 35–39° red, 40–44° purple, 45°+ blue. Below 12° is transparent. The colours are literal hex because they're painted into pixels.
- DEM 404/204 returns a transparent tile, so it doesn't trip the tile-error monitor. Other HTTP errors are thrown and count toward the banner.
- `SlopeLayer` adds a `raster` source (`tileSize` 512, minzoom 10, maxzoom 14; MapLibre stretches tiles above that). Its layer goes before the first layer that is either a basemap `symbol` layer or a Couloir layer, so it sits under the labels and under our own data. The layer is always installed; toggling only changes `visibility`.
- Off by default, since every slope tile costs a Maptiler request. The on/off state and opacity are saved in `localStorage` (`couloir_slope_enabled`, `couloir_slope_opacity`).
- Accuracy: the DEM is roughly 30 m, so short steep features (cliff bands, rolls, gully walls) read lower than reality. The legend says so.

### Error handling

API key and tile failures are surfaced explicitly rather than producing a silent dark map:

1. **Startup style fetch**: when loading a basemap style URL, a non-2xx response surfaces an inline error message ("Couldn't load Maptiler style — your key may be invalid or revoked") and auto-opens the Settings panel with the key field focused.
2. **Runtime tile errors**: subscribe to MapLibre's `error` event. If three or more tile errors occur within a 10-second rolling window, show a non-modal banner at the top of the map area: "Tile loading is failing — your key may be invalid or over quota. Open Settings."
3. **Key change**: when the user updates the key in Settings, re-create the map sources in place (no full page reload). The active basemap and all custom layers persist.

The error banner is dismissable but reappears if errors continue.

---

## State Management

Zustand is used for all application state. The store is divided into slices:

- **routes, tracks, waypoints, photos, tags**: mirror the storage layer. Each slice loads on app startup, and mutations call through to the storage provider then update local state.
- **ui**: panel state, placement state, layer visibility toggles, active basemap, terrain exaggeration, slope overlay on/off and opacity, error banner state.

### Panel and placement state

The detail panel doubles as a viewer, an editor, and a creation form. Placement mode runs in parallel on the map. To prevent invalid combinations, both states are modeled as discriminated unions:

```typescript
type PanelState =
  | { mode: 'idle' }
  | { mode: 'view';   entityType: EntityType; entityId: string }
  | { mode: 'edit';   entityType: EntityType; entityId: string; draft: EntityDraft }
  | { mode: 'create'; entityType: 'waypoint'; draft: EntityDraft }
  | { mode: 'create'; entityType: 'photo'; draft: EntityDraft; pending: PendingPhoto }

type PlacementState =
  | { mode: 'idle' }
  | { mode: 'waypoint' }
  | { mode: 'photo'; pending: PendingPhoto }
```

The pending photo moves from `placement.photo` to the `create` photo panel on `completePlacement`. The UI store owns its `preview` object URL and revokes it on the transition that drops the last reference.

All transitions go through explicit actions on the UI slice:

| Action | From → to |
|---|---|
| `openEntity(type, id)` | any → `panel.view` |
| `editCurrent()` | `panel.view` → `panel.edit` |
| `closePanel()` | any → `panel.idle` |
| `startWaypointPlacement()` | `placement.idle` → `placement.waypoint` |
| `startPhotoPlacement(pending)` | `placement.idle` → `placement.photo` |
| `completePlacement(lat, lng)` | `placement.*` → `panel.create` (placement → idle) |
| `cancelPlacement()` | `placement.*` → `placement.idle` |

The map subscribes only to `PlacementState` (cursor and click handling). The detail panel subscribes only to `PanelState`. They communicate via actions, never via shared mutable state.

### Tag filters

`ui.tagFilters` holds a list of tag IDs per layer (`routes`, `tracks`, `waypoints`, `photos`). An entity passes when it carries **any** of the selected tags (OR semantics); an empty list means no filter. Filtering runs in JS (`filterByTags`) before each layer builds its GeoJSON, not through MapLibre filter expressions. Deleting a tag prunes it from every filter.

Global search ignores tag filters. Clicking a search result turns the entity's layer on if it is hidden, frames the entity on the map and opens its detail panel. A hit that is tag-filtered out still opens and is framed, but does not render on the map (accepted for the MVP).

### Global ESC key handler

`useEscapeKey()` owns the ESC key with this precedence:

1. If `placement.mode !== 'idle'`, cancel placement.
2. Else if `panel.mode === 'edit'`, exit to view.
3. Else if `panel.mode !== 'idle'`, close the panel.
4. Else no-op.

---

## GPX Parsing and Import

GPX files are parsed client-side using the browser's `DOMParser`. No external library is needed.

- `<rte>` / `<rtept>` elements → Route geometry
- `<trk>` / `<trkpt>` elements → Track geometry
- `<wpt>` elements → ignored in MVP (post-MVP: optional waypoint import)
- Elevation from `<ele>` child elements
- Timestamps from `<time>` child elements (tracks)
- Name from `<name>`, description from `<desc>`

Parsed geometry is stored as a GeoJSON `LineString` with elevation in the Z coordinate. The raw GPX XML is **not** stored; the SHA-256 hash of the imported file bytes is stored as `source_hash` for duplicate detection.

### Multi-segment tracks

Trackpoints from all `<trkseg>` elements are concatenated into one `LineString`. Time fields are computed across all trackpoints (see below) — segment boundaries are not preserved.

### Time computation

For tracks with timestamps:

- `duration_s` = total elapsed time = `last_ts - first_ts`. Includes any gap.
- `moving_time_s` = sum of inter-point durations where instantaneous speed (haversine distance / dt) is at or above `MOVING_SPEED_THRESHOLD_M_S` (defined in `DATA-MODEL.md`). Excludes both recorder-paused gaps *and* within-segment idle.

Both fields are nullable when the GPX has no timestamps.

### Duplicate detection

On import, the app computes the SHA-256 of the file bytes, then checks for an existing route or track with the same hash. If found, the user is prompted: replace, skip, or import as a new copy. This prevents accidental duplicate libraries when re-importing from external tools.

---

## Photo Import Pipeline

```
file picked (Add Photo)
  → classify: HEIC/HEIF → guidance message, abort; not JPEG/PNG → message, abort
  → in parallel:
      • read EXIF from the original file: GPS lat/lng, GPSAltitude(+Ref), GPSImgDirection, DateTimeOriginal
      • createImageBitmap(file, { imageOrientation: 'from-image' })  — the browser applies EXIF orientation
        → canvas → JPEG (longest edge ≤ 4096 px, q 0.9) — drawing through canvas strips all EXIF
        → canvas → thumbnail JPEG (longest edge ≤ 128 px)
  → startPhotoPlacement(pending)
  → if EXIF GPS present:
      • map flies to the GPS position
      • completePlacement(lat, lng) immediately → panel.create (pin draggable)
  → else:
      • placement.photo stays active; thumbnail follows the cursor
      • click map → completePlacement(lat, lng) → panel.create
  → create form: bearing / elevation / taken_at prefilled from EXIF; elevation falls back to terrain
  → on save: storage.savePhoto writes photos/{id}.jpg + photos/{id}_thumb.jpg, then the row
```

Orientation is not applied manually. `createImageBitmap` with `imageOrientation: 'from-image'` already returns upright pixels, so rotating by the EXIF tag again would double-rotate.

Re-encoded JPEGs have all EXIF stripped before storage — both for privacy (no embedded GPS, device serial, or photographer identification) and for size.

---

## Map Layer Architecture

Each data type is a self-contained MapLibre layer component that subscribes to its Zustand slice. Layers add their own sources and layers to the map on mount and remove them on unmount.

```
RoutesLayer    → source: 'routes-source'    → layer: 'routes-line'
TracksLayer    → source: 'tracks-source'    → layer: 'tracks-line'
WaypointsLayer → source: 'waypoints-source' → layer: 'waypoints-symbols'

SlopeLayer     → source: 'slope-source' (raster, slope://{z}/{x}/{y}) → layer: 'slope-raster'
                 (inserted beneath basemap labels and all Couloir layers; see Slope Overlay)

PhotosLayer    → source: 'photos-source' (cluster: true, clusterMaxZoom: 13, clusterRadius: 50)
                 ├── 'photos-clusters'      (circle layer, filter ['has', 'point_count'])
                 ├── 'photos-cluster-count' (text layer, shows point_count)
                 └── 'photos-thumbnails'    (symbol layer, filter ['!', ['has', 'point_count']])
```

Each layer uses a GeoJSON source. When data changes in the Zustand store, the layer updates the source data via `map.getSource(id).setData(geojson)`.

Photo thumbnails are placed at the photo's position (`lat`/`lng`). Photo thumbnail icons are decoded from OPFS on demand, framed on a canvas, and registered as `photo-{id}`; until ready, a `photo-placeholder` tile is shown via `['coalesce', ['image', ['get','icon']], ['image','photo-placeholder']]`. Cluster click eases to `getClusterExpansionZoom`.

Click handlers:

- Route / track / waypoint click → `openEntity(type, id)`.
- Individual photo thumbnail click → `openEntity('photo', id)`.
- Photo cluster click → ease the map to the cluster's expansion zoom (`getClusterExpansionZoom`), so the cluster splits naturally.

---

## Photo Storage Detail

Photos are stored as blobs in OPFS alongside the SQLite database file. The SQLite `photos` table stores metadata and a `blob_ref` filename. The OPFS implementation stores blobs at predictable paths:

- `photos/{id}.jpg` — full-size, EXIF-stripped JPEG
- `photos/{id}_thumb.jpg` — thumbnail (max 128 px on longest edge)

When the app moves to cloud sync:
- The `photos` table syncs via PowerSync/ElectricSQL to Postgres.
- Blobs are uploaded to S3 on save; `blob_ref` becomes a stable S3 key.
- The OPFS blob accessor is replaced with an S3 fetcher.
- The storage interface does not change.

---

## Schema Migrations

```typescript
// src/storage/opfs.ts (sketch)

const SCHEMA_VERSION = 1

async function ensureSchema(db) {
  const current = await readSchemaVersion(db)   // 0 if table missing/empty
  if (current === 0) {
    await applyMigration(db, 1)                 // src/storage/migrations/1.sql
    await writeSchemaVersion(db, SCHEMA_VERSION)
    return
  }
  if (current === SCHEMA_VERSION) return
  if (current > SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `Database is v${current}; this build expects v${SCHEMA_VERSION}. ` +
      `Refresh or downgrade the app.`
    )
  }
  for (let v = current + 1; v <= SCHEMA_VERSION; v++) {
    await applyMigration(db, v)                 // src/storage/migrations/{v}.sql, in a transaction
    await writeSchemaVersion(db, v)
  }
}
```

**Conventions**:

- Each migration is a single `.sql` file at `src/storage/migrations/{n}.sql`, applied in numeric order.
- Each migration runs inside a transaction; partial application is impossible.
- The app's `SCHEMA_VERSION` constant is bumped in the same commit that adds a migration file.
- The `schema_version` table is single-row (PK on `version`); writing a new version replaces, not appends.

---

## Backup Format

A backup is a single ZIP archive written via `fflate` (`src/features/backup`):

```
couloir-backup-2026-05-05.zip
  manifest.json          — { bundle_version, app_version, exported_at, photo_count, total_size_bytes }
  metadata.json          — ExportBundle (entities, tags, entity_tags rows, settings)
  photos/{id}.jpg        — one full-size blob per photo
  photos/{id}_thumb.jpg  — one thumbnail per photo (regenerable on import if missing)
```

**Export** builds `metadata.json` from the entity getters (`getRoutes()`, `getTags()`, …; the `entity_tags` rows are rebuilt from each entity's hydrated `tags`), then reads photos from storage one at a time and streams everything through `fflate.Zip`. JPEGs are stored, not deflated. The ZIP goes either to a File System Access writable (`showSaveFilePicker`, Chrome/Edge), so it streams straight to disk, or, in other browsers, into an in-memory `Blob` that downloads when the archive is complete.

**Import** collects the picked file and reads it through the ZIP central directory with `fflate.unzipSync`, holding the extracted entries in memory because `importAll` takes `Map`s of every blob. It deliberately does not use the streaming `fflate.Unzip`: `fflate.Zip` writes every entry with a trailing data descriptor, and the streaming reader finds the end of such an entry by scanning for the descriptor's signature bytes, which can occur inside JPEG data and truncate a photo. Backups whose `bundle_version` is newer than `BUNDLE_VERSION` are rejected.

`StorageProvider.exportAll()` remains (the dev console's `window.__couloir.exportAll` uses it), but the backup UI doesn't. Restore does go through `importAll()`.

The Settings UI shows a pre-export size estimate ("Backup will be ~412 MB. Continue?") computed by summing photo `file_size_bytes` plus a small overhead.

**Import behavior**: additive, not destructive. For each entity in the bundle:

- If no row with this UUID exists → insert.
- If a row with this UUID exists and the bundle's `updated_at` is newer → update.
- Otherwise → skip.

Thumbnails are regenerated from full-size blobs at import time if missing from the bundle (older bundles, or bundles where the user manually trimmed the archive).

---

## Debug Logging

`CLAUDE.md` requires no `console.log` in committed code. Use the `debug()` helper instead:

```typescript
// src/utils/debug.ts
const ENABLED = typeof localStorage !== 'undefined' &&
                localStorage.getItem('couloir_debug') === '1'

export function debug(...args: unknown[]): void {
  if (ENABLED) console.log('[couloir]', ...args)
}
```

Enable from DevTools: `localStorage.setItem('couloir_debug', '1')` (then reload). No build flag, no env var. Disabled output is a no-op short-circuit.

---

## Sync-deferred items

These items are intentionally not implemented now; each is cheap to add when sync arrives:

- **`deleted_at TEXT` column** on every entity table, plus `WHERE deleted_at IS NULL` on every list query. Migration: a single `ALTER TABLE` per entity table.
- **Sync-state tracking** (per the chosen sync engine — PowerSync or ElectricSQL).
- **Multi-tab coordination** via Web Locks if multiple-tab use becomes a real workflow.

The schema *is* prepared for sync in the cheap ways (`user_id`, ISO 8601 timestamps), and the storage interface is already abstracted.

---

## Future Sync Architecture

When cloud sync is added, the recommended path is:

1. **PowerSync** or **ElectricSQL** for SQLite → Postgres sync with offline-first conflict resolution.
2. **MinIO on Unraid** (S3-compatible) or **AWS S3** for photo blob storage.
3. **Hono** on a Docker container (Unraid) as the lightweight API/auth layer.
4. A new `StorageProvider` implementation (`src/storage/sync.ts`) is injected at app root.
5. Auth is added (simple JWT or Clerk for multi-user).

No feature code changes are required — only the storage implementation, the deferred-items migration, and app-root provider injection.

---

## PWA Configuration

- `vite-plugin-pwa` (dev dependency) in `generateSW` mode, configured in `vite.config.ts`. `registerType: 'autoUpdate'`: a new build's service worker activates on the next visit.
- Workbox precaches everything the build emits that matches `**/*.{js,css,html,wasm,svg,png,webmanifest}`: `index.html`, the main JS/CSS chunks, the storage worker chunk (`assets/workerHost-*.js`), the wa-sqlite `.wasm`, the icons and the manifest. `maximumFileSizeToCacheInBytes` is raised to 6 MB so the ~1.5 MB main chunk is not skipped. `navigateFallback: '/index.html'`.
- Map tiles are **not** cached yet (post-MVP "offline tile caching"). Offline, the app opens with all its data but the basemap is blank.
- OPFS data is inherently offline-capable.
- The service worker exists only in production builds: `devOptions.enabled` is false, and `src/main.tsx` registers it via a dynamic `import('virtual:pwa-register')` behind `import.meta.env.PROD`, so the dev server and Vitest never see it.
- The plugin emits `manifest.webmanifest` (name/short_name "Couloir", `display: standalone`, theme and background `#0e1014`) and injects the `<link rel="manifest">` into `index.html`.
- Icons live in `public/icons/`. `icon.svg` is the hand-written source (full-bleed so it doubles as maskable). `icon-192.png`, `icon-512.png` (also the maskable entry) and `apple-touch-icon.png` (180 px) are rendered once from it and committed; no icon tooling is in the repo.

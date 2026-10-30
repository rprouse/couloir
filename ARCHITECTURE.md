# Couloir - Architecture

## Guiding Principles

- **Self-hosted and server-authoritative**: All data lives on a small Couloir server: one Docker container (on Unraid) serving the web app and a JSON/blob API from SQLite plus photo files on a volume. Browsers hold no entity data, so any computer on the network sees the same library and a lost browser profile loses nothing. The app is online-only; offline field use is deferred.
- **Storage abstraction**: All data access goes through a storage interface. The implementation is swappable without touching application code.
- **Sync-aware schema**: The SQLite schema is shaped so that adopting offline sync later is a code change, not a schema redesign. We pay the costs that are nearly free now and defer those that aren't (see "Deferred items" below).
- **One codebase**: The same React app runs as a desktop web app, a PWA, and (eventually) a Capacitor mobile app.

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite | Component model suits a panel-heavy map app; Vite is fast; good PWA support |
| Language | TypeScript | Type safety is worth it for a data-model-heavy app |
| Map renderer | MapLibre GL JS | Open source, Maptiler-compatible, excellent 3D terrain support |
| Terrain & tiles | Maptiler | RGB terrain tiles, satellite, topo, and winter basemaps |
| Server | Node 24 + [Hono](https://hono.dev) (`@hono/node-server`) | Small, TypeScript-first, Web-standard `Request`/`Response`; serves the SPA and `/api` from one process |
| Database | SQLite via Node's built-in `node:sqlite` | No native module to compile, no dependency; WAL mode; one file on the volume |
| Photo storage | Plain JPEG files on the server's data volume | Immutable per id, so they're cached forever by browsers and backed up with the volume |
| Deployment | Docker image on GHCR, built by GitHub Actions; Unraid template | One container, one port, one data directory |
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
├── Dockerfile                 # Multi-stage node:24-alpine image (SPA + single-file server)
├── .github/workflows/docker.yml  # Test, then publish ghcr.io/rprouse/couloir on push to main
├── deploy/unraid/couloir.xml  # Unraid container template
├── docs/DEPLOY.md             # Install, backups, HTTPS, updates, troubleshooting
├── vite.server.config.ts      # Bundles server/main.ts into dist-server/main.js
├── public/
│   └── icons/                 # App icons (icon.svg source + rendered PNGs)
├── server/                    # Node server (own tsconfig; tests use the node environment)
│   ├── main.ts                # Production entry: env → storage → app → listen; backups; SIGTERM
│   ├── app.ts                 # createApp(): the /api routes + static SPA serving
│   ├── nodeBackend.ts         # SqlBackend over node:sqlite + files under DATA_DIR
│   ├── sqlite.ts              # Loads node:sqlite via createRequire (see Server below)
│   ├── backups.ts             # Daily VACUUM INTO snapshots + retention; snapshot download
│   ├── devApp.ts / devPlugin.ts  # Mount the API inside the Vite dev server
│   └── log.ts                 # stderr logging for the container log
├── src/
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # Root component, layout shell
│   ├── storage/
│   │   ├── interface.ts       # StorageProvider interface (the abstraction)
│   │   ├── errors.ts          # SchemaVersionError, StorageNotInitializedError
│   │   ├── provider.ts        # getStorage / setStorage DI seam
│   │   ├── http.ts            # HttpStorageProvider: the browser's provider, over /api
│   │   ├── sqlProvider.ts     # SqlStorageProvider: all of Couloir's SQL, over a SqlBackend
│   │   ├── sqlBackend.ts      # SqlBackend interface + SqlValue/SqlRow/SqlOp
│   │   ├── schema.ts          # ensureSchema(): runs pending migrations
│   │   ├── memory.ts          # InMemoryStorageProvider (used by tests)
│   │   ├── contract.ts        # storageContract(): the shared suite every provider passes
│   │   └── migrations/
│   │       ├── 1.sql … 4.sql  # Schema migrations (the source of truth)
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
│   │   ├── atesAreas.ts       # Imported ATES areas: load, importFile, remove
│   │   └── ui.ts              # Panel state, placement state, layer toggles, etc.
│   ├── icons/
│   │   ├── waypointIcons.ts   # Waypoint icon catalogue, swatches, style resolution, marker image ids
│   │   ├── symbolPaths.ts     # GENERATED Material Symbols path data (scripts/fetch-material-symbols.mjs)
│   │   ├── WaypointBadge.tsx  # The waypoint marker as a DOM element (panels)
│   │   └── LICENSE-material-symbols.txt
│   ├── map/
│   │   ├── MapView.tsx        # MapLibre GL JS wrapper
│   │   ├── layers/
│   │   │   ├── RoutesLayer.tsx
│   │   │   ├── TracksLayer.tsx
│   │   │   ├── WaypointsLayer.tsx # + wpIcons.ts: draws marker images on demand
│   │   │   ├── PhotosLayer.tsx
│   │   │   ├── TerrainOverlayLayer.tsx # Raster slope/aspect overlay (slope://, aspect:// tiles)
│   │   │   └── AtesLayer.tsx  # ATES zones + click popup; atesLayerData.ts, atesPopup.ts
│   │   ├── slope/
│   │   │   ├── slopeMath.ts    # terrain-rgb decode, ground resolution, Horn gradient, slope, aspect
│   │   │   ├── slopeBands.ts   # Avalanche angle bands + RGBA colouring
│   │   │   ├── aspectBands.ts  # Eight compass sectors + RGBA colouring
│   │   │   ├── overlayProtocol.ts # slope:// and aspect:// MapLibre protocols (DEM fetch → PNG)
│   │   │   └── browserCodec.ts # createImageBitmap / OffscreenCanvas decode+encode
│   │   ├── controls/
│   │   │   ├── TerrainControl.tsx # 3D terrain switch + Off/Slope/Aspect overlay picker
│   │   │   ├── OverlayLegend.tsx  # Slope bands or aspect compass rose
│   │   │   ├── AtesLegend.tsx     # ATES class swatches + exposure-not-danger caveat
│   │   │   ├── NavigationAid.tsx  # Centre crosshair + lat/lng, elevation, bearing readout
│   │   │   ├── LocateControl.tsx  # GPS toggle: centre on the user once, then a moving dot
│   │   │   └── BasemapControl.tsx
│   │   ├── navigation.ts      # Reads the map centre for NavigationAid
│   │   └── mapConfig.ts       # Maptiler styles, source definitions
│   ├── panels/
│   │   ├── LayerPanel/        # Layer toggles, item counts, filter by tag
│   │   ├── DetailPanel/       # Route/track/waypoint/photo view/edit/create
│   │   ├── SettingsPanel/     # API key, map defaults, ATES areas, export/import, tags
│   │   └── SearchPanel/       # Global search
│   ├── features/
│   │   ├── routes/            # Route import, form, list
│   │   ├── tracks/            # Track import, form, list
│   │   ├── waypoints/         # Waypoint creation, form
│   │   ├── photos/            # Photo upload, EXIF processing, placement, viewer
│   │   ├── convert/           # Route ↔ track conversion from the edit form (takes the new type's default colour)
│   │   ├── ates/              # ATES KMZ import (atesImport.ts) and its toast/layer/framing (runAtesImport.ts)
│   │   └── backup/            # ZIP backup read/write via fflate
│   ├── components/
│   │   ├── ElevationProfile/  # Recharts elevation chart; hover marks the point on the map (layers/ProfileHoverMarker.tsx)
│   │   ├── TagPicker/
│   │   └── FileDropzone/
│   ├── hooks/
│   │   ├── useStorage.ts      # Storage provider hook
│   │   ├── useMap.ts          # MapLibre map instance access
│   │   ├── useGpx.ts          # GPX parsing hook
│   │   └── useEscapeKey.ts    # Global ESC handler with placement/edit/close precedence
│   ├── utils/
│   │   ├── gpx.ts             # GPX parser
│   │   ├── atesKml.ts         # Avalanche Canada ATES KMZ/KML reader
│   │   ├── exif.ts            # EXIF reading (orientation, GPS, bearing, altitude, date)
│   │   ├── image.ts           # Re-encode JPEG with applied orientation, generate thumbnails
│   │   ├── hash.ts            # SHA-256 of bytes (for source_hash); pure-JS fallback off HTTPS
│   │   ├── id.ts              # newId(): UUID v4, with a fallback off HTTPS
│   │   ├── geo.ts             # Coordinate utilities, distance, elevation
│   │   ├── format.ts          # Distance, elevation, duration formatting; isValidHex
│   │   └── debug.ts           # Debug-logging helper, gated by localStorage flag
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

  // ATES areas (Phase 12): listed by name (case-insensitive) with full geometry; not tagged
  getAtesAreas(): Promise<AtesArea[]>
  saveAtesArea(area: AtesArea): Promise<void>   // insert or replace by id
  deleteAtesArea(id: string): Promise<void>

  // Backup
  exportAll(): Promise<{ bundle: ExportBundle; photos: Map<string, Blob>; thumbs: Map<string, Blob> }>
  importAll(bundle: ExportBundle, photos: Map<string, Blob>, thumbs: Map<string, Blob>): Promise<void>
}
```

### Implementations

```
browser                                   server
HttpStorageProvider ── fetch /api/* ──▶  Hono app (server/app.ts)
                                            │
                                            ▼
                                         SqlStorageProvider ── SqlBackend ──▶ NodeSqlBackend
                                         (src/storage/sqlProvider.ts)         node:sqlite + files
```

- **`HttpStorageProvider`** (`src/storage/http.ts`) is the only provider the app uses. It maps each method to an `/api` call: 404 on a read becomes `null`, other failures throw `HttpStorageError` with the server's message, and an unreachable server or a server schema newer than the build fails `init()` clearly. `exportAll` assembles the bundle from the list endpoints; the server has no export endpoint, because it would have to load every blob to answer one.
- **`SqlStorageProvider`** (`src/storage/sqlProvider.ts`) is the only code that contains SQL. It runs `ensureSchema` in `init()` and talks to a `SqlBackend` (`all`/`one`/`run`/`tx` plus blob read/write/delete).
- **`NodeSqlBackend`** (`server/nodeBackend.ts`) implements `SqlBackend` on `node:sqlite` and the filesystem under `DATA_DIR`.
- **`InMemoryStorageProvider`** (`src/storage/memory.ts`) backs most unit tests.

All four run the same `storageContract()` suite (`src/storage/contract.ts`). `server/httpProvider.test.ts` runs it end to end: `HttpStorageProvider` → the Hono app in-process (via `app.fetch`, no network) → `SqlStorageProvider` → `node:sqlite` in a temp directory.

`updatePhotoMetadata` rewrites only the row and tag junction rows; it never touches the stored photo files. All photo edits (including drag-to-reposition) use it.

**Notable absences**: there are no `linkPhotoToRoute` / `linkPhotoToTrack` / `unlinkPhoto` methods. Photos do not link to routes, tracks, or waypoints; spatial proximity on the map is the relationship.

---

## Server

One Node process serves the built SPA and the API (`server/main.ts`, bundled by `vite.server.config.ts` into `dist-server/main.js` with its dependencies inlined, so the Docker image carries no `node_modules`). In development, `server/devPlugin.ts` mounts the same API inside the Vite dev server, so `npm run dev` is still one process on one port, with data in `./data`.

### Data directory

```
DATA_DIR (/data in Docker)
├── couloir.db             SQLite, WAL mode, foreign keys on
├── photos/{id}.jpg        full-size photo
├── photos/{id}_thumb.jpg  thumbnail
└── backups/couloir-YYYYMMDD.db   daily snapshots
```

### API

One route per `StorageProvider` method. Writes return `204`; missing entities and blobs `404 { error }`; bad input `400 { error }`; anything else `500 { error }`, logged to stderr.

| Method | Path | |
|---|---|---|
| GET | `/api/health` | `{ ok, schemaVersion }` |
| GET | `/api/config` | `{ maptilerKey }` from `MAPTILER_KEY`, or null |
| GET / PUT / DELETE | `/api/routes[/:id]`, `/api/tracks[/:id]`, `/api/waypoints[/:id]` | list / read / upsert / delete |
| GET | `/api/routes/by-hash/:hash`, `/api/tracks/by-hash/:hash` | duplicate detection |
| GET | `/api/photos[/:id]`, `/api/photos/:id/full`, `/api/photos/:id/thumb` | metadata and JPEGs |
| PUT | `/api/photos/:id` | new photo: multipart `photo` (JSON) + `full` + `thumb` |
| PATCH | `/api/photos/:id` | metadata and tags only |
| GET / PUT / DELETE | `/api/tags[/:id]` | |
| GET / PUT / DELETE | `/api/ates-areas[/:id]` | list (with geometry) / upsert / delete |
| PUT | `/api/entity-tags/:type/:id` | `{ tagIds }` |
| POST | `/api/import` | backup restore: multipart `bundle` + `full:{id}` / `thumb:{id}` files |
| GET | `/api/backup/db` | a fresh database snapshot as a download |

- **IDs** must match `^[A-Za-z0-9_-]{1,64}$` before they reach storage, since they become file names; the backend also refuses any blob path that resolves outside `DATA_DIR`. A `PUT` body's `id` must match the URL.
- **Caching**: photo JPEGs are immutable per id (`Cache-Control: immutable`). Hashed `/assets/*` bundles are immutable; `index.html`, `sw.js` and the manifest are `no-cache`. Extension-less paths fall back to `index.html`.
- **Concurrency**: one SQLite connection serves every request, so `NodeSqlBackend.tx()` is synchronous from `BEGIN` to `COMMIT`: an `await` inside it would let another request's statements join the transaction. Writes are last-write-wins.
- **`node:sqlite` is loaded through `createRequire`** (`server/sqlite.ts`). Vitest 2's module runner strips the `node:` prefix from every builtin except `node:test`, so `import 'node:sqlite'` fails under test. Import `DatabaseSync` from `./sqlite`, never from `node:sqlite`.
- **Shutdown**: on SIGTERM/SIGINT the server stops accepting connections, waits for in-flight requests and any running snapshot (up to 5 s), then closes the database, which checkpoints the WAL.

### Backups

At startup and every 24 hours, `VACUUM INTO` writes `backups/couloir-YYYYMMDD.db` (UTC date) via a temp file and rename; the newest `BACKUP_KEEP` (default 14) are kept. A tick that arrives while a snapshot is running is skipped. Photos are not in the snapshots: they're immutable files covered by backing up the volume. The ZIP export (below) is the all-in-one copy.

### Plain HTTP

Browsers only provide some APIs in secure contexts (HTTPS or localhost), and on a LAN address like `http://unraid:8080` they are missing. The app works there anyway: `newId()` builds UUIDs from `getRandomValues` when `crypto.randomUUID` is absent, `sha256Hex` falls back to a pure-JS SHA-256 when `crypto.subtle` is absent (identical digests), and service-worker registration failure is ignored (the app just can't be installed). Any new use of a secure-context-only API needs the same treatment. HTTPS options (Tailscale, reverse proxy) are in `docs/DEPLOY.md`.

There is no authentication. The server is meant for a home network or tailnet only.

---

## Maptiler Integration

The key in effect is the browser's own key, stored in `localStorage` under `couloir_maptiler_key`, or failing that the server's `MAPTILER_KEY`, fetched from `/api/config` at startup and held in memory only (so a change on the server applies on reload). The settings store exposes the effective `maptilerKey` plus `maptilerKeySource` (`'local' | 'server'`); Settings labels a server key and offers "Use server key" to drop a local override. The key is injected into all map style URLs and terrain source URLs.

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

### Terrain Overlays

Slope-angle and aspect shading are computed in the browser from the same terrain-rgb tiles as 3D terrain. No third-party slope tiles are involved. At most one overlay shows at a time: two opaque colour schemes on top of each other are unreadable.

- `main.tsx` registers two MapLibre custom protocols, `slope://{z}/{x}/{y}` and `aspect://{z}/{x}/{y}` (`src/map/slope/overlayProtocol.ts`). Both use one loader, so they share the `tiles.json` lookup. The handler reads the Maptiler key live from the settings store.
- For each tile, it looks up the DEM tile URL template from `terrain-rgb-v2/tiles.json`. This is fetched once per key and cached; a failed lookup is dropped from the cache so the next tile retries. It then fetches the matching DEM tile, using MapLibre's abort signal.
- Decode: `elevation = -10000 + (R·65536 + G·256 + B) · 0.1`. `createImageBitmap` is called with `colorSpaceConversion: 'none'` so colour management can't alter the encoded elevations.
- Gradient: Horn's 3×3 method, computed once per tile; slope and aspect both derive from it. Ground pixel size comes from the tile's centre latitude. Pixels past the tile edge are linearly extrapolated, so seams stay minimal without fetching neighbouring tiles.
- Colours (`SLOPE_BANDS`): 12–24° green, 25–29° yellow, 30–34° orange, 35–39° red, 40–44° purple, 45°+ blue. Below 12° is transparent. The colours are literal hex because they're painted into pixels.
- Aspect is the compass bearing the slope faces (downhill direction), coloured in eight 45° sectors (`ASPECT_SECTORS`): N red, NE orange, E yellow, SE green, S teal, SW blue, W violet, NW magenta. Pixels flatter than 12° (`ASPECT_MIN_SLOPE_DEG`, the first slope band) are transparent. The legend is a compass rose.
- DEM 404/204 returns a transparent tile, so it doesn't trip the tile-error monitor. Other HTTP errors are thrown and count toward the banner.
- `TerrainOverlayLayer` (one instance per overlay) adds a `raster` source (`tileSize` 512, minzoom 10, maxzoom 14; MapLibre stretches tiles above that). Its layer goes before the first layer that is either a basemap `symbol` layer or a Couloir layer, so it sits under the labels and under our own data. The layer is always installed; toggling only changes `visibility`.
- Off by default, since every overlay tile costs a Maptiler request. The map control picks Off / Slope / Aspect; the shared opacity is set in Settings. Both are saved in `localStorage` (`couloir_terrain_overlay`, `couloir_overlay_opacity`).
- Accuracy: the DEM is roughly 30 m, so short steep features (cliff bands, rolls, gully walls) read lower than reality. The legend says so.

### ATES Ratings

Avalanche Canada's ATES ratings are imported from the per-area KMZ files its Trip Planner offers ("Download ATES data as KMZ", behind a usage and disclaimer dialog). Avalanche Canada has no public ATES API or tile service. Couloir only reads files the user downloads, and never calls Avalanche Canada's endpoints.

- **Reading** (`src/utils/atesKml.ts`): `readKmz` unzips with `fflate` and takes `doc.kml` (or the first `.kml`); `parseAtesKml` reads it with `DOMParser`. Placemarks are typed by `styleUrl`: `area_styles` is the boundary, `zone_{green,blue,black}_style` are Simple/Challenging/Complex zones, `ates_line_*` are rated lines, plus `avalanche_path_styles`, `decision_point_styles`, `access_road_styles` (access routes) and `point_of_interest_{parking,cabin,destination,other}_styles` (points of interest; an unknown type becomes `other`). A zone whose style isn't recognised takes its class from the enclosing `Class N – …` folder (0 = non-avalanche, 4 = extreme); one with neither is skipped and counted. The KMZ's icons are dropped: points of interest are drawn as waypoint-style markers (`wp:<icon>:<HEX>` images, `ATES_POI_ICONS`). `MultiGeometry` becomes one feature per part; altitude is dropped.
- **Import** (`src/features/ates`): `importAtesKmz` saves the area. Re-importing an area with the same name (ignoring case) replaces it in place, keeping its id and `imported_at`, because Avalanche Canada revises ratings. `runAtesImport` (from Settings or a `.kmz` dropped on the map) toasts each outcome, turns the layer on and frames the last area.
- **Layer**: `AtesLayer` draws every area from one GeoJSON source (attribution "ATES ratings © Avalanche Canada"). Its layers are inserted before the first basemap `symbol` layer or Couloir entity layer, so they sit above the slope/aspect raster (which goes under all Couloir layers, ATES included) and below routes, tracks, waypoints and photos. Fill colours are fixed per class (`ATES_CLASS_COLORS`), not taken from the KML.
- **Controls**: a separate ATES switch in the terrain control (shown once an area exists) with a legend of the classes present and the caveat that ATES rates exposure, not today's danger. Its fill opacity is set in Settings. Both are saved in `localStorage` (`couloir_ates_enabled`, default on; `couloir_ates_opacity`, default 0.45).
- **Click**: one map-wide `click` handler. It does nothing in placement mode or when the layer is off, and stands aside when the click hit a route, track, waypoint or photo, whose own handlers open the entity. Otherwise it opens a MapLibre popup for what's under the cursor, preferring a point of interest, then a decision point, an access route and finally a zone (area, class, definition), built with `textContent` because the strings come from an imported file.

### Error handling

API key and tile failures are surfaced explicitly rather than producing a silent dark map:

1. **Startup style fetch**: when loading a basemap style URL, a non-2xx response surfaces an inline error message ("Couldn't load Maptiler style — your key may be invalid or revoked") and auto-opens the Settings panel with the key field focused.
2. **Runtime tile errors**: subscribe to MapLibre's `error` event. If three or more tile errors occur within a 10-second rolling window, show a non-modal banner at the top of the map area: "Tile loading is failing — your key may be invalid or over quota. Open Settings."
3. **Key change**: when the user updates the key in Settings, re-create the map sources in place (no full page reload). The active basemap and all custom layers persist.

The error banner is dismissable but reappears if errors continue.

---

## State Management

Zustand is used for all application state. The store is divided into slices:

- **routes, tracks, waypoints, photos, tags, atesAreas**: mirror the storage layer. Each slice loads on app startup, and mutations call through to the storage provider then update local state.
- **ui**: panel state, placement state, layer visibility toggles, active basemap, terrain exaggeration, terrain overlay choice (off/slope/aspect) and its opacity, the ATES switch and its opacity, error banner state.

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

TerrainOverlayLayer (one per overlay)
               → source: 'slope-source' (raster, slope://{z}/{x}/{y}) → layer: 'slope-raster'
               → source: 'aspect-source' (raster, aspect://{z}/{x}/{y}) → layer: 'aspect-raster'
                 (inserted beneath basemap labels and all Couloir layers; see Terrain Overlays)

AtesLayer      → source: 'ates-source' (every imported area; see ATES Ratings)
                 ├── 'ates-fill'            (fill, zones, class colour, atesOpacity)
                 ├── 'ates-outline'         (line, zones, light 1 px edge)
                 ├── 'ates-area'            (line, area boundary, white dashed)
                 ├── 'ates-access'          (line, access routes, yellow)
                 ├── 'ates-paths'           (line, avalanche paths, red)
                 ├── 'ates-path-arrows'     (symbol, line-center arrow pointing downslope)
                 ├── 'ates-lines'           (line, rated lines, class colour)
                 ├── 'ates-decision-points' (circle, amber)
                 └── 'ates-poi'             (symbol, points of interest as wp: markers: parking green, hut blue, destination orange, other violet)
                 (above the terrain overlays, beneath basemap labels and the entity layers)

PhotosLayer    → source: 'photos-source' (unclustered)
                 ├── 'photos-arrows' (symbol layer, minzoom 14, filter ['has', 'bearing'],
                 │                    'photo-arrow' image rotated by bearing, map-aligned)
                 └── 'photos-dots'   (circle layer, blue with white ring, radius grows with zoom)
```

Each layer uses a GeoJSON source. When data changes in the Zustand store, the layer updates the source data via `map.getSource(id).setData(geojson)`.

Waypoint markers are drawn on demand. Each feature carries an `image` property naming its marker as `wp:<icon>:<HEX>` (e.g. `wp:cabin:22C55E`), from `resolveWaypointStyle()`: the waypoint's own `icon`/`color`, else its category's. The symbol layer's `icon-image` is `['get', 'image']`. When MapLibre meets an image it doesn't have, it fires `styleimagemissing`, and `WaypointsLayer` parses the id and registers a disc in that colour with the white Material Symbol glyph (`buildWaypointIcon`, drawn at 2× with `pixelRatio: 2`). Ids it didn't make are ignored. That covers every icon/colour combination without pre-registering them, and restores them after a basemap switch clears the style's images.

Waypoint icons are vendored Material Symbols (Rounded, filled, Apache 2.0), not an npm package. `scripts/fetch-material-symbols.mjs` downloads the chosen symbols from a pinned `google/material-design-icons` commit and writes their SVG path data to `src/icons/symbolPaths.ts`. The same paths draw the map markers (canvas `Path2D`) and the panel badges and picker (inline SVG).

Photo thumbnails are placed at the photo's position (`lat`/`lng`). Photo thumbnail icons are fetched from the server on demand, framed on a canvas, and registered as `photo-{id}`; until ready, a `photo-placeholder` tile is shown via `['coalesce', ['image', ['get','icon']], ['image','photo-placeholder']]`. Cluster click eases to `getClusterExpansionZoom`.

Click handlers:

- Route / track / waypoint click → `openEntity(type, id)`.
- Individual photo thumbnail click → `openEntity('photo', id)`.
- Photo cluster click → ease the map to the cluster's expansion zoom (`getClusterExpansionZoom`), so the cluster splits naturally.
- ATES zone, point of interest, decision point or access route click → popup, unless an entity layer was hit too (see ATES Ratings).

---

## Photo Storage Detail

Photos are stored as files on the server, under `DATA_DIR` beside the SQLite database. The SQLite `photos` table stores metadata and a `blob_ref` filename. Blobs live at predictable paths:

- `photos/{id}.jpg` — full-size, EXIF-stripped JPEG
- `photos/{id}_thumb.jpg` — thumbnail (max 128 px on longest edge)

The browser uploads both in one multipart `PUT /api/photos/:id` and reads them from `/api/photos/:id/full` and `/thumb`. Writes go to a temp file and are renamed into place, so a crash never leaves a truncated photo. Photos never change after upload, so browsers cache them indefinitely.

---

## Schema Migrations

`ensureSchema(db)` (`src/storage/schema.ts`) runs from `SqlStorageProvider.init()` when the server starts. It reads the current version (0 for a fresh database), applies each pending `src/storage/migrations/{n}.sql` in its own transaction, and throws `SchemaVersionError` if the database is newer than the build, so the server refuses to start rather than run an older build on a newer schema. The browser checks too: `HttpStorageProvider.init()` throws `SchemaVersionError` if `/api/health` reports a schema newer than its own `SCHEMA_VERSION` (a stale cached app; reloading fixes it).

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
  metadata.json          — ExportBundle (entities, tags, entity_tags rows, ATES areas)
  photos/{id}.jpg        — one full-size blob per photo
  photos/{id}_thumb.jpg  — one thumbnail per photo (regenerable on import if missing)
```

**Export** builds `metadata.json` from the entity getters (`getRoutes()`, `getTags()`, …; the `entity_tags` rows are rebuilt from each entity's hydrated `tags`), then reads photos from storage one at a time and streams everything through `fflate.Zip`. JPEGs are stored, not deflated. The ZIP goes either to a File System Access writable (`showSaveFilePicker`, Chrome/Edge), so it streams straight to disk, or, in other browsers, into an in-memory `Blob` that downloads when the archive is complete.

**Import** collects the picked file and reads it through the ZIP central directory with `fflate.unzipSync`, holding the extracted entries in memory because `importAll` takes `Map`s of every blob. It deliberately does not use the streaming `fflate.Unzip`: `fflate.Zip` writes every entry with a trailing data descriptor, and the streaming reader finds the end of such an entry by scanning for the descriptor's signature bytes, which can occur inside JPEG data and truncate a photo. Backups whose `bundle_version` is newer than `BUNDLE_VERSION` are rejected. `BUNDLE_VERSION` is 2: version 2 added `ates_areas`, which version 1 backups lack (they restore with existing areas untouched).

`StorageProvider.exportAll()` remains (the dev console's `window.__couloir.exportAll` uses it), but the backup UI doesn't. Restore does go through `importAll()`, which `HttpStorageProvider` sends as one multipart `POST /api/import`; the server applies it with `SqlStorageProvider.importAll`.

The Settings UI shows a pre-export size estimate ("Backup will be ~412 MB. Continue?") computed by summing photo `file_size_bytes` plus a small overhead.

**Import behavior**: additive, not destructive. For each entity in the bundle:

- If no row with this UUID exists → insert.
- If a row with this UUID exists and the bundle's `updated_at` is newer → update.
- Otherwise → skip.

ATES areas follow the same newer-`updated_at`-wins rule.

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

## Deferred items

Intentionally not implemented yet; each has a clear path:

- **Authentication and multiple users.** Every entity row already has `user_id` (`'local'` today). The planned route is forward-auth in front of the container (Authelia, Authentik or Tailscale identity) passing a `Remote-User` header, with the server filtering by `user_id`. The server would never handle passwords.
- **Stale-write detection.** Writes are last-write-wins. If two computers editing the same item becomes a real problem, the client sends the `updated_at` it loaded and the server answers `409` when the row has moved on.
- **Offline use in the field.** The app is online-only. Options, cheapest first: a read-only cache of `/api` GETs and map tiles in the service worker; or local-first storage with two-way sync to the server, which would need `deleted_at` tombstones (one `ALTER TABLE` per entity table plus `WHERE deleted_at IS NULL` on list queries) and per-device sync cursors.

The schema is prepared in the cheap ways (`user_id`, client-generated UUIDs, ISO 8601 `updated_at`), and the storage interface is abstracted, so none of these needs feature-code changes.

---

## PWA Configuration

- `vite-plugin-pwa` (dev dependency) in `generateSW` mode, configured in `vite.config.ts`. `registerType: 'autoUpdate'`: a new build's service worker activates on the next visit.
- Workbox precaches everything the build emits that matches `**/*.{js,css,html,svg,png,webmanifest}`: `index.html`, the main JS/CSS chunks, the icons and the manifest. `maximumFileSizeToCacheInBytes` is raised to 4 MB because the ~1.5 MB main chunk (mostly MapLibre) is close to Workbox's 2 MB default, which would silently drop it. `navigateFallback: '/index.html'`, with `navigateFallbackDenylist: [/^\/api\//]` so the shell never answers for the API.
- Neither `/api` data nor map tiles are cached, so the cached shell can start offline but has no data until the server is reachable (see "Deferred items").
- The service worker exists only in production builds: `devOptions.enabled` is false, and `src/main.tsx` registers it via a dynamic `import('virtual:pwa-register')` behind `import.meta.env.PROD`, so the dev server and Vitest never see it. Registration fails on plain-HTTP origins and that failure is ignored.
- The plugin emits `manifest.webmanifest` (name/short_name "Couloir", `display: standalone`, theme and background `#0e1014`) and injects the `<link rel="manifest">` into `index.html`.
- Icons live in `public/icons/`. `icon.svg` is the hand-written source (full-bleed so it doubles as maskable). `icon-192.png`, `icon-512.png` (also the maskable entry) and `apple-touch-icon.png` (180 px) are rendered once from it and committed; no icon tooling is in the repo.

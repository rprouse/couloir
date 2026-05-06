# Couloir - MVP Task List

## How to Use This Document

Feed tasks to Claude Code one phase at a time. Complete all tasks in a phase and verify them before moving to the next phase. Each task has clear acceptance criteria so you know when it is done.

Before starting any session, ask Claude Code to read `SPEC.md`, `ARCHITECTURE.md`, and `DATA-MODEL.md` first.

---

## Progress

Tick each task as it's completed. **The first unchecked item is the current task.** Update this list with `- [x]` immediately after a task is finished.

Implementation plans for each phase are written just-in-time and live in `docs/superpowers/plans/`. Each plan contains bite-sized step checkboxes; tick those as you work through them.

### Phase 1 — Project Shell  ·  Plan: [`2026-05-05-couloir-phase-1-project-shell.md`](docs/superpowers/plans/2026-05-05-couloir-phase-1-project-shell.md)

- [ ] [1.1 Scaffold the project](#task-11---scaffold-the-project)
- [ ] [1.2 App layout shell](#task-12---app-layout-shell)
- [ ] [1.3 MapLibre map with Maptiler](#task-13---maplibre-map-with-maptiler)
- [ ] [1.4 3D terrain](#task-14---3d-terrain)
- [ ] [1.5 Basemap switcher](#task-15---basemap-switcher)
- [ ] [1.6 Settings panel](#task-16---settings-panel)
- [ ] [1.7 Layer panel scaffold](#task-17---layer-panel-scaffold)

### Phase 2 — Storage Foundation  ·  Plan: not yet written

- [ ] [2.1 wa-sqlite setup](#task-21---wa-sqlite-setup)
- [ ] [2.2 Route and track CRUD](#task-22---route-and-track-crud)
- [ ] [2.3 Waypoint and photo CRUD](#task-23---waypoint-and-photo-crud)
- [ ] [2.4 Tags and backup](#task-24---tags-and-backup)
- [ ] [2.5 Zustand store wiring](#task-25---zustand-store-wiring)

### Phase 3 — Routes and Tracks  ·  Plan: not yet written

- [ ] [3.1 GPX parser](#task-31---gpx-parser)
- [ ] [3.2 GPX import UI](#task-32---gpx-import-ui)
- [ ] [3.3 Routes layer](#task-33---routes-layer)
- [ ] [3.4 Tracks layer](#task-34---tracks-layer)
- [ ] [3.5 Route detail panel](#task-35---route-detail-panel)
- [ ] [3.6 Track detail panel](#task-36---track-detail-panel)
- [ ] [3.7 Layer panel counts](#task-37---layer-panel-counts)

### Phase 4 — Waypoints  ·  Plan: not yet written

- [ ] [4.1 Waypoint placement mode](#task-41---waypoint-placement-mode)
- [ ] [4.2 Waypoint creation form](#task-42---waypoint-creation-form)
- [ ] [4.3 Waypoints layer](#task-43---waypoints-layer)
- [ ] [4.4 Waypoint detail panel](#task-44---waypoint-detail-panel)
- [ ] [4.5 Waypoint count badge](#task-45---waypoint-count-badge)

### Phase 5 — Photos  ·  Plan: not yet written

- [ ] [5.1 Photo placement mode and EXIF processing](#task-51---photo-placement-mode-and-exif-processing)
- [ ] [5.2 Photo creation form](#task-52---photo-creation-form)
- [ ] [5.3 Photos layer with clustering](#task-53---photos-layer-with-clustering)
- [ ] [5.4 Photo viewer](#task-54---photo-viewer)
- [ ] [5.5 Photo count badge](#task-55---photo-count-badge)

### Phase 6 — Polish and MVP Completion  ·  Plan: not yet written

- [ ] [6.1 Tag management](#task-61---tag-management)
- [ ] [6.2 Tag filtering](#task-62---tag-filtering)
- [ ] [6.3 Global search](#task-63---global-search)
- [ ] [6.4 Export and import (ZIP backup)](#task-64---export-and-import-zip-backup)
- [ ] [6.5 PWA manifest and icons](#task-65---pwa-manifest-and-icons)
- [ ] [6.6 Mobile layout](#task-66---mobile-layout)
- [ ] [6.7 Empty states and onboarding](#task-67---empty-states-and-onboarding)
- [ ] [6.8 Final QA pass](#task-68---final-qa-pass)

---

## Phase 1 - Project Shell

**Goal**: A running Vite + React app with MapLibre rendering a 3D Maptiler map. No data yet. Just the skeleton.

### Task 1.1 - Scaffold the project

Create a new Vite + React + TypeScript project named `couloir`. Install dependencies:
- `maplibre-gl`
- `zustand`
- `recharts`
- `vite-plugin-pwa`

Set up the folder structure as defined in `ARCHITECTURE.md`. Create empty placeholder files for all modules so imports resolve.

**Acceptance criteria**:
- `npm run dev` starts without errors
- No TypeScript errors
- Folder structure matches ARCHITECTURE.md

### Task 1.2 - App layout shell

Create the main layout: a full-viewport map area with a collapsible left sidebar panel and a top bar. Dark theme using CSS custom properties. No map yet - use a dark placeholder div.

The sidebar should have three icon tabs: Layers, Search, Settings. Clicking a tab opens the corresponding panel. The sidebar can be collapsed to just icons.

**Acceptance criteria**:
- Layout renders correctly on desktop (1280px+) and mobile (375px)
- Sidebar collapses and expands
- Tab switching works
- Dark theme applied consistently

### Task 1.3 - MapLibre map with Maptiler

Implement `MapView.tsx`. If no Maptiler API key is in localStorage, show the Settings panel with a prompt to enter the key. Once a key is set, initialize the MapLibre map with the Outdoor basemap.

Add:
- Zoom and compass controls
- Pitch reset button (returns to 0° pitch, north-up)
- The map fills the remaining viewport after the sidebar

Implement Maptiler error handling per `ARCHITECTURE.md`:
- A non-2xx response on the basemap style fetch surfaces an inline error and auto-opens the Settings panel with the key field focused.
- Subscribe to MapLibre's `error` event; if 3+ tile errors occur within a 10s rolling window, show a non-modal dismissable banner above the map.
- When the user changes the key in Settings, re-create map sources without a full page reload.

**Acceptance criteria**:
- Map renders with Outdoor basemap when a valid API key is entered
- Settings panel shown automatically if no key is set
- Invalid/revoked key produces an inline error and reopens Settings
- Sustained tile failures show the banner; banner dismisses but reappears if errors continue
- Controls render and function
- Map resizes correctly when sidebar is toggled
- Changing the key in Settings rebinds sources without a reload

### Task 1.4 - 3D terrain

Enable Maptiler terrain on the map. Add a terrain toggle button and an exaggeration slider (range 1.0 to 3.0, default 1.5). Store the exaggeration value in the UI Zustand slice. The terrain exaggeration persists in localStorage.

**Acceptance criteria**:
- 3D terrain renders and responds to exaggeration slider
- Toggle button enables/disables terrain
- Exaggeration value persists across page reloads

### Task 1.5 - Basemap switcher

Add a basemap switcher control on the map (not in the sidebar - inline on the map). Options: Satellite, Outdoor, Winter. Switching basemaps reloads the map style while preserving all custom sources and layers (MapLibre style diffing or manual source re-add). Active basemap persists in localStorage.

**Acceptance criteria**:
- All three basemaps load correctly
- Switching basemaps does not lose map position or zoom
- Active basemap persists across reloads

### Task 1.6 - Settings panel

Implement the Settings panel with:
- Maptiler API key field (input + save button, shows masked value when set)
- Map defaults: center lat/lng, zoom (editable, with a "use current map position" button)
- Terrain exaggeration default
- App version display

**Acceptance criteria**:
- API key saves to localStorage and reloads the map immediately
- Map position defaults save and are applied on next cold load
- All fields persist across page reloads

### Task 1.7 - Layer panel scaffold

Implement the Layer panel with four toggle rows: Routes, Tracks, Waypoints, Photos. Each row has a visibility toggle, a color swatch, and a count badge showing `0`. Toggles connect to the UI Zustand slice but have no map effect yet (no layers exist).

**Acceptance criteria**:
- Layer panel renders with four rows
- Toggles function and update Zustand state
- Count badges show 0

---

## Phase 2 - Storage Foundation

**Goal**: SQLite running in OPFS with all CRUD operations working. No UI for data yet - just the storage layer verified to work.

### Task 2.1 - wa-sqlite setup

Install `wa-sqlite`. Implement `src/storage/opfs.ts` as the `StorageProvider` interface, using the `OPFSCoopSyncVFS` backend (does not require COOP/COEP cross-origin-isolation headers). On app startup, open (or create) the SQLite database file in OPFS at `couloir.db`.

Implement the migration framework described in `ARCHITECTURE.md`:
- Migrations live at `src/storage/migrations/{n}.sql` and are applied in numeric order.
- `SCHEMA_VERSION = 1` constant; only `1.sql` exists at this point.
- `ensureSchema()` reads the current version and applies pending migrations in transactions.
- If the DB version is greater than `SCHEMA_VERSION`, throw `SchemaVersionError`.
- The `schema_version` table has a single row with `version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL`.

**Acceptance criteria**:
- Database file created in OPFS on first load
- `1.sql` applies without errors
- `schema_version` table contains exactly one row with `version = 1`
- Reopening the app does not re-run the migration
- Manually setting `schema_version.version` to `2` triggers `SchemaVersionError` on next load
- No errors in console on startup

### Task 2.2 - Route and track CRUD

Implement all `StorageProvider` methods for routes and tracks per the interface in `ARCHITECTURE.md`. Routes carry `ates`, `technical_difficulty`, `source_hash`, `source_filename`, `user_id`, and ISO 8601 `created_at`/`updated_at`; tracks carry the same plus `duration_s` and `moving_time_s`. Neither stores raw GPX XML.

Implement `getRouteBySourceHash()` and `getTrackBySourceHash()` for the duplicate-import-detection flow described in `ARCHITECTURE.md`.

Write a test harness (a temporary browser console helper or a `__dev__` panel hidden behind a keyboard shortcut) that lets you:
- Create a dummy route with fake GeoJSON, a fake `source_hash`, and ATES/technical values
- Read it back
- Update its name (verify `updated_at` advances)
- Look it up by `source_hash`
- Delete it

**Acceptance criteria**:
- All CRUD operations work without errors
- `created_at` and `updated_at` are ISO 8601 strings set by app code, not SQL defaults
- `getRouteBySourceHash()` and `getTrackBySourceHash()` return the right row or null
- Data persists across page reloads
- No data loss on repeated open/close

### Task 2.3 - Waypoint and photo CRUD

Implement all `StorageProvider` methods for waypoints and photos per the interface in `ARCHITECTURE.md`. Photo rows include subject coordinates (`lat`/`lng`/`elevation_m`), camera coordinates (`camera_lat`/`camera_lng`/`camera_elevation_m`), and `bearing`. The implementation:
- Writes the full-size blob to OPFS at `photos/{id}.jpg` and the thumbnail to `photos/{id}_thumb.jpg`.
- Implements `getPhotoBlob(id)` and `getPhotoThumb(id)` to read from OPFS.
- Deletes both files on `deletePhoto(id)`.

**Acceptance criteria**:
- Waypoint CRUD works and persists
- Photo metadata CRUD works and persists, including all camera_* fields
- Full-size blob and thumbnail both save to OPFS and are retrievable by ID
- Both files survive page reload
- Deleting a photo removes both files from OPFS

### Task 2.4 - Tags and backup

Implement tag CRUD. Tags are stored in the `tags` table; entity-tag relationships are stored in the `entity_tags` junction table with `ON DELETE CASCADE`. The entity getters (`getRoutes`, etc.) hydrate `tags: string[]` on each entity by joining on `entity_tags`. Implement `setEntityTags(entityType, entityId, tagIds)` which replaces the junction rows for that entity in a single transaction.

Implement `exportAll()` and `importAll()` per the backup format described in `ARCHITECTURE.md`. Defer the actual ZIP packaging and download UI to Task 6.4 — for this task, return the in-memory `{ bundle, photos, thumbs }` shape and accept the same shape for import. Import is additive (insert new IDs; update existing IDs only when the bundle's `updated_at` is newer).

There are no `linkPhotoToRoute` / `linkPhotoToTrack` methods. Photos do not link to routes, tracks, or waypoints in the data model.

**Acceptance criteria**:
- Tags can be created, read, updated, deleted
- Tagging and untagging entities updates `entity_tags` correctly via `setEntityTags`
- Deleting a tag automatically removes its `entity_tags` rows (verify by re-reading affected entities — their `tags` arrays should no longer contain the deleted tag id)
- `exportAll()` returns a valid `{ bundle, photos, thumbs }`
- `importAll()` restores data; running it twice is a no-op (idempotent)

### Task 2.5 - Zustand store wiring

Wire all Zustand store slices (routes, tracks, waypoints, photos, tags) to the storage provider. Each slice should:
- Load all entities from storage on app startup.
- Expose `add`, `update`, `delete` actions that write through to storage then update local state.
- Generate ISO 8601 timestamps via `new Date().toISOString()` at write time (`created_at` on insert, `updated_at` on every save).
- Expose loading and error state.

Also wire the `ui` slice's panel-state and placement-state machines per `ARCHITECTURE.md` ("Panel and placement state"). Implement the explicit transition actions: `openEntity`, `editCurrent`, `closePanel`, `startWaypointPlacement`, `startPhotoPlacement`, `completePlacement`, `cancelPlacement`. Add the `useEscapeKey()` hook with the precedence specified in the architecture doc.

**Acceptance criteria**:
- On app startup, all entities are loaded from SQLite into Zustand
- Adding an entity via a Zustand action persists it to SQLite with valid ISO 8601 timestamps
- Page reload shows previously saved entities
- Panel and placement state-machine transitions go through the named actions only; direct mutation is not used in components
- ESC handler honors the placement → edit-exit → close-panel precedence

---

## Phase 3 - Routes and Tracks

**Goal**: GPX import working, routes and tracks visible on the map, detail panel showing elevation profile.

### Task 3.1 - GPX parser

Implement `src/utils/gpx.ts`. Parse GPX files containing `<rte>` (route) or `<trk>` (track) elements. Output a normalized object containing: name, description, GeoJSON `LineString` with Z coordinates, distance, elevation gain/loss, recorded_at (tracks only), `duration_s` (total elapsed time, tracks only), `moving_time_s` (speed-thresholded, tracks only), source filename.

Implement `src/utils/hash.ts` with a SHA-256 helper (using `crypto.subtle.digest`). The import flow (Task 3.2) computes this hash on the raw file bytes; the parser does not need to.

Handle edge cases:
- Missing elevation: store `0` in distance/gain/loss (geometry coordinates use `0` for Z too).
- Missing timestamps: `duration_s` and `moving_time_s` are both `null`; `recorded_at` is `null`.
- Multiple `<trkseg>` elements: concatenate trackpoints into a single `LineString`. Time fields are computed across all trackpoints — `duration_s` is `last_ts - first_ts` (includes any segment gap); `moving_time_s` is the sum of inter-point durations where `dist_m / dt_s >= MOVING_SPEED_THRESHOLD_M_S` (constant from `DATA-MODEL.md`).

The parser does **not** retain the raw GPX XML.

**Acceptance criteria**:
- Parses a real-world route GPX file correctly
- Parses a real-world track GPX file correctly
- Handles GPX files with no elevation data gracefully (elevation fields `0` or `null`)
- Handles multi-segment tracks: trackpoints concatenated; time fields computed correctly
- A track with a known 30-minute mid-segment idle period reports `moving_time_s` materially smaller than `duration_s`
- A track with no timestamps yields both `duration_s` and `moving_time_s` as `null`

### Task 3.2 - GPX import UI

Add a GPX import button to the Layer panel (one button handles both routes and tracks — the type is determined by whether the file contains `<rte>` or `<trk>` elements). Implement a drag-and-drop zone on the map for GPX files. Support dropping multiple files at once.

For each file:
1. Compute the SHA-256 of the file bytes (`source_hash`).
2. Look it up via `getRouteBySourceHash` / `getTrackBySourceHash`.
3. If found, prompt the user: **Replace** (overwrite the existing entity), **Skip** (ignore this file), or **Import as new copy** (allow a duplicate, with a different UUID). The prompt should let the user apply the same choice to all subsequent duplicates in the same drop.
4. Otherwise parse and store as new.

After import, show a brief summary toast: "Imported 2 routes, 1 track. 1 duplicate skipped."

**Acceptance criteria**:
- Click-to-browse file picker works
- Drag and drop onto map works
- Multiple files import in one drop
- Routes and tracks are correctly identified and stored with `source_hash` and `source_filename`
- Re-importing a previously imported file triggers the duplicate prompt
- "Apply to all" works across the rest of the drop
- Toast confirmation reflects the actual outcome

### Task 3.3 - Routes layer

Implement `RoutesLayer.tsx`. Render all routes from the Zustand store as MapLibre line layers. Each route uses its stored color. Line width 3px, with a subtle glow effect (wider semi-transparent line underneath). Routes are hidden when the Routes toggle in Layer panel is off.

**Acceptance criteria**:
- Routes render as colored lines on the map
- Colors match stored route colors
- Layer toggle shows/hides all routes
- Routes render correctly over 3D terrain

### Task 3.4 - Tracks layer

Implement `TracksLayer.tsx`. Same as routes layer but visually distinct: dashed line pattern to differentiate tracks (recorded) from routes (planned). Tracks layer toggle independent of routes.

**Acceptance criteria**:
- Tracks render with dashed line style
- Visually distinct from routes at a glance
- Layer toggle works independently

### Task 3.5 - Route detail panel

Clicking a route line on the map dispatches `openEntity('route', id)`. The detail panel renders the route's:
- Name and description
- Distance, elevation gain, elevation loss
- ATES rating (display label from `ATES_LABELS`) and technical difficulty (from `TECHNICAL_DIFFICULTY_LABELS`); each shows "Not rated" when null
- Tags (as colored pills)
- Source filename (read-only)
- Elevation profile chart (Recharts, using Z coordinates from GeoJSON)
- Edit button (transitions panel to `edit` mode via `editCurrent`)
- Delete button (with confirmation)

The edit form lets the user change name, description, color, tags, ATES, and technical difficulty. ATES and technical are independent dropdowns, each with a "— not rated" option. Saving writes through to storage and updates `updated_at`.

**Acceptance criteria**:
- Clicking a route on the map opens the panel via `openEntity`
- All metadata displays correctly, including both rating fields
- Elevation profile renders with correct values
- ATES and technical difficulty save and round-trip correctly, including the null state
- Edit saves changes and updates the map immediately
- Delete removes from map and storage with confirmation

### Task 3.6 - Track detail panel

Same as route detail panel but shows: date recorded, **total elapsed time** (`duration_s`) and **moving time** (`moving_time_s`) side by side, distance, elevation gain/loss, color, tags, source filename, elevation profile. No ATES or technical difficulty fields on tracks.

The total/moving display reads "Total: 6h 12m · Moving: 4h 47m" (using `format.ts` duration helpers). When timestamps are unavailable both fields render "—".

**Acceptance criteria**:
- All track-specific fields display correctly
- Total time and moving time render as separate values; tracks without timestamps show "—" for both
- Elevation profile works
- Edit and delete work

### Task 3.7 - Layer panel counts

Update the Routes and Tracks count badges in the Layer panel to show the actual count of stored entities.

**Acceptance criteria**:
- Counts update immediately after import or delete
- Counts are accurate

---

## Phase 4 - Waypoints

**Goal**: Waypoints can be created by clicking the map, displayed with category icons, and edited via detail panel.

### Task 4.1 - Waypoint placement mode

Add an "Add Waypoint" button (Layer panel or floating action button on the map). Clicking it dispatches `startWaypointPlacement()`. The map subscribes to `PlacementState`: while placement is active, the cursor changes to a crosshair with a pin icon, and a dismissible banner appears ("Click the map to place a waypoint. Press Escape to cancel.").

Clicking the map dispatches `completePlacement(lat, lng)`, which transitions the panel to `create` mode for a waypoint with the lat/lng pre-filled. ESC fires `cancelPlacement` (handled by the global ESC hook from Task 2.5).

**Acceptance criteria**:
- Placement mode activates and deactivates correctly via the named actions
- ESC cancels placement
- Clicking the map in placement mode opens the create form with lat/lng pre-filled
- Map cursor and banner are driven entirely by `PlacementState`, not by ad-hoc local state

### Task 4.2 - Waypoint creation form

The waypoint creation form (in the detail panel) contains: name (required), description, category picker (dropdown with icon preview), tags, elevation (auto-filled if terrain elevation is queryable, otherwise blank). Save creates the waypoint and drops it on the map. Cancel discards.

**Acceptance criteria**:
- All fields save correctly
- Category picker shows all categories with icons
- Waypoint appears on map immediately after save

### Task 4.3 - Waypoints layer

Implement `WaypointsLayer.tsx`. Render waypoints as MapLibre symbol layers using category icons. Use a custom icon set (SVG icons compiled to a MapLibre sprite, or individual images added via `map.addImage()`). Each category has its color from the constants in DATA-MODEL.md.

**Acceptance criteria**:
- All waypoint categories render with distinct icons
- Icons are visible over satellite and topo basemaps (use a white halo/outline)
- Layer toggle shows/hides all waypoints

### Task 4.4 - Waypoint detail panel

Clicking a waypoint marker dispatches `openEntity('waypoint', id)`. The detail panel shows name, description, category, elevation, coordinates, tags. Edit and delete actions follow the panel state machine (`editCurrent` to enter edit mode; the form's Save writes through and returns to view; Cancel returns to view without writing).

Dragging the marker on the map updates the waypoint's coordinates: on drag-end, write the new lat/lng through the storage layer (and update `updated_at`).

**Acceptance criteria**:
- Detail panel shows all fields
- Edit saves correctly
- Delete removes with confirmation
- Drag to reposition updates coordinates in storage and persists across reload

### Task 4.5 - Waypoint count badge

Update the Waypoints count badge in the Layer panel.

**Acceptance criteria**:
- Count is accurate and updates on add/delete

---

## Phase 5 - Photos

**Goal**: Photos can be uploaded, pinned to the map, viewed as thumbnails, and opened in a full viewer.

### Task 5.1 - Photo placement mode and EXIF processing

Add an "Add Photo" button. Clicking it opens a file picker. Reject HEIC files with a guidance message ("HEIC is not supported. On iPhone: Settings → Camera → Formats → Most Compatible") and abort the import.

For accepted JPEG/PNG files, run the import pipeline from `ARCHITECTURE.md`:
1. Read EXIF via `exifr`: orientation, GPS, GPSImgDirection, GPSAltitude, DateTimeOriginal.
2. Decode → canvas → apply orientation → re-encode JPEG with EXIF stripped.
3. Generate a thumbnail (max 128px on the longest edge).
4. Dispatch `startPhotoPlacement(blob, exif)`.

Branching by EXIF GPS:

- **EXIF GPS present**: fly the map to the GPS coordinates, then immediately dispatch `completePlacement(camera_lat, camera_lng)` so the subject pin is seeded at the camera location. The detail panel opens in `create` mode with the camera fields populated and the subject pin draggable. Bearing/elevation/taken_at are prefilled from EXIF.
- **EXIF GPS absent**: stay in placement mode. A thumbnail-of-the-photo follows the cursor; the instruction banner reads "Click the map to pin this photo. Press Escape to cancel." Clicking dispatches `completePlacement(lat, lng)` with no camera coordinates.

ESC cancels placement (global ESC hook).

**Acceptance criteria**:
- File picker opens on button click; HEIC files are rejected with the guidance message
- An imported JPEG with EXIF orientation displays upright in the preview and on save
- An imported JPEG with EXIF GPS auto-flies the map and drops the subject pin at the camera location; bearing/elevation/taken_at are prefilled
- An imported JPEG without EXIF GPS uses thumbnail-follow-cursor placement
- ESC cancels and discards the selected photo
- Saved photo blob in OPFS contains no EXIF

### Task 5.2 - Photo creation form

The photo creation form (panel `create` mode for a photo) contains:
- Name (required)
- Description
- Bearing (0-359° number input with a compass rose visual helper) — prefilled from EXIF when available
- Tags
- Taken-at date (date picker) — prefilled from EXIF when available
- Camera coordinates (read-only when EXIF supplied them; editable otherwise) and camera elevation (read-only / editable on the same condition)

The photo preview is shown alongside the form. The user can drag the subject pin on the map at any time during creation; the create form's lat/lng update live.

Save stores the full-size blob and thumbnail in OPFS and writes the metadata row to SQLite. After save, the panel transitions to `view` mode for the new photo.

**Acceptance criteria**:
- All fields save correctly, including camera_* fields when present
- Blob and thumbnail are stored in OPFS
- Photo appears on map (subject location) immediately after save
- Cancel discards both the form state and the un-saved blob

### Task 5.3 - Photos layer with clustering

Implement `PhotosLayer.tsx` per the layer architecture in `ARCHITECTURE.md`. The Photos source uses native MapLibre clustering (`cluster: true`, `clusterMaxZoom: 13`, `clusterRadius: 50`, both from `PHOTO_CLUSTER` constants). Three layers:

- `photos-clusters` — circle layer, filtered to features with `point_count`. The circle's color and radius scale with `point_count`.
- `photos-cluster-count` — text layer rendering `point_count` on top of the cluster.
- `photos-thumbnails` — symbol layer, filtered to features without `point_count`. Each photo's thumbnail (loaded via `getPhotoThumb` and registered with `map.addImage`) is the symbol icon, ~48px on the map, with a subtle white border and drop shadow.

Clicking a cluster flies the map to the cluster's bounds. Clicking a thumbnail dispatches `openEntity('photo', id)`.

The thumbnails are placed at the photo's **subject** coordinates (`lat`/`lng`), not the camera coordinates.

**Acceptance criteria**:
- At low zoom (≤13), clusters render as count badges
- At high zoom (>13) and for un-clustered points, individual thumbnails render at the subject coordinate
- Clicking a cluster zooms in (cluster splits naturally)
- Clicking an individual thumbnail opens its detail panel
- Layer toggle shows/hides every photos-* layer in concert
- Performance is acceptable with 100+ photos in the dataset

### Task 5.4 - Photo viewer

Clicking a photo thumbnail dispatches `openEntity('photo', id)`. The detail panel shows:
- Full-resolution photo (scrollable if larger than panel)
- Name, description
- Bearing (with a compass indicator)
- Date taken
- Subject coordinates (editable in edit mode; on the map, dragging the subject pin updates these)
- Camera coordinates and camera elevation (read-only by default; edit mode allows manual override). When camera coordinates are null (no EXIF GPS, no manual entry), this section reads "No camera location recorded."
- Tags
- Edit button (transitions panel to `edit` mode via `editCurrent`)
- Delete button (removes both the full-size blob and the thumbnail from OPFS plus the row from SQLite, with confirmation)

There is no "associate with route/track" UI — the data model has no such links.

**Acceptance criteria**:
- Full photo loads and displays correctly
- All metadata shows correctly, including a clear "no camera location recorded" state when camera_* fields are null
- Edit saves correctly
- Subject pin drag on the map updates `lat`/`lng` in storage
- Delete removes the full blob, thumbnail, and metadata

### Task 5.5 - Photo count badge

Update the Photos count badge in the Layer panel.

**Acceptance criteria**:
- Count is accurate and updates on add/delete

---

## Phase 6 - Polish and MVP Completion

**Goal**: Tag filtering, UX polish, PWA manifest, export/import working end to end.

### Task 6.1 - Tag management

Add a tag management section to the Settings panel: create tags (name + color), rename tags, and delete tags. Show a count of how many entities reference each tag (computed from `entity_tags`).

Color input validates against `/^#[0-9a-fA-F]{6}$/` at the form boundary; invalid values are rejected before save.

Deleting a tag automatically removes its rows from `entity_tags` via the `ON DELETE CASCADE` foreign key — no application-level cleanup is needed. Affected entities' `tags` arrays will reflect the deletion the next time they're loaded. Show a confirmation prompt when the tag is in use (e.g. "Tag 'Steep' is used by 7 entities. Delete?").

**Acceptance criteria**:
- Tags can be created, renamed, and deleted from Settings
- Invalid hex colors are rejected before save
- Tags used by entities show a confirmation before deletion
- Deleting a tag removes its `entity_tags` rows automatically (verified by re-reading affected entities)
- Tag colors render correctly as pills throughout the app

### Task 6.2 - Tag filtering

Add a tag filter to each layer row in the Layer panel: a multi-select dropdown of all tags. When one or more tags are selected for a layer, only entities with at least one matching tag are shown on the map. A "clear filter" button resets to show all.

**Acceptance criteria**:
- Filtering by tag correctly shows/hides entities on the map
- Multiple tags selected = OR logic (show if any tag matches)
- Clear filter restores all entities
- Filter state is per-layer and independent

### Task 6.3 - Global search

Implement the Search panel. A text input searches across names and descriptions of all entity types. Results are grouped by type (Routes, Tracks, Waypoints, Photos). Clicking a result flies the map to that entity and opens its detail panel.

**Acceptance criteria**:
- Search returns results from all entity types
- Results grouped and labeled by type
- Clicking a result centers the map on the entity
- Empty state shown when no results

### Task 6.4 - Export and import (ZIP backup)

Implement `src/utils/backup.ts` using `fflate` for streaming ZIP read/write. Wire up the export/import buttons in Settings.

**Export** produces `couloir-backup-{YYYY-MM-DD}.zip` containing:
- `manifest.json` — `BackupManifest` (bundle_version, app_version, exported_at, photo_count, total_size_bytes)
- `metadata.json` — `ExportBundle` (entities, tags, entity_tags rows)
- `photos/{id}.jpg` — one full-size blob per photo
- `photos/{id}_thumb.jpg` — one thumbnail per photo

Before triggering the download, show the estimated bundle size (sum of photo `file_size_bytes` plus a small overhead) and a "Continue?" confirmation.

**Import** reads a user-supplied ZIP, validates the manifest's `bundle_version`, and calls `importAll(bundle, photos, thumbs)`. If `photos/{id}_thumb.jpg` is missing for any photo, regenerate the thumbnail from the full-size blob during import. Show a confirmation dialog before applying ("Restore from backup? Existing entities will be updated when the backup's data is newer; new entities will be added.").

**Acceptance criteria**:
- Export downloads a valid ZIP with manifest, metadata, full-size blobs, and thumbnails
- Pre-export size estimate is shown and reasonably accurate
- Import reads the ZIP and restores entities and blobs into OPFS
- Re-running import on the same bundle is idempotent (no duplicates, no conflicts)
- Importing a bundle missing thumbnails regenerates them on the fly
- Confirmation dialog appears before applying the import

### Task 6.5 - PWA manifest and icons

Configure `vite-plugin-pwa`. Add `manifest.json` with: name "Couloir", short name "Couloir", theme color dark, background color dark, display standalone. Generate app icons at 192px and 512px (a simple mountain/couloir glyph on dark background). Configure Workbox for app shell caching.

**Acceptance criteria**:
- App is installable from Chrome/Safari "Add to Home Screen"
- App icon appears correctly on home screen
- App loads offline after first visit (app shell cached)

### Task 6.6 - Mobile layout

Audit and fix the layout on a 375px wide screen (iPhone SE baseline). The map must fill the full screen. The sidebar becomes a bottom sheet on mobile (slides up from the bottom). The detail panel appears as a bottom sheet rather than a side panel. Map controls reposition to not overlap with the bottom sheet handle.

**Acceptance criteria**:
- App is usable one-handed on a 375px screen
- Bottom sheet opens and closes smoothly
- Map is not obscured when panels are closed
- No horizontal scroll

### Task 6.7 - Empty states and onboarding

Add empty states for each layer when no data exists. For a brand new install with no API key set, show a welcome screen overlaying the map with two steps: (1) enter Maptiler API key, (2) import your first GPX. Include a link to the Maptiler free tier signup.

**Acceptance criteria**:
- Each layer panel row shows a helpful empty state message when count is 0
- Welcome screen appears on first launch (no API key)
- Welcome screen does not appear after API key is set

### Task 6.8 - Final QA pass

Run through the full workflow end to end:
1. Fresh install - welcome screen appears
2. Enter API key - map loads in 3D
3. Import a GPX route - appears on map, detail panel opens, elevation profile renders
4. Import a GPX track - appears on map with different style
5. Add a waypoint by clicking - form opens, waypoint appears with correct icon
6. Add a photo - pin placed, thumbnail visible on map, viewer opens on click
7. Create a tag, apply to a route and a photo
8. Filter routes layer by tag - only tagged route shows
9. Search for the route by name - result appears, clicking flies to it
10. Export data - ZIP backup downloads (manifest + metadata + full-size photos + thumbnails)
11. Delete all data, import the ZIP - all entities and photos restored
12. Toggle terrain off and on - works correctly
13. Switch basemaps - all three load without errors
14. Resize to mobile width - layout adapts correctly

**Acceptance criteria**:
- All steps above complete without errors
- No console errors during normal use
- App feels fast and responsive throughout

---

## Post-MVP Backlog

These are confirmed future features, not part of the MVP:

- Bearing cone / FOV footprint visualization for photo pins
- Slope angle shading overlay (derived from Maptiler DEM)
- Aspect shading layer
- Offline tile caching for field use (Workbox tile cache strategy)
- Cloud sync via PowerSync or ElectricSQL
- Photo blob sync to S3 / MinIO
- Multi-user support with auth
- Capacitor wrapper for native iOS/Android
- Waypoint import from GPX `<wpt>` elements
- Route/track export back to GPX
- Print view / PDF export of route with map and elevation profile
- Bulk tag operations
- Route comparison (overlay two routes on the same elevation profile)

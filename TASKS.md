# Couloir - MVP Task List

## How to Use This Document

Feed tasks to Claude Code one phase at a time. Complete all tasks in a phase and verify them before moving to the next phase. Each task has clear acceptance criteria so you know when it is done.

Before starting any session, ask Claude Code to read `SPEC.md`, `ARCHITECTURE.md`, and `DATA-MODEL.md` first.

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

**Acceptance criteria**:
- Map renders with Outdoor basemap when a valid API key is entered
- Settings panel shown automatically if no key is set
- Controls render and function
- Map resizes correctly when sidebar is toggled

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

Install `wa-sqlite`. Implement `src/storage/opfs.ts` as the `StorageProvider` interface. On app startup, open (or create) the SQLite database file in OPFS at `couloir.db`. Apply the schema from `DATA-MODEL.md`. Apply schema versioning.

**Acceptance criteria**:
- Database file created in OPFS on first load
- Schema applies without errors
- `schema_version` table populated with version 1
- No errors in console on startup

### Task 2.2 - Route and track CRUD

Implement all `StorageProvider` methods for routes and tracks. Write a test harness (a temporary browser console helper or a `__dev__` panel hidden behind a keyboard shortcut) that lets you:
- Create a dummy route with fake GeoJSON
- Read it back
- Update its name
- Delete it

**Acceptance criteria**:
- All CRUD operations work without errors
- Data persists across page reloads (survives F5)
- No data loss on repeated open/close

### Task 2.3 - Waypoint and photo CRUD

Implement all `StorageProvider` methods for waypoints and photos. Photo blobs should be written to OPFS at `photos/{id}.jpg`. Implement `getPhotoBlob` to return the blob from OPFS.

**Acceptance criteria**:
- Waypoint CRUD works and persists
- Photo metadata CRUD works and persists
- Photo blob saves to OPFS and is retrievable by ID
- Blob survives page reload

### Task 2.4 - Tags and associations

Implement tag CRUD and the photo-route / photo-track association methods. Implement `exportAll()` and `importAll()` - export serializes all entity metadata to JSON (no blobs in phase 1 of export), import restores from that JSON.

**Acceptance criteria**:
- Tags can be created, read, updated, deleted
- Photo-route and photo-track associations save and delete correctly
- `exportAll()` returns a valid `ExportBundle`
- `importAll()` restores data from a bundle

### Task 2.5 - Zustand store wiring

Wire all Zustand store slices to the storage provider. Each slice should:
- Load all entities from storage on app startup
- Expose `add`, `update`, `delete` actions that write through to storage then update local state
- Expose loading and error state

**Acceptance criteria**:
- On app startup, all entities are loaded from SQLite into Zustand
- Adding an entity via Zustand action persists it to SQLite
- Page reload shows previously saved entities

---

## Phase 3 - Routes and Tracks

**Goal**: GPX import working, routes and tracks visible on the map, detail panel showing elevation profile.

### Task 3.1 - GPX parser

Implement `src/utils/gpx.ts`. Parse GPX files containing `<rte>` (route) or `<trk>` (track) elements. Output a normalized object containing: name, description, GeoJSON LineString with Z coordinates, distance, elevation gain/loss, duration (tracks only), recorded_at (tracks only), raw GPX string.

Handle edge cases: missing elevation, missing timestamps, multiple track segments (merge into one LineString).

**Acceptance criteria**:
- Parses a real-world route GPX file correctly
- Parses a real-world track GPX file correctly
- Handles GPX files with no elevation data gracefully (elevation fields null/0)
- Handles multi-segment tracks

### Task 3.2 - GPX import UI

Add a GPX import button to the Layer panel (one button that handles both routes and tracks - the type is determined by whether the file contains `<rte>` or `<trk>` elements). Implement a drag-and-drop zone on the map for GPX files. Support dropping multiple files at once.

After import, show a brief import summary toast: "Imported 2 routes, 1 track".

**Acceptance criteria**:
- Click-to-browse file picker works
- Drag and drop onto map works
- Multiple files import in one drop
- Routes and tracks are correctly identified and stored
- Toast confirmation appears after import

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

Clicking a route line on the map opens the detail panel showing:
- Name and description
- Distance, elevation gain, elevation loss, difficulty
- Tags (as colored pills)
- Elevation profile chart (Recharts, using Z coordinates from GeoJSON)
- Edit button (opens inline edit form)
- Delete button (with confirmation)

**Acceptance criteria**:
- Clicking a route on the map opens the panel
- All metadata displays correctly
- Elevation profile renders with correct values
- Edit saves changes and updates map immediately
- Delete removes from map and storage with confirmation

### Task 3.6 - Track detail panel

Same as route detail panel but shows: date recorded, duration, plus all the same fields. No difficulty field on tracks.

**Acceptance criteria**:
- All track-specific fields display correctly
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

Add a "Add Waypoint" button to the Layer panel (or a floating action button on the map). Clicking it enters waypoint placement mode: the cursor changes to a crosshair with a pin icon, and a dismissible instruction banner appears ("Click the map to place a waypoint. Press Escape to cancel."). Clicking the map creates a waypoint at that location and opens the waypoint creation form. Escape cancels.

**Acceptance criteria**:
- Placement mode activates and deactivates correctly
- Escape cancels placement mode
- Clicking the map in placement mode opens the creation form with lat/lng pre-filled

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

Clicking a waypoint marker opens the detail panel: name, description, category, elevation, coordinates, tags. Edit and delete actions. Dragging the marker on the map updates the waypoint's coordinates (implement drag-to-reposition).

**Acceptance criteria**:
- Detail panel shows all fields
- Edit saves correctly
- Delete removes with confirmation
- Drag to reposition updates coordinates in storage

### Task 4.5 - Waypoint count badge

Update the Waypoints count badge in the Layer panel.

**Acceptance criteria**:
- Count is accurate and updates on add/delete

---

## Phase 5 - Photos

**Goal**: Photos can be uploaded, pinned to the map, viewed as thumbnails, and opened in a full viewer.

### Task 5.1 - Photo placement mode

Add an "Add Photo" button. Clicking it opens a file picker to select a photo. After selecting a photo, the app enters photo placement mode: a thumbnail of the selected photo follows the cursor, an instruction banner reads "Click the map to pin this photo. Press Escape to cancel." Clicking the map pins the photo at that location and opens the photo creation form.

**Acceptance criteria**:
- File picker opens on button click
- Thumbnail preview follows cursor in placement mode
- Escape cancels and discards the selected photo
- Clicking places the photo and opens the form

### Task 5.2 - Photo creation form

The photo creation form contains: name (required), description, bearing (0-359° number input with a compass rose visual helper), tags, date taken (optional, date picker). The photo preview is shown alongside the form. Save stores the photo blob in OPFS and metadata in SQLite.

**Acceptance criteria**:
- All fields save correctly
- Blob is stored in OPFS
- Photo appears on map immediately after save

### Task 5.3 - Photos layer

Implement `PhotosLayer.tsx`. Render photo pins as small square thumbnails on the map (approximately 48x48px). Use a canvas or `map.addImage()` to render a thumbnail-sized version of each photo as a MapLibre symbol. Each thumbnail has a subtle white border and drop shadow.

For performance: generate thumbnails at upload time (max 128px wide) and store as a separate OPFS file `photos/{id}_thumb.jpg`.

**Acceptance criteria**:
- Photo thumbnails render on the map at the correct location
- Thumbnails are distinct and recognizable at map zoom levels 10-14
- Layer toggle shows/hides all photos
- Performance is acceptable with 20+ photos on the map

### Task 5.4 - Photo viewer

Clicking a photo pin on the map opens the detail panel showing:
- Full-resolution photo (scrollable if larger than panel)
- Name, description, bearing (with a compass indicator), date taken, coordinates, tags
- Edit button (opens edit form)
- Delete button (removes blob from OPFS and metadata from SQLite, with confirmation)
- Associate with route/track (multi-select of existing routes and tracks)

**Acceptance criteria**:
- Full photo loads and displays correctly
- All metadata shows correctly
- Associations save and display correctly
- Delete removes blob and metadata

### Task 5.5 - Photo count badge

Update the Photos count badge in the Layer panel.

**Acceptance criteria**:
- Count is accurate and updates on add/delete

---

## Phase 6 - Polish and MVP Completion

**Goal**: Tag filtering, UX polish, PWA manifest, export/import working end to end.

### Task 6.1 - Tag management

Add a tag management section to the Settings panel: create tags with name and color, delete tags. Tags must be created before they can be applied to entities. Show a count of how many entities use each tag.

**Acceptance criteria**:
- Tags can be created and deleted from Settings
- Tags used by entities cannot be deleted without confirmation
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

### Task 6.4 - Export and import

Wire up the export/import buttons in Settings. Export downloads a JSON file (`couloir-export-{date}.json`). Import reads a JSON file and calls `importAll()`. Show a confirmation dialog before import (it will merge with existing data, not replace).

**Acceptance criteria**:
- Export produces a valid downloadable JSON file
- Import reads the file and restores entities
- Entities are visible on the map after import
- Confirmation dialog appears before import

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
10. Export data - JSON file downloads
11. Delete all data, import the JSON - data restored
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

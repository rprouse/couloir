# Couloir Phase 12 — ATES Terrain Ratings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leave browser-only verification steps unticked unless you actually ran them in a browser.

**Goal:** Import Avalanche Canada's ATES (Avalanche Terrain Exposure Scale) ratings for the areas you ski, and show them on the map as coloured zones (Simple green, Challenging blue, Complex black). The layer is a switch that sits on top of the slope or aspect overlay, so you can see both at once.

**Decisions taken in planning (2026-10-29):**

1. **The data comes from KMZ files you download yourself.** Avalanche Canada has no public ATES API or tile service. The Trip Planner offers a per-area "Download ATES data as KMZ" behind a usage-notes and disclaimer dialog. Couloir imports those files. It never calls Avalanche Canada's undocumented endpoints or reads their Mapbox tilesets.
2. **No new dependencies.** The user approved `jszip` and `@tmcw/togeojson`, but neither is needed. `fflate` (already used for backups) unzips the KMZ. The KML that Avalanche Canada generates has a fixed, simple shape, so a small `DOMParser` reader like `src/utils/gpx.ts` handles it. That reader can also map `styleUrl` to the ATES class, which a generic converter wouldn't do for us.
3. **What the KMZ contains** (inspected 2026-10-29 using `Tunnel Creek South.kmz`; 95 KB zipped, 230 KB `doc.kml` plus 5 PNG icons):
   - `Document > name` is the area name. It declares shared `<Style>`s: `zone_{green,blue,black}_style`, `ates_line_{green,blue,black}_style`, `area_styles`, `access_road_styles`, `avalanche_path_styles`, `decision_point_styles`, and `point_of_interest_{cabin,parking,destination,other}_styles`.
   - `Folder` (area name) holds:
     - the area boundary: one `Placemark` with `#area_styles` and a `Polygon`
     - `Folder "Points of Interest"`: `Point`s
     - `Folder "Access Routes"`: `LineString`s
     - `Folder "Zones"` with sub-folders `"Class 1 – Simple"`, `"Class 2 – Challenging"` and `"Class 3 – Complex"`. Each holds `Placemark`s named after the class, with the ATES v2 definition as `<description>`, a `#zone_*_style`, and a `Polygon` that may have several `innerBoundaryIs` holes.
   - Coordinates are 2D `lng,lat` with 6 decimals and no elevation. There is no `ExtendedData`, and no `MultiGeometry` in the sample.
   - The sample has no ATES-rated lines, avalanche paths or decision points, but the declared styles show other areas can have them.
4. **The class comes from `styleUrl`, with the folder name as a fallback.** `zone_green`/`ates_line_green` → `simple`, `blue` → `challenging`, `black` → `complex`. If the style is something else (an Extreme or Class 0 area, say), parse the enclosing folder name `Class N – Label`. Map N = 0 to `non_avalanche` and N = 4 to `extreme`. A zone that still has no class is skipped and counted, and the import toast reports it.
5. **What we keep:**
   - the area boundary
   - zones
   - ATES-rated lines
   - avalanche paths
   - decision points, with name and description
   
   We drop points of interest and access routes, because your own waypoints and routes already cover those. We also drop the PNG icons. `MultiGeometry` is flattened into one feature per part.
6. **Storage: one row per area, with geometry as a GeoJSON `FeatureCollection` in a TEXT column.** Migration 4 adds `ates_areas (id, name, source_filename, geojson, imported_at, updated_at)`. Areas aren't tagged and aren't searchable. Three areas of about 200 KB each is small, so `getAtesAreas()` returns full geometry. If anyone ever imports dozens of areas, split off a metadata-only list.
7. **Re-importing an area replaces it.** Avalanche Canada revises its ratings, so importing a file whose area name matches an existing row (case-insensitive) keeps that row's `id` and `imported_at`, swaps in the new geometry, and bumps `updated_at`. The toast says "Updated" instead of "Imported".
8. **ATES areas go in the ZIP backup.** `ExportBundle` gains `ates_areas` and `BUNDLE_VERSION` becomes 2, so an older app refuses a newer backup instead of silently dropping the ratings. Version 1 bundles import with no ATES areas. On import, an area replaces the existing row with the same id when its `updated_at` is newer, the same rule entities follow.
9. **The map layer is a separate switch, not a third overlay segment.** `TerrainOverlay` stays `'slope' | 'aspect'`. A persisted `atesEnabled` flag (default on) and its own `atesOpacity` (default 0.45) let ATES sit over slope. The stacking order is: basemap, slope/aspect raster, ATES fills, ATES lines and outlines, Couloir routes/tracks/waypoints/photos, basemap labels.
10. **Fixed colours by class, not the KML's own colours.** The KML uses ABGR (`8800ff55` = #55FF00 at 53 %), and every file would need to agree. Literal hexes live in `layerStyles.ts`, because map paint can't read CSS properties:

   | Class | Hex |
   |---|---|
   | Non-avalanche | `#F8FAFC` |
   | Simple | `#22C55E` |
   | Challenging | `#2563EB` |
   | Complex | `#111827` |
   | Extreme | `#7F1D1D` |

   Complex and extreme also get a light 1 px outline so they still read over dark satellite imagery.
11. **Attribution and caveat.** The GeoJSON source sets `attribution: 'ATES ratings © Avalanche Canada'`, so it shows in the map credit while the layer is on. The legend carries a caveat: "ATES rates terrain exposure, not today's avalanche danger. Check the current forecast."
12. **Clicking a zone or decision point opens a small MapLibre popup** with the area, the class and its definition, or the decision point's name and description. Routes, tracks, waypoints and photos keep click priority, and nothing pops up in placement mode.

**Spec references:** `SPEC.md` (Map, Layer System, Settings), `DATA-MODEL.md` (Schema Versioning), `ARCHITECTURE.md` (Storage Interface, Server › API, Terrain Overlays, Map Layer Architecture, Backup Format), `TASKS.md` Tasks 12.1–12.7.

**Out of scope:**
- fetching ATES data from Avalanche Canada automatically
- ATES coverage outside the downloaded KMZs (AutoATES, Parks Canada and Alberta Parks datasets)
- importing the KMZ's points of interest or access routes as Couloir waypoints or routes
- rating a route by the ATES zones it crosses (a good follow-up)
- offline caching

---

## File Structure

```
couloir/
├── AGENTS.md, ARCHITECTURE.md, DATA-MODEL.md, SPEC.md, TASKS.md   12.6 (docs), each task (ticks)
├── server/app.ts (+ test)                              12.3
├── src/
│   ├── types/index.ts                                  12.1 (ATES types), 12.3 (bundle)
│   ├── utils/
│   │   ├── atesKml.ts / .test.ts                       12.1
│   │   └── atesKml.fixture.ts                          12.1 (synthetic KML, hand-written)
│   ├── storage/
│   │   ├── migrations/4.sql, index.ts, index.test.ts   12.2
│   │   ├── interface.ts                                12.2
│   │   ├── sqlProvider.ts (+ test)                     12.2, 12.3
│   │   ├── memory.ts                                   12.2, 12.3
│   │   ├── http.ts                                     12.2, 12.3
│   │   └── contract.ts                                 12.2, 12.3
│   ├── store/
│   │   ├── atesAreas.ts / .test.ts                     12.2 (useAtesAreasStore)
│   │   └── ui.ts (+ test)                              12.4 (atesEnabled, atesOpacity)
│   ├── features/ates/
│   │   ├── atesImport.ts / .test.ts                    12.2
│   │   └── AtesAreasSection.tsx / .module.css / .test.tsx   12.5
│   ├── features/backup/readBackup.ts, writeBackup.ts   12.3
│   ├── components/FileDropzone/FileDropzone.tsx        12.5 (.kmz accepted)
│   ├── map/layers/
│   │   ├── layerStyles.ts                              12.4
│   │   ├── atesLayerData.ts / .test.ts                 12.4 (also zone counts, classes present, bounds)
│   │   ├── atesPopup.ts, AtesLayer.module.css          12.4
│   │   ├── AtesLayer.tsx (+ test)                      12.4
│   │   └── TerrainOverlayLayer.tsx                     12.4 (beforeId)
│   ├── map/controls/
│   │   ├── TerrainControl.tsx (+ test)                 12.5
│   │   └── AtesLegend.tsx (+ test)                     12.5
│   ├── map/MapView.tsx                                 12.4
│   └── panels/SettingsPanel/SettingsPanel.tsx          12.5
```

**Conventions** (carried forward):
- Vitest globals. Plain `npm test` works; fall back to `npx vitest run --pool=forks --poolOptions.forks.singleFork=true` if esbuild hangs on Windows.
- Map rendering and popups are checked in a real browser through Playwright. Logic lives in pure, tested helpers.
- **No Avalanche Canada data is committed.** Test fixtures are synthetic: a small hand-written KML with the same structure as the real files, using made-up square polygons.
- `git` only through the PowerShell tool. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One feature commit per task, with the plan and TASKS.md ticks folded in.

**Branch:** `git switch -c phase-12-ates` from an up-to-date `main` before Task 12.1.

---

## Task 12.1 — KMZ parser

**Files:** `src/types/index.ts`, `src/utils/atesKml.ts` / `.test.ts`, `src/utils/atesKml.fixture.ts`

- [x] **Step 12.1.1: Types.** In `src/types/index.ts`:

  ```ts
  export type AtesClass = 'non_avalanche' | 'simple' | 'challenging' | 'complex' | 'extreme'
  export const ATES_CLASSES: readonly AtesClass[] = [
    'non_avalanche', 'simple', 'challenging', 'complex', 'extreme',
  ]

  // Feature<G, P> = { type: 'Feature'; geometry: G; properties: P }, declared locally.
  export type AtesFeature =
    | Feature<Polygon,    { kind: 'zone'; ates: AtesClass; description: string }>
    | Feature<LineString, { kind: 'ates_line'; ates: AtesClass; name: string }>
    | Feature<Polygon,    { kind: 'area' }>
    | Feature<LineString, { kind: 'avalanche_path'; name: string }>
    | Feature<Point,      { kind: 'decision_point'; name: string; description: string }>

  export interface AtesArea {
    id: string
    name: string
    source_filename: string
    geojson: { type: 'FeatureCollection'; features: AtesFeature[] }
    imported_at: string
    updated_at: string
  }
  ```

  Write the GeoJSON shapes out by hand, as `LineStringZ` already is. `AtesClass` is `'non_avalanche' | ATES`, reusing the existing route `ATES` type, with `ATES_CLASS_LABELS` next to `ATES_LABELS`. Don't add `@types/geojson`. Coordinates are 2D `[lng, lat]`, because ATES has no elevation.

- [x] **Step 12.1.2: Fixture.** `src/utils/atesKml.fixture.ts` exports the KML as a string (tests keep fixtures inline, as `gpx.test.ts` does), written by hand to match the inspected structure:
  - the `kml` and `gx` namespaces and all the `<Style>` ids from Decision 3
  - an area boundary
  - one POI and one access route, to check they're dropped
  - Zones with:
    - two Simple zones, one with an inner hole
    - one Challenging zone
    - one Complex zone
    - one zone under a `Class 4 – Extreme` folder with an unknown `#zone_red_style`
    - one zone with no recognisable style or folder
  - one `#ates_line_blue_style` line
  - one `#avalanche_path_styles` line
  - one `#decision_point_styles` point with a description
  - one `MultiGeometry` holding two zone polygons
  
  Use small made-up squares near (−115.07, 49.34).

- [x] **Step 12.1.3: Tests first** (`atesKml.test.ts`):
  - `parseAtesKml(xml, 'Fixture.kmz')`:
    - takes the area name from `Document > name`
    - returns one `area` feature
    - returns zone counts per class matching the fixture, with the `MultiGeometry` split into two features
    - keeps the hole as a second ring
    - reads Extreme from the folder name
    - skips the unclassified zone and reports `skipped: 1`
    - keeps the ATES line with `ates: 'challenging'`
    - keeps the avalanche path and the decision point, with name and description
    - drops the POI and the access route
    - parses coordinates as numbers, and tolerates whitespace or newlines between tuples and a trailing altitude (`lng,lat,0`) by dropping it
  - a missing `Document > name` falls back to the filename without `.kmz`
  - malformed XML throws `AtesImportError('…not a KML file…')`, and a KML with no zones throws `AtesImportError('…no ATES zones…')`
  - `readKmz(bytes)` unzips with `fflate.unzipSync` and returns the text of the first `.kml` entry (`doc.kml` by convention). A ZIP without a `.kml` throws `AtesImportError`. Build the test ZIP with `zipSync` in the test.

- [x] **Step 12.1.4: Write `src/utils/atesKml.ts`.**
  - `export class AtesImportError extends Error`
  - `export function readKmz(bytes: Uint8Array): string`
  - `export function parseAtesKml(xml: string, sourceFilename: string): { name: string; features: AtesFeature[]; skipped: number }`
  
  Use `DOMParser` and detect `parsererror` the way `gpx.ts` does, and match on `localName` so namespace prefixes don't matter. Walk every `Placemark` and read its `styleUrl` (strip the `#`). The class comes from `/^(zone|ates_line)_(green|blue|black)_style$/`, otherwise from the nearest ancestor `Folder > name` matching `/Class\s*(\d)/`. For geometry, read every `Polygon`, `LineString` and `Point` under the placemark, which flattens `MultiGeometry`. The polygon rings are `outerBoundaryIs` first, then each `innerBoundaryIs`.

- [x] **Step 12.1.5:** `npm test`, `npm run typecheck`. Commit `feat: parse Avalanche Canada ATES KMZ files`.

## Task 12.2 — ATES area storage

**Files:** `src/storage/migrations/4.sql`, `index.ts`, `index.test.ts`, `src/storage/interface.ts`, `sqlProvider.ts` (+ test), `memory.ts`, `http.ts`, `contract.ts`, `server/app.ts` (+ test), `src/features/ates/atesImport.ts` / `.test.ts`, the data store, `src/dev/devConsole.ts`

- [x] **Step 12.2.1: Migration test first**, then `4.sql` and `SCHEMA_VERSION = 4`:

  ```sql
  -- Migration 4: ATES terrain ratings imported from Avalanche Canada KMZ
  -- files, one row per area. geojson is a FeatureCollection (see AtesArea).
  CREATE TABLE ates_areas (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    geojson         TEXT NOT NULL,
    imported_at     TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  ```

- [x] **Step 12.2.2: Interface.** Add to `StorageProvider`:

  ```ts
  // ATES areas (Phase 12)
  getAtesAreas(): Promise<AtesArea[]>
  /** Insert or replace by id. */
  saveAtesArea(area: AtesArea): Promise<void>
  deleteAtesArea(id: string): Promise<void>
  ```

- [x] **Step 12.2.3: Contract tests** (a new `ATES areas` block in `contract.ts`):
  - save then list round-trips the geometry exactly
  - saving the same id again replaces the row
  - `deleteAtesArea` removes it
  - deleting an unknown id is a no-op
  - areas list in name order

- [x] **Step 12.2.4: Implement in every provider.**
  - `SqlStorageProvider`: `INSERT OR REPLACE`, with `JSON.stringify`/`JSON.parse` for `geojson`, and `ORDER BY name COLLATE NOCASE`.
  - `InMemoryStorageProvider`: a `Map`, storing a `structuredClone` so callers can't mutate stored geometry.
  - `HttpStorageProvider`: `GET /api/ates-areas`, `PUT /api/ates-areas/:id` and `DELETE /api/ates-areas/:id`.
  - `server/app.ts`: the matching routes, using `idParam`, `jsonBody` and `entityFor` like waypoints, and the same id validation.
  - Check that the server accepts a body of about 300 KB. Add a server test that PUTs a 300 KB area.

- [x] **Step 12.2.5: Import orchestration, tests first** (`src/features/ates/atesImport.ts`, run against `InMemoryStorageProvider`):

  ```ts
  export async function importAtesKmz(
    storage: StorageProvider, file: File,
  ): Promise<{ area: AtesArea; replaced: boolean; skipped: number }>
  ```

  It reads `file.arrayBuffer()`, then runs `readKmz` and `parseAtesKml`. It looks for an existing area with the same name (case-insensitive). If there is one, it keeps that area's `id` and `imported_at`. Otherwise it creates the area with `newId()` and the time now. Then it saves the area. Tests cover a fresh import, re-importing the same name (id kept, geometry replaced, `replaced: true`), and a non-KMZ file throwing `AtesImportError`.

- [x] **Step 12.2.6: Data store.** Each entity has its own Zustand store, so add `src/store/atesAreas.ts` (`useAtesAreasStore`: `areas`, `load`, `importFile`, `remove`). It loads at startup in `main.tsx` and again after a backup restore (`BackupSection`). `devConsole.ts`: `listAll` includes ATES areas.

- [x] **Step 12.2.7:** `npm test`, `npm run typecheck`. Commit `feat: store imported ATES areas (migration 4)`.

## Task 12.3 — ATES areas in backups

**Files:** `src/types/index.ts`, `sqlProvider.ts`, `memory.ts`, `http.ts`, `contract.ts`, `src/features/backup/*`, `server/app.ts`

- [x] **Step 12.3.1: Contract tests first:**
  - `exportAll` carries `ates_areas` and `bundle_version: 2` (update the existing `toBe(1)` assertion)
  - `importAll` of a bundle with no `ates_areas` key (a version 1 bundle, built by destructuring and cast through `unknown` with a comment) leaves existing areas alone
  - an imported area replaces the stored one only when its `updated_at` is newer

- [x] **Step 12.3.2:** Add `ates_areas?: AtesArea[]` to `ExportBundle`. It's optional because version 1 bundles don't have it. Set `BUNDLE_VERSION = 2`. Implement it in `exportAll`/`importAll` for the SQL and in-memory providers, inside the existing transaction. `HttpStorageProvider.exportAll` builds the bundle from the list endpoints, so add `getAtesAreas()` there. `readBackup` already refuses `bundle_version > BUNDLE_VERSION`. Add a test that a version 1 ZIP still restores. The ZIP is written by `writeBackup` (not `exportAll`), so it reads `getAtesAreas()` too; `readBackup` rejects a non-array `ates_areas`, and `summarizeBundle` and the size estimate count ATES areas.

- [x] **Step 12.3.3:** `npm test`, `npm run typecheck`. Commit `feat: include ATES areas in ZIP backups (bundle v2)`.

## Task 12.4 — ATES map layer

**Files:** `layerStyles.ts`, `atesLayerData.ts` / `.test.ts`, `AtesLayer.tsx` (+ test), `TerrainOverlayLayer.tsx`, `MapView.tsx`, `src/store/ui.ts` (+ test)

- [x] **Step 12.4.1: UI state, tests first.** `atesEnabled: boolean` (default `true`) and `atesOpacity: number` (default `0.45`, clamped like `overlayOpacity`) are persisted under `couloir_ates_enabled` and `couloir_ates_opacity`, and hydrated in `hydrateFromStorage`, which silently ignores bad values.

- [x] **Step 12.4.2: Constants** in `layerStyles.ts`:
  - the source and layer ids: `ATES_SOURCE_ID`, `ATES_FILL_LAYER_ID`, `ATES_OUTLINE_LAYER_ID`, `ATES_LINES_LAYER_ID`, `ATES_AREA_LAYER_ID`, `ATES_PATHS_LAYER_ID`, `ATES_DECISION_LAYER_ID`, collected in `ATES_LAYER_IDS`
  - `ATES_CLASS_COLORS: Record<AtesClass, string>` from Decision 10
  - `ATES_ATTRIBUTION`

  Add `ATES_LAYER_IDS` to `COULOIR_OVERLAY_LAYER_IDS` so the slope and aspect rasters always go beneath ATES, whatever order the layers install in.

- [x] **Step 12.4.3: Layer data, tests first** (`atesLayerData.ts`).
  - `buildAtesGeoJson(areas)` merges every area's features into one `FeatureCollection` and stamps each with `areaId` and `areaName`.
  - `atesClassColorExpression()` returns a `match` expression on `['get', 'ates']`.
  - The tests check that features from two areas merge with their area stamps, and that the expression covers every `ATES_CLASSES` entry.

- [x] **Step 12.4.4: `AtesLayer.tsx`, tests first.** It follows `TerrainOverlayLayer` and the other GeoJSON layers: install on every `style.load`, toggle visibility only, and update data with `setData` when `atesAreas` changes. The layers are:
  - **fill**: `kind == zone`, class colour, opacity `atesOpacity`
  - **outline**: `kind == zone`, a 1 px line in a light colour at 0.6 opacity, so complex and extreme zones read on dark imagery
  - **ATES lines**: `kind == ates_line`, class colour, width 5
  - **area boundary**: `kind == area`, white, width 2, dashed
  - **avalanche paths**: red, width 2
  - **decision points**: a circle, radius 5, amber with a white stroke

  The `beforeId` is the first layer that is a basemap symbol or a non-ATES Couloir layer, which is the routes glow. Tests:
  - every layer is added with the right filter
  - visibility follows `atesEnabled`
  - fill opacity follows `atesOpacity`
  - the source has the attribution
  - `setData` runs when the areas change

- [x] **Step 12.4.5: Click popups.** A `click` handler on the fill and decision-point layers:
  - It returns early if `placement.mode !== 'idle'`.
  - It also returns early if `queryRenderedFeatures` at the point hits any route, track, waypoint or photo layer, so those keep priority.
  - Otherwise it opens a `maplibregl.Popup`. A zone shows the area name, `Class N – Label` and the description. A decision point shows its name and description.
  - The popup text goes in through `textContent`, never `setHTML`, because the strings come from an imported file.
  - The cursor changes to a pointer over decision points. Not over zones: they cover whole slopes, so a pointer there would be on almost everywhere.
  - The popup body is built in `atesPopup.ts`, styled dark in `AtesLayer.module.css`. The click is one map-wide handler, not per-layer, so it can check the entity layers first. The MapLibre test mock gains layer-scoped events (`emitLayer`), `queryRenderedFeatures` and `Popup`.
  - Test it with the map mock.

- [x] **Step 12.4.6:** Mount `<AtesLayer />` in `MapView` after the two `TerrainOverlayLayer`s. `npm test`, `npm run typecheck`. Commit `feat: draw ATES zones on the map`.

## Task 12.5 — ATES controls, legend and area management

**Files:** `TerrainControl.tsx` (+ test), `AtesLegend.tsx` (+ test), `SettingsPanel.tsx`, `AtesAreasSection.tsx` / `.module.css` / `.test.tsx`, `FileDropzone.tsx` and its host

- [ ] **Step 12.5.1: Switch and legend.** `TerrainControl` gets an `ATES` switch below the overlay row, styled like the 3D Terrain switch, with `aria-label="ATES ratings"`. It only appears once at least one area has been imported. When it's on, `AtesLegend` shows a swatch for each class present in the imported data, the caveat from Decision 11, and a credit line, "Ratings: Avalanche Canada". Tests: the switch is hidden with no areas and toggles `atesEnabled`, and the legend lists only the classes that are present.

- [ ] **Step 12.5.2: Settings section, tests first.** `AtesAreasSection` in the Settings panel:
  - an "Import ATES KMZ" file button (`accept=".kmz,application/vnd.google-earth.kmz"`)
  - the `atesOpacity` slider
  - a list of imported areas, each showing its name, zone counts by class, the import date, a "Show on map" button (`fitBounds` to the area boundary) and a Delete button with a confirm
  - a one-line pointer: "Download KMZ files from the Avalanche Canada Trip Planner (avalanche.ca/planning/trip-planner)."

  A successful import shows a toast through the existing import toast: "Imported Tunnel Creek South (18 zones)", "Updated …", or "…, 1 zone skipped". An `AtesImportError` shows as an error toast. Tests cover import, replace, delete and the error case. All colours are CSS custom properties except the class swatches.

- [ ] **Step 12.5.3: Drag and drop.** The map's dropzone also accepts `.kmz` and sends those files to `importAtesKmz`, while GPX files keep going to `runImport`. A drop with both kinds handles both. Test the routing.

- [ ] **Step 12.5.4:** It must fit at 375 px. `npm test`, `npm run typecheck`. Commit `feat: ATES switch, legend and area management`.

## Task 12.6 — Docs

- [ ] **Step 12.6.1: `DATA-MODEL.md`.** Add the `AtesClass`, `AtesFeature` and `AtesArea` types and the `ates_areas` table, note migration 4 and bundle version 2, and add the ATES FeatureCollection to "GeoJSON Structures".
- [ ] **Step 12.6.2: `ARCHITECTURE.md`.**
  - Storage Interface: the three methods.
  - Server › API: the `/api/ates-areas` routes.
  - Map Layer Architecture: the ATES layers and the stacking order.
  - Backup Format: `ates_areas` and v2.
  - A short "ATES Import" section: KMZ via `fflate`, then `DOMParser`, the class from `styleUrl` with the folder name as fallback, and what is dropped.
- [ ] **Step 12.6.3: `SPEC.md`.** Under Map and Layer System: imported ATES ratings with their source, the caveat and the fact that coverage is per area. Remove anything about ATES from Future Considerations if it's there.
- [ ] **Step 12.6.4: `AGENTS.md`.** Under Key Conventions: ATES data only comes from KMZ files the user imports, never from Avalanche Canada endpoints, and no Avalanche Canada data is committed to the repo. Update the `Never Do` StorageProvider implementations list if it needs it.
- [ ] **Step 12.6.5:** Commit `docs: ATES terrain ratings`.

## Task 12.7 — Browser QA

Run `npm run dev` with a real Maptiler key, import a real KMZ (Tunnel Creek South, which is in `~/Downloads`, not the repo), and drive it with Playwright.

- [ ] The import toast names the area and the zone count. The area appears in Settings with its counts by class.
- [ ] The zones line up with the terrain and with Avalanche Canada's Trip Planner. Spot-check two or three zone edges.
- [ ] Turning slope on together with ATES puts the slope raster under the ATES fills, and routes and tracks stay on top.
- [ ] The opacity slider updates live. The legend matches the classes present. The attribution shows only while the layer is on.
- [ ] Clicking a zone shows its class and definition. Clicking a route on top of a zone opens the route, not the popup.
- [ ] Switch basemap (topo → satellite → topo): the ATES layer comes back. Complex zones are readable on satellite.
- [ ] Importing the same KMZ again says "Updated" and doesn't duplicate the area.
- [ ] Export a ZIP, delete the area, re-import the ZIP, and the area is back. A pre-Phase-12 ZIP still restores.
- [ ] Dropping a `.kmz` onto the map imports it, and dropping a `.gpx` still imports a route.
- [ ] It fits at 375 px, with no console errors.

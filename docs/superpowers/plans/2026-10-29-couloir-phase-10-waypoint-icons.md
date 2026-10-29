# Couloir Phase 10 — Waypoint Icons and Colours — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leave browser-only verification steps unticked unless you actually ran them in a browser.

**Goal:** Every waypoint can carry its own icon (parking, skier, camp, cabin, …) and colour, chosen from a curated set of Google Material Symbols. A waypoint with neither set looks like its category, as it does today, except the category glyphs become real pictograms instead of letters.

**Decisions taken in planning (2026-10-29):**

1. **Icon source: Material Symbols, Rounded, filled (`FILL 1`), weight 400, 24 px optical size.** Licence Apache 2.0. Picked over MDI, NPS, Maki and Font Awesome because it covers the ski-touring vocabulary in one design language and its filled shapes stay readable at ~20 px over satellite imagery.
2. **No new dependencies. The path data is vendored.** Each Material Symbol is one SVG `<path>` on a `0 -960 960 960` viewBox (checked 2026-10-29). A small Node script (`scripts/fetch-material-symbols.mjs`) downloads the chosen icons from `google/material-design-icons` at a pinned commit (`10ecc14790612ca8fd164e3f4ffe9c16fc50d5b7`) and writes `src/icons/symbolPaths.ts`. The generated file is committed; the script only runs when the catalogue changes. The licence goes in `src/icons/LICENSE-material-symbols.txt`.
3. **A curated catalogue, not the full 3,000+ icon set.** About 28 icons in five groups (see Task 10.1). The stored value is the Material Symbol name (`'cabin'`, `'local_parking'`), so it stays readable in the database and in ZIP exports.
4. **The category stays. Icon and colour are per-waypoint overrides.** `icon` is a new nullable column, matching the existing nullable `color`. Null means "use the category default". `WAYPOINT_CATEGORIES[*].icon` becomes a `WaypointIcon` key. The categories themselves don't change in this phase.
5. **Unknown icon names read as `null`.** If an icon is ever dropped from the catalogue, or an import carries a name we don't know, the waypoint falls back to its category icon instead of rendering blank.
6. **Map images are generated on demand.** Each feature carries an `image` property such as `wp:cabin:22C55E`. A `styleimagemissing` handler parses the id, draws the disc and glyph, and calls `addImage`. This covers any icon and colour mix without registering every combination up front, and it re-registers images by itself after a basemap switch clears them.
7. **Icons are drawn at 2× pixel ratio** (`WAYPOINT_ICON_PIXEL_RATIO`), like photo thumbnails, so they stay sharp on high-DPI screens. The CSS size stays at `WAYPOINT_ICON_PX` (32).
8. **Swatch palette plus custom colour.** Ten preset swatches chosen to show up on both topo and satellite basemaps, plus a "Default" option and the existing native colour input with hex validation for anything else. The swatch hexes are literal in TypeScript because they're painted into canvas pixels. This is the same exception as `PHOTO_PIN_COLOR` and the slope bands.
9. **This fixes a latent bug.** `Waypoint.color` has been stored and editable since Phase 4, but `buildCategoryIcon` only ever reads the category colour, so the override never reached the map. After Task 10.3 it does.
10. **Icon and colour can be chosen when creating a waypoint, not only when editing it.** One shared `WaypointStyleFields` component serves both forms.

**Spec references:** `SPEC.md` (Waypoint, "Waypoints - rendered as categorized icons/markers"), `DATA-MODEL.md` (Waypoint, `waypoints` table, `WAYPOINT_CATEGORIES`), `ARCHITECTURE.md` (Map Layer Architecture), `TASKS.md` Tasks 10.1–10.6.

**Out of scope:** new waypoint categories (parking/camp/cabin stay icons, not categories), icons on routes, tracks or photos, waypoint icons in the search results list, GPX `<wpt>` symbol import/export, and a free-text search over the full Material Symbols set.

---

## File Structure

```
couloir/
├── AGENTS.md, ARCHITECTURE.md, DATA-MODEL.md, SPEC.md, TASKS.md   10.5 (docs), each task (ticks)
├── scripts/fetch-material-symbols.mjs                  10.1
├── src/
│   ├── icons/
│   │   ├── LICENSE-material-symbols.txt                10.1
│   │   ├── symbolPaths.ts                              10.1 (generated)
│   │   ├── waypointIcons.ts / .test.ts                 10.1 (catalogue, swatches, style resolution, image ids)
│   │   └── WaypointBadge.tsx / .module.css / .test.tsx 10.4
│   ├── types/index.ts                                  10.1 (category icons), 10.2 (Waypoint.icon)
│   ├── storage/
│   │   ├── migrations/3.sql, index.ts, index.test.ts   10.2
│   │   ├── sqlProvider.ts (+ test)                     10.2
│   │   ├── memory.ts                                   10.2
│   │   └── contract.ts                                 10.2
│   ├── dev/devConsole.ts                               10.2
│   ├── map/layers/
│   │   ├── layerStyles.ts                              10.3 (WAYPOINT_ICON_PIXEL_RATIO)
│   │   ├── wpIcons.ts / .test.ts                       10.3
│   │   ├── waypointsLayerData.ts / .test.ts            10.3
│   │   └── WaypointsLayer.tsx (+ test)                 10.3
│   └── panels/DetailPanel/
│       ├── WaypointStyleFields.tsx / .test.tsx         10.4
│       ├── WaypointCreate.tsx / .test.tsx              10.4
│       └── WaypointDetail.tsx / .test.tsx              10.4
```

**Conventions** (carried forward):
- Vitest globals. Plain `npm test` works; fall back to `npx vitest run --pool=forks --poolOptions.forks.singleFork=true` if esbuild hangs on Windows.
- Canvas drawing and `styleimagemissing` behaviour are checked in a real browser through Playwright. Logic lives in pure, tested helpers.
- `git` only through the PowerShell tool. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One feature commit per task, with the plan and TASKS.md ticks folded in.

**Branch:** `git switch -c phase-10-waypoint-icons` from an up-to-date `main` before Task 10.1.

---

## Task 10.1 — Icon catalogue

**Files:** `scripts/fetch-material-symbols.mjs`, `src/icons/symbolPaths.ts`, `src/icons/LICENSE-material-symbols.txt`, `src/icons/waypointIcons.ts`, `src/icons/waypointIcons.test.ts`, `src/types/index.ts`

- [x] **Step 10.1.1: Write the fetch script.** `scripts/fetch-material-symbols.mjs` (ESM, Node built-ins and global `fetch` only) holds the list of symbol names. For each name it fetches
  `https://raw.githubusercontent.com/google/material-design-icons/<SHA>/symbols/web/<name>/materialsymbolsrounded/<name>_fill1_24px.svg`,
  checks the response is 200 and the SVG has exactly one `<path d="…">` and viewBox `0 -960 960 960` (anything else is an error), then writes `src/icons/symbolPaths.ts`:

  ```ts
  // GENERATED by scripts/fetch-material-symbols.mjs — do not edit by hand.
  // Material Symbols Rounded, FILL 1, wght 400, opsz 24 (Apache 2.0, see
  // LICENSE-material-symbols.txt). Source commit: 10ecc147….
  export const SYMBOL_VIEWBOX = '0 -960 960 960'
  export const SYMBOL_PATHS = {
    cabin: 'M240-200h480v-80H240v80Z…',
    // …
  } as const satisfies Record<string, string>
  ```

  Keys are sorted so diffs stay small when the list changes.

- [x] **Step 10.1.2: Run it and vendor the licence.** `node scripts/fetch-material-symbols.mjs`. Copy the repo's `LICENSE` (Apache 2.0) at the same commit into `src/icons/LICENSE-material-symbols.txt`, with a one-line header naming the source and commit.

  The names, all confirmed to exist upstream on 2026-10-29:

  | Group | Key → label |
  |---|---|
  | Travel | `downhill_skiing` Skiing · `nordic_walking` Ski touring · `snowshoeing` Snowshoe · `sledding` Sled · `hiking` Hiking · `local_parking` Parking · `directions_car` Trailhead |
  | Shelter | `camping` Camp · `cabin` Cabin · `cottage` Hut · `local_fire_department` Fire · `water_drop` Water |
  | Terrain | `landscape` Summit · `flag` Flag · `route` Skin track · `fence` Gate · `arrow_downward` Rollover · `landslide` Cliff / slide · `snowing` Snow · `severe_cold` Cold |
  | Safety | `warning` Warning · `dangerous` Danger · `emergency` Emergency · `cell_tower` Cell signal |
  | General | `backpack` Cache · `photo_camera` Photo spot · `visibility` Viewpoint · `star` Favourite · `location_on` Pin |

- [x] **Step 10.1.3: Write the catalogue tests first** (`src/icons/waypointIcons.test.ts`):
  - every `WAYPOINT_ICONS` key has a non-empty entry in `SYMBOL_PATHS`, and every `SYMBOL_PATHS` key is in the catalogue (no orphans)
  - keys are unique; every group is one of the five
  - `isWaypointIcon('cabin')` is true; `isWaypointIcon('nope')`, `isWaypointIcon(null)` and `isWaypointIcon(3)` are false
  - every `WAYPOINT_CATEGORIES[*].icon` is a valid `WaypointIcon`
  - `WAYPOINT_SWATCHES` are unique, valid `#RRGGBB` hexes (reuse `isValidHex`)

- [x] **Step 10.1.4: Write `src/icons/waypointIcons.ts`.**

  ```ts
  import { SYMBOL_PATHS } from './symbolPaths'

  export type WaypointIconGroup = 'Travel' | 'Shelter' | 'Terrain' | 'Safety' | 'General'

  export const WAYPOINT_ICONS = [
    { key: 'downhill_skiing', label: 'Skiing', group: 'Travel' },
    // … the table above, in that order
  ] as const satisfies readonly { key: keyof typeof SYMBOL_PATHS; label: string; group: WaypointIconGroup }[]

  export type WaypointIcon = (typeof WAYPOINT_ICONS)[number]['key']

  export function isWaypointIcon(value: unknown): value is WaypointIcon { … }
  export function iconPath(icon: WaypointIcon): string { return SYMBOL_PATHS[icon] }
  export function iconLabel(icon: WaypointIcon): string { … }

  // Literal hex: painted into canvas pixels, where CSS custom properties can't reach.
  export const WAYPOINT_SWATCHES = [
    '#EF4444', '#F97316', '#FBBF24', '#22C55E', '#14B8A6',
    '#38BDF8', '#3B82F6', '#A78BFA', '#F472B6', '#334155',
  ] as const
  ```

- [x] **Step 10.1.5: Point the categories at real icons.** In `src/types/index.ts`, type the `icon` field of `WAYPOINT_CATEGORIES` as `WaypointIcon` (`import type` from `../icons/waypointIcons`) and set:
  `entry_gate → fence`, `cliff_band → landslide`, `rollover → arrow_downward`, `hazard → warning`, `skin_track → route`, `cache → backpack`, `summit → landscape`, `poi → star`, `other → location_on`.

- [x] **Step 10.1.6:** `npm test`, `npm run typecheck`. Commit `feat: vendor Material Symbols waypoint icon catalogue`.

## Task 10.2 — Waypoint icon field

**Files:** `src/storage/migrations/3.sql`, `src/storage/migrations/index.ts`, `src/storage/migrations/index.test.ts`, `src/types/index.ts`, `src/storage/sqlProvider.ts` (+ test), `src/storage/memory.ts`, `src/storage/contract.ts`, `src/dev/devConsole.ts`, `src/panels/DetailPanel/WaypointCreate.tsx`

- [x] **Step 10.2.1: Migration test first.** In `migrations/index.test.ts`, assert migration 3 matches `/ALTER TABLE waypoints ADD COLUMN icon TEXT/i`. The existing contiguity test covers the version bump.

- [x] **Step 10.2.2: Write `3.sql`** and register it (`SCHEMA_VERSION = 3`):

  ```sql
  -- Migration 3: a waypoint can override its category's icon with a
  -- Material Symbol name (see src/icons/waypointIcons.ts). NULL = category default.
  ALTER TABLE waypoints ADD COLUMN icon TEXT;
  ```

- [x] **Step 10.2.3: Add `icon: WaypointIcon | null` to `Waypoint`**, next to `color`, with the comment `// overrides category default if set`. Fix the type errors this causes: `devConsole.ts` (`icon: null`), `WaypointCreate.tsx` (`icon: null` for now, replaced in 10.4), the contract `buildWaypoint` fixture, and any test fixtures.

- [x] **Step 10.2.4: Contract tests** (`src/storage/contract.ts`, Waypoints block):
  - `icon` round-trips `null` and `'cabin'`
  - `saveWaypoint` overwrites `icon` (`'cabin'` → `null`)
  - `importAll` of a bundle whose waypoint has **no `icon` key** (simulating a pre-Phase-10 ZIP) stores `icon: null`. Build it with `const { icon: _icon, ...legacy } = buildWaypoint()` and cast through `unknown` with a comment explaining why.
  - `exportAll` carries `icon`

- [x] **Step 10.2.5: SQL provider.** Add `icon` to both `INSERT OR REPLACE INTO waypoints` column lists (in `saveWaypoint` and `importAll`, now 12 placeholders) and to `waypointToRow` as `w.icon ?? null`, so legacy bundles don't pass `undefined` to SQLite. In `rowToWaypoint`: `icon: isWaypointIcon(row.icon) ? row.icon : null`. In the SQL provider's own test, add a case: a row written with `icon = 'not_an_icon'` reads back as `null`.

- [x] **Step 10.2.6: In-memory provider.** Normalise on save and import (`icon: w.icon ?? null`) so the legacy-bundle contract case passes there too. `HttpStorageProvider` and `server/app.ts` pass JSON through unchanged, so check with the contract suite that they need no edits.

- [x] **Step 10.2.7:** `npm test`, `npm run typecheck`. Commit `feat: per-waypoint icon field (migration 3)`.

## Task 10.3 — Render icon and colour on the map

**Files:** `src/map/layers/layerStyles.ts`, `src/icons/waypointIcons.ts` (+ test), `src/map/layers/wpIcons.ts` (+ test), `src/map/layers/waypointsLayerData.ts` (+ test), `src/map/layers/WaypointsLayer.tsx` (+ test)

- [x] **Step 10.3.1: Style resolution and image ids, tests first** (in `waypointIcons.test.ts`):

  ```ts
  export function resolveWaypointStyle(
    w: Pick<Waypoint, 'category' | 'icon' | 'color'>,
  ): { icon: WaypointIcon; color: string }   // color normalised to upper-case #RRGGBB

  export function waypointImageId(icon: WaypointIcon, color: string): string  // 'wp:cabin:22C55E'
  export function parseWaypointImageId(id: string): { icon: WaypointIcon; color: string } | null
  ```

  Cases: null icon or colour falls back to the category default, overrides win, lower-case hex is upper-cased, `parse(id(x)) === x` for every catalogue icon, and `parse` returns null for foreign ids (`'photo-placeholder'`, `'wp-summit'`, `'wp:nope:FFFFFF'`, `'wp:cabin:XYZ'`). These belong in `src/icons/` rather than the map layer because the panel badge (10.4) uses `resolveWaypointStyle` too. `Waypoint` is an `import type`, so there's no cycle at runtime.

- [x] **Step 10.3.2: Rewrite `wpIcons.ts`.** Replace `GLYPHS`, `categoryGlyph` and `buildCategoryIcon` with:

  ```ts
  // Disc in `color` with a white halo and a white Material Symbol glyph,
  // drawn at WAYPOINT_ICON_PIXEL_RATIO× for high-DPI screens.
  export function buildWaypointIcon(icon: WaypointIcon, color: string): {
    data: ImageData
    pixelRatio: number
  }
  ```

  Draw at `size = WAYPOINT_ICON_PX * WAYPOINT_ICON_PIXEL_RATIO` (add `WAYPOINT_ICON_PIXEL_RATIO = 2` to `layerStyles.ts`). Keep the current disc and halo, with the line width scaled by the ratio. Glyph: side `g = size * 0.6`; `ctx.translate(cx - g / 2, cy - g / 2)`, `ctx.scale(g / 960, g / 960)`, `ctx.translate(0, 960)` (the viewBox starts at y = −960), then `ctx.fill(new Path2D(iconPath(icon)))` in white. If `Path2D` is undefined (jsdom), draw the disc only. Keep `makeEmptyImageData` and the no-canvas fallback.

  Tests: the returned size is `WAYPOINT_ICON_PX * WAYPOINT_ICON_PIXEL_RATIO` square, `pixelRatio` is 2, and a call never throws for any catalogue icon with any swatch.

- [x] **Step 10.3.3: GeoJSON carries the image id.** `buildWaypointsGeoJson` adds `image: waypointImageId(...Object.values(resolveWaypointStyle(w)))`, or the clearer destructured form. Keep `category` too. Test: an override waypoint gets `wp:cabin:EF4444`, a plain `summit` gets `wp:landscape:FBBF24`.

- [x] **Step 10.3.4: Layer wiring, tests first** (`WaypointsLayer.test.tsx`):
  - `icon-image` is `['get', 'image']`
  - a `styleimagemissing` listener is registered before `addLayer`. Calling it with `{ id: 'wp:cabin:22C55E' }` calls `addImage('wp:cabin:22C55E', expect.anything(), { pixelRatio: 2 })`. Calling it with `{ id: 'photo-placeholder' }` does nothing, and it does nothing when `hasImage` returns true.
  - the listener is removed on unmount

  Then in `WaypointsLayer.tsx`: drop the per-category `addImage` loop, add an `onImageMissing` handler next to the other handlers, register it with `map.on('styleimagemissing', …)` at the top of the effect so it is in place before any `install()`, and `map.off` it in the cleanup. The handler is the only place waypoint images get created, so the photo layer's placeholder ids never reach it.

- [x] **Step 10.3.5:** `npm test`, `npm run typecheck`. Commit `feat: draw waypoint icons and colour overrides on the map`.

## Task 10.4 — Icon and colour picker

**Files:** `src/icons/WaypointBadge.tsx` / `.module.css` / `.test.tsx`, `src/panels/DetailPanel/WaypointStyleFields.tsx` / `.test.tsx`, `WaypointCreate.tsx` (+ test), `WaypointDetail.tsx` (+ test), `DetailPanel.shared.module.css`

- [ ] **Step 10.4.1: `WaypointBadge`.** `<WaypointBadge icon color size?={24} />` renders a round `span` with `background-color: color` (an inline style, because the colour is data, not theme) and an inline `<svg viewBox={SYMBOL_VIEWBOX}><path d={iconPath(icon)} fill="currentColor" /></svg>` in white. `aria-hidden` by default, or `role="img"` with `aria-label` when a `label` prop is passed. Test: renders the path for the given icon and applies the colour.

- [ ] **Step 10.4.2: `WaypointStyleFields`, tests first.** Props: `{ category, icon, color, onIconChange(icon | null), onColorChange(hex | null) }`.
  - A preview `WaypointBadge` of the resolved style at 40 px.
  - **Icon:** a `role="radiogroup"` labelled "Icon". The first radio is "Category default" (it shows the category's icon), followed by the catalogue under its group headings. Each option is a 40 × 40 button with `role="radio"`, `aria-checked` and `aria-label={label}`. Arrow keys move between options within the group.
  - **Colour:** a `role="radiogroup"` labelled "Colour", with "Default" (category colour), then the ten `WAYPOINT_SWATCHES`, then a "Custom" native `<input type="color">` plus the existing hex text input and `isValidHex` check. Choosing a swatch or "Default" clears an invalid custom entry.
  - Tests: selecting an icon calls `onIconChange('cabin')`. "Category default" calls `onIconChange(null)`. Swatches and Default call `onColorChange` with the hex or null. An invalid hex shows "Use #RRGGBB hex." The preview follows `category` when `icon` is null.
  - It must fit at 375 px: the grid wraps with `grid-template-columns: repeat(auto-fill, minmax(40px, 1fr))`. Every colour comes from CSS custom properties except the swatch fills.

- [ ] **Step 10.4.3: Wire into the forms.** `WaypointCreate` gains `icon`/`color` state (both start null) and saves them. `WaypointEdit` replaces its "Color override" block with `WaypointStyleFields` and re-syncs `icon` in the upstream-change effect. `canSave` still blocks an invalid custom hex. Update both test files: creating with an icon and swatch saves them, and editing back to "Category default" saves `icon: null`.

- [ ] **Step 10.4.4: Show it in the view.** `WaypointView` puts a 28 px `WaypointBadge` (labelled with the icon name) before the heading, so the panel matches the map.

- [ ] **Step 10.4.5:** `npm test`, `npm run typecheck`. Commit `feat: icon and colour picker for waypoints`.

## Task 10.5 — Docs

- [ ] **Step 10.5.1: `DATA-MODEL.md`.** Add `icon` to the `Waypoint` interface and the `waypoints` table, update the `WAYPOINT_CATEGORIES` snippet to the Material Symbol keys, and note migration 3.
- [ ] **Step 10.5.2: `ARCHITECTURE.md`.** Add `src/icons/` to the folder tree. Under Map Layer Architecture, describe the `wp:<icon>:<HEX>` image ids generated on demand by `styleimagemissing`.
- [ ] **Step 10.5.3: `SPEC.md`.** Waypoints get a per-waypoint icon (curated Material Symbols) and colour, both defaulting to the category.
- [ ] **Step 10.5.4: `AGENTS.md`.** Under Key Conventions: waypoint icons are vendored Material Symbols in `src/icons/`; add one by editing the catalogue and the fetch script and re-running it, and never add an icon package.
- [ ] **Step 10.5.5:** Commit `docs: waypoint icons and colours`.

## Task 10.6 — Browser QA

Run `npm run dev` with a real Maptiler key and drive it with Playwright.

- [ ] Existing waypoints (no overrides) show their category's new pictogram in the category colour
- [ ] Set a waypoint to Parking + a red swatch: the map updates immediately, with no reload
- [ ] A custom hex colour shows on the map (the Phase 4 colour override now visibly works)
- [ ] Switch basemap (topo → satellite → topo): every waypoint icon comes back
- [ ] Icons are crisp at 2× device pixel ratio and readable on satellite imagery
- [ ] Create a new waypoint with Cabin + teal; reload; it persists
- [ ] Export a ZIP, re-import it, and the overrides survive. A pre-Phase-10 ZIP (if one is to hand) imports with category icons.
- [ ] The picker fits at 375 px with no horizontal scroll, and is keyboard-navigable
- [ ] Drag-to-reposition still works on an overridden waypoint
- [ ] No console errors

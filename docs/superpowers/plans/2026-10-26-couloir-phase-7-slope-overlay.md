# Couloir Phase 7 — Slope Angle Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leave browser-only verification steps unticked unless you actually ran them in a browser.

**Goal:** A toggleable map overlay that colours terrain by slope angle using the standard avalanche bands (27–30°, 30–35°, 35–40°, 40–45°, 45°+). Slope is computed in the browser from the Maptiler terrain-rgb tiles the app already uses for 3D terrain.

**Decisions taken in planning (2026-10-26):**

1. **No new dependencies.** Slope tiles come from a MapLibre custom protocol (`maplibregl.addProtocol('slope', …)`). For each `slope://{z}/{x}/{y}` request it fetches the matching Maptiler terrain-rgb tile, decodes the elevations, computes slope, colours it and returns a PNG to an ordinary `raster` source. No third-party slope tiles: CalTopo and Gaia have no usable API, and OpenSlopeMap's coverage of the Canadian Rockies is unknown.
2. **Pure maths, thin I/O.** Decoding, slope, colouring and URL parsing are pure functions with unit tests. The image decode/encode (`createImageBitmap`, `OffscreenCanvas`) sits behind a small `TileCodec` interface. The tile handler is tested with a fake codec and fake `fetch`, and the real codec is checked in the browser.
3. **Horn's method with edge extrapolation.** Slope uses the standard 3×3 Horn kernel. Instead of fetching 8 neighbour tiles for edge pixels, the elevation grid is extended one pixel past each edge by linear extrapolation (`2·edge − inner`). A uniform plane then gives exactly the right slope at every pixel, corners included, so seams should be negligible. Fetching neighbours stays a fallback if QA shows visible seams.
4. **Ground pixel size uses the tile's centre latitude.** `cos(lat)` changes by under 1 % across a zoom-10 tile at 49°N, so working it out per row isn't worth the cost.
5. **The tile URL template comes from `tiles.json`, not hard-coded.** The handler fetches `terrainSourceUrl(key)` once per key, caches the promise and fills in `tiles[0]`. If Maptiler changes its tile format or extension, nothing breaks. A failed fetch is dropped from the cache so the next tile retries.
6. **The overlay sits under basemap labels and under our own layers.** It is inserted before the basemap's first `symbol` layer. If the style has no symbol layer, it goes before the first Couloir layer present. This keeps the order right no matter which `style.load` listener runs first.
7. **Off by default.** Slope tiles count against the Maptiler quota. Whether it's on, and its opacity (0.2–1, default 0.6), are both saved in `localStorage` (`couloir_slope_enabled`, `couloir_slope_opacity`) so it stays on across sessions once enabled. These are UI preferences, not sensitive data.
8. **Hidden below zoom 10** (`SLOPE_MIN_ZOOM`). Below that, a pixel covers 50 m or more and the slope values are meaningless. Above the DEM's maximum zoom, MapLibre stretches the last available tile.
9. **The controls live in the existing `TerrainControl` box:** a "Slope angle" switch, an opacity slider and a legend. No second floating panel to fight for room on mobile.
10. **Missing DEM tiles (404/204) give a transparent tile, not an error,** so tiles over open ocean or outside coverage don't set off the tile-error banner. Other HTTP errors are still thrown, so a revoked key or exhausted quota still trips the banner.
11. **Band colours are literal hex in TypeScript** (`SLOPE_BANDS`). They're painted into pixel data, so CSS custom properties can't reach them. The legend reads the same constants. Same exception as `PHOTO_PIN_COLOR`.
12. **Slope is computed on the main thread for now.** MapLibre runs protocol handlers there anyway, and a 512² tile is a few milliseconds of work. Moving it to a background thread is a follow-up only if QA shows pan or zoom stutter.

**Spec references:** `SPEC.md` (Future Considerations: "Slope angle shading derived from Maptiler terrain tiles"), `ARCHITECTURE.md` (Maptiler Integration, Map Layer Architecture, State Management), `TASKS.md` Tasks 7.1–7.6.

**Out of scope:** aspect shading (the maths module leaves room for it later), ATES zone polygons, slope readout on hover/click, slope stats on the elevation profile, offline caching of slope tiles.

---

## File Structure

```
couloir/
├── ARCHITECTURE.md, SPEC.md, TASKS.md               7.6 (docs), each task (ticks)
├── src/
│   ├── main.tsx                                     7.2 (registerSlopeProtocol)
│   ├── map/
│   │   ├── slope/
│   │   │   ├── slopeMath.ts / slopeMath.test.ts     7.1
│   │   │   ├── slopeBands.ts / slopeBands.test.ts   7.1
│   │   │   ├── slopeProtocol.ts / .test.ts          7.2
│   │   │   └── browserCodec.ts                      7.2
│   │   ├── layers/layerStyles.ts                    7.4 (slope ids + constants)
│   │   ├── layers/SlopeLayer.tsx / .test.tsx        7.4
│   │   ├── controls/TerrainControl.tsx / .test.tsx / .module.css   7.5
│   │   ├── controls/SlopeLegend.tsx                 7.5
│   │   └── MapView.tsx                              7.4 (<SlopeLayer />)
│   ├── store/ui.ts / ui.test.ts                     7.3
│   └── test/mocks/maplibre-gl.ts                    7.2 (addProtocol), 7.4 (setPaintProperty, getStyle)
```

**Conventions** (carried forward):
- Vitest globals. Plain `npm test` works; fall back to `npx vitest run --pool=forks --poolOptions.forks.singleFork=true` if esbuild hangs on Windows.
- Real-browser behaviour (tile rendering, decode/encode, perf) is verified through Playwright with a real Maptiler key. Logic lives in pure, tested helpers.
- `git` only through the PowerShell tool. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One feature commit per task, with the plan and TASKS.md ticks folded in.

**Branch:** `git switch -c phase-7-slope-overlay` from an up-to-date `main` before Task 7.1.

---

## Task 7.0 — Confirm the DEM tile facts

Browser-only and quick. The constants in 7.4 depend on it.

- [ ] **Step 7.0.1:** With the dev server running and a key set, run this in the console: `fetch('https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=' + localStorage.couloir_maptiler_key).then(r => r.json())`. Record `tiles[0]` (the URL template and file extension), `maxzoom`, `tileSize` (if present) and `encoding`.
- [ ] **Step 7.0.2:** Fetch one tile near Fernie (z12/738/1397, which contains 49.50°N, −115.06°W), decode it with `createImageBitmap`, and record its pixel width. Expected: 512 px, Mapbox terrain-rgb encoding (`-10000 + (R·65536 + G·256 + B) · 0.1`), maxzoom about 14.
- [ ] **Step 7.0.3:** If anything differs from those expectations, update the `DEM_TILE_SIZE` / `DEM_MAX_ZOOM` values in Step 7.4.1 and the decode formula in 7.1 **before** starting. Note the confirmed values under this task.

---

## Task 7.1 — Slope maths and colour bands

**Files:**
- Create: `src/map/slope/slopeMath.ts`, `slopeMath.test.ts`
- Create: `src/map/slope/slopeBands.ts`, `slopeBands.test.ts`

Ends with: pure, tested functions that turn terrain-rgb pixels into an RGBA slope image.

- [x] **Step 7.1.1: Tests first — `slopeMath.test.ts`**

```ts
import { decodeTerrainRgb, metersPerPixel, slopeDegrees, tileCenterLat } from './slopeMath'

// Encodes an elevation (m) as terrain-rgb, the inverse of decodeTerrainRgb.
function encode(elevM: number): [number, number, number] {
  const v = Math.round((elevM + 10000) * 10)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function plane(w: number, h: number, f: (x: number, y: number) => number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = f(x, y)
  return out
}

describe('decodeTerrainRgb', () => {
  it('round-trips elevations at 0.1 m precision', () => {
    const elevs = [0, 1234.5, 3618.9, -50]
    const rgba = new Uint8ClampedArray(elevs.length * 4)
    elevs.forEach((e, i) => { rgba.set([...encode(e), 255], i * 4) })
    const out = decodeTerrainRgb(rgba, elevs.length, 1)
    elevs.forEach((e, i) => expect(out[i]).toBeCloseTo(e, 1))
  })
})

describe('tileCenterLat / metersPerPixel', () => {
  it('is 0° at the centre of the z0 tile', () => {
    expect(tileCenterLat(0, 0)).toBeCloseTo(0, 6)
  })
  it('matches the Web Mercator ground resolution at Fernie (z12, 512 px)', () => {
    // Tile row containing 49.5°N at z12 is 1397.
    const mpp = metersPerPixel(12, 1397, 512)
    const expected = (40_075_016.686 * Math.cos((tileCenterLat(12, 1397) * Math.PI) / 180)) / (512 * 4096)
    expect(mpp).toBeCloseTo(expected, 6)
    expect(mpp).toBeGreaterThan(12)
    expect(mpp).toBeLessThan(13)
  })
})

describe('slopeDegrees', () => {
  const W = 6, H = 5, CELL = 10

  it('is 0 everywhere on flat ground', () => {
    const s = slopeDegrees(plane(W, H, () => 1500), W, H, CELL)
    s.forEach((v) => expect(v).toBeCloseTo(0, 6))
  })

  it.each([0, 27, 30, 35, 45, 60])('is %i° at every pixel, edges and corners included, on a tilted plane', (deg) => {
    const rise = CELL * Math.tan((deg * Math.PI) / 180)
    const s = slopeDegrees(plane(W, H, (x) => 1000 + x * rise), W, H, CELL)
    s.forEach((v) => expect(v).toBeCloseTo(deg, 4))
  })

  it('handles a plane tilted along y and on the diagonal', () => {
    const rise = CELL * Math.tan((35 * Math.PI) / 180)
    const sy = slopeDegrees(plane(W, H, (_x, y) => 1000 - y * rise), W, H, CELL)
    sy.forEach((v) => expect(v).toBeCloseTo(35, 4))
    // Gradient magnitude along the diagonal: rise·√2 per cell when both axes rise by `rise`.
    const sd = slopeDegrees(plane(W, H, (x, y) => x * rise + y * rise), W, H, CELL)
    const expected = (Math.atan(Math.SQRT2 * Math.tan((35 * Math.PI) / 180)) * 180) / Math.PI
    sd.forEach((v) => expect(v).toBeCloseTo(expected, 4))
  })
})
```

- [x] **Step 7.1.2: Implement `slopeMath.ts`**

```ts
// Slope maths for the slope-angle overlay. Pure functions over row-major
// grids; no DOM or MapLibre types so everything is unit-testable.

const EARTH_CIRCUMFERENCE_M = 40_075_016.686
const DEG = 180 / Math.PI

// Mapbox/Maptiler terrain-rgb: elevation = -10000 + (R·65536 + G·256 + B) · 0.1
export function decodeTerrainRgb(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i++) {
    const o = i * 4
    out[i] = -10000 + (rgba[o] * 65536 + rgba[o + 1] * 256 + rgba[o + 2]) * 0.1
  }
  return out
}

// Latitude (degrees) at the vertical centre of Web Mercator tile row y.
export function tileCenterLat(z: number, y: number): number {
  const n = Math.PI - (2 * Math.PI * (y + 0.5)) / 2 ** z
  return DEG * Math.atan(Math.sinh(n))
}

// Ground metres per pixel at the tile's centre latitude. Using one value per
// tile is < 1% off at z ≥ 10, which is below DEM noise.
export function metersPerPixel(z: number, y: number, tileSizePx: number): number {
  const lat = tileCenterLat(z, y) / DEG
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat)) / (tileSizePx * 2 ** z)
}

// Slope in degrees per pixel using Horn's 3×3 kernel. Pixels past the tile
// edge are linearly extrapolated (2·edge − inner) so a plane yields the exact
// slope at the borders, avoiding a neighbour-tile fetch.
export function slopeDegrees(
  elev: Float32Array,
  width: number,
  height: number,
  cellSizeM: number,
): Float32Array {
  const at = (x: number, y: number): number => {
    if (x < 0) return 2 * at(0, y) - at(1, y)
    if (x >= width) return 2 * at(width - 1, y) - at(width - 2, y)
    if (y < 0) return 2 * at(x, 0) - at(x, 1)
    if (y >= height) return 2 * at(x, height - 1) - at(x, height - 2)
    return elev[y * width + x]
  }
  const out = new Float32Array(width * height)
  const denom = 8 * cellSizeM
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1)
      const d = at(x - 1, y),                       f = at(x + 1, y)
      const g = at(x - 1, y + 1), h = at(x, y + 1), i = at(x + 1, y + 1)
      const dzdx = (c + 2 * f + i - (a + 2 * d + g)) / denom
      const dzdy = (g + 2 * h + i - (a + 2 * b + c)) / denom
      out[y * width + x] = DEG * Math.atan(Math.hypot(dzdx, dzdy))
    }
  }
  return out
}
```

The interior can skip `at()` for speed if profiling in 7.6 shows the closure matters. Leave it simple until then.

- [x] **Step 7.1.3: Tests — `slopeBands.test.ts`**

```ts
import { SLOPE_BANDS, bandForSlope, colorizeSlope } from './slopeBands'

describe('bandForSlope', () => {
  it.each([
    [0, null], [26.9, null],
    [27, '27–29°'], [29.99, '27–29°'],
    [30, '30–34°'], [35, '35–39°'], [40, '40–44°'],
    [45, '45°+'], [70, '45°+'],
  ])('%f° → %s', (deg, label) => {
    expect(bandForSlope(deg)?.label ?? null).toBe(label)
  })
})

describe('colorizeSlope', () => {
  it('writes band colours opaque and below-threshold pixels fully transparent', () => {
    const rgba = colorizeSlope(new Float32Array([10, 32]))
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    const orange = SLOPE_BANDS[1].color
    expect(Array.from(rgba.slice(4, 8))).toEqual([
      parseInt(orange.slice(1, 3), 16), parseInt(orange.slice(3, 5), 16), parseInt(orange.slice(5, 7), 16), 255,
    ])
  })
})
```

- [x] **Step 7.1.4: Implement `slopeBands.ts`**

```ts
// Avalanche slope-angle bands. Literal hex (not CSS variables) because the
// colours are painted into raster pixels; the legend reads the same table.
export interface SlopeBand {
  minDeg: number
  maxDeg: number // exclusive
  color: string
  label: string
}

export const SLOPE_BANDS: readonly SlopeBand[] = [
  { minDeg: 27, maxDeg: 30,       color: '#F5E400', label: '27–29°' },
  { minDeg: 30, maxDeg: 35,       color: '#F59E0B', label: '30–34°' },
  { minDeg: 35, maxDeg: 40,       color: '#EF4444', label: '35–39°' },
  { minDeg: 40, maxDeg: 45,       color: '#A855F7', label: '40–44°' },
  { minDeg: 45, maxDeg: Infinity, color: '#111111', label: '45°+' },
]

const BAND_RGB = SLOPE_BANDS.map((b) => [
  parseInt(b.color.slice(1, 3), 16),
  parseInt(b.color.slice(3, 5), 16),
  parseInt(b.color.slice(5, 7), 16),
])

export function bandForSlope(deg: number): SlopeBand | null {
  return SLOPE_BANDS.find((b) => deg >= b.minDeg && deg < b.maxDeg) ?? null
}

// RGBA image: band colour at full alpha, transparent below the first band.
// Overall translucency comes from the layer's raster-opacity.
export function colorizeSlope(slope: Float32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(slope.length * 4)
  for (let i = 0; i < slope.length; i++) {
    const idx = SLOPE_BANDS.findIndex((b) => slope[i] >= b.minDeg && slope[i] < b.maxDeg)
    if (idx === -1) continue
    out.set(BAND_RGB[idx], i * 4)
    out[i * 4 + 3] = 255
  }
  return out
}
```

- [x] **Step 7.1.5:** `npm test -- slope` and `npm run typecheck` pass. Commit `feat(slope): slope maths and avalanche colour bands`.

---

## Task 7.2 — Slope tile protocol

**Files:**
- Create: `src/map/slope/slopeProtocol.ts`, `slopeProtocol.test.ts`
- Create: `src/map/slope/browserCodec.ts`
- Modify: `src/main.tsx`, `src/test/mocks/maplibre-gl.ts`

Ends with: `slope://{z}/{x}/{y}` requests resolve to coloured PNG tiles.

- [x] **Step 7.2.1: Tests first — `slopeProtocol.test.ts`.** Use a fake `TileCodec` whose `decode` returns a hand-built terrain-rgb grid (a 4×4 plane at a known slope) and whose `encodePng` records its arguments and returns `new ArrayBuffer(8)`. Use a fake `fetchFn` that serves `tiles.json` and tile URLs from a map. Cover:
  - `parseSlopeUrl('slope://12/738/1397')` → `{ z: 12, x: 738, y: 1397 }`; malformed URLs → `null`.
  - The loader fills in the `tiles.json` template (`{z}/{x}/{y}`) and requests that tile URL, passing the abort signal through.
  - `tiles.json` is fetched **once** across several tile requests with the same key, and again after the key changes.
  - A failed `tiles.json` fetch is not cached: the next request retries.
  - The pixels handed to `encodePng` are the band colour for the plane's slope. Pick a slope inside one band, e.g. 32° → orange.
  - DEM 404 → resolves to a 1×1 transparent tile, no throw. DEM 500 → rejects.
  - No key → rejects with a clear error.
  - Malformed URL → rejects.

- [x] **Step 7.2.2: Implement `slopeProtocol.ts`**

```ts
import type { RequestParameters, GetResourceResponse } from 'maplibre-gl'
import { decodeTerrainRgb, metersPerPixel, slopeDegrees } from './slopeMath'
import { colorizeSlope } from './slopeBands'
import { terrainSourceUrl } from '../mapConfig'

export const SLOPE_PROTOCOL = 'slope'
export const SLOPE_TILE_URL = `${SLOPE_PROTOCOL}://{z}/{x}/{y}`

export interface DecodedImage { rgba: Uint8ClampedArray; width: number; height: number }

export interface TileCodec {
  decode(blob: Blob): Promise<DecodedImage>
  encodePng(rgba: Uint8ClampedArray, width: number, height: number): Promise<ArrayBuffer>
}

export interface SlopeLoaderDeps {
  fetchFn: typeof fetch
  codec: TileCodec
  getKey: () => string | null
}

export function parseSlopeUrl(url: string): { z: number; x: number; y: number } | null { … }

export function createSlopeLoader(deps: SlopeLoaderDeps) {
  // key → promise of the DEM tile URL template from tiles.json
  const templates = new Map<string, Promise<string>>()
  …
  return async (params: RequestParameters, abort: AbortController): Promise<GetResourceResponse<ArrayBuffer>> => {
    // 1. parse z/x/y   2. template for current key (memoised, evict on failure)
    // 3. fetch DEM tile with abort.signal; 404/204 → transparent 1×1
    // 4. decode → decodeTerrainRgb → slopeDegrees(metersPerPixel(z, y, width)) → colorizeSlope
    // 5. encodePng → { data }
  }
}

let registered = false
export function registerSlopeProtocol(addProtocol: (name: string, fn: ReturnType<typeof createSlopeLoader>) => void, deps: SlopeLoaderDeps): void {
  if (registered) return
  registered = true
  addProtocol(SLOPE_PROTOCOL, createSlopeLoader(deps))
}
```

Wire `getKey` live to `useSettingsStore.getState().maptilerKey` in `main.tsx`, so a key change takes effect without registering again. `{ data }` must be an `ArrayBuffer` of an encoded image: MapLibre 4 decodes raster responses itself. Add `debug('slope tile', z, x, y, ms)` timing behind the existing `debug()` util for the 7.6 perf check.

- [x] **Step 7.2.3: Implement `browserCodec.ts`**

```ts
import type { TileCodec } from './slopeProtocol'

// Real-browser codec. colorSpaceConversion/premultiplyAlpha 'none' are
// required: any colour management would corrupt the encoded elevations.
export const browserCodec: TileCodec = {
  async decode(blob) {
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { rgba: data, width: canvas.width, height: canvas.height }
  },
  async encodePng(rgba, width, height) {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
    return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
  },
}
```

Not unit-tested, because jsdom has no `OffscreenCanvas`. It's covered in 7.6.

- [x] **Step 7.2.4:** In `main.tsx`, call `registerSlopeProtocol(maplibregl.addProtocol, { fetchFn: fetch.bind(globalThis), codec: browserCodec, getKey: () => useSettingsStore.getState().maptilerKey })` before rendering. Add `addProtocol: vi.fn()` (and `removeProtocol`) to the default export of `src/test/mocks/maplibre-gl.ts`.

- [x] **Step 7.2.5:** Tests and typecheck pass. Commit `feat(slope): slope tile protocol over Maptiler terrain-rgb`.

---

## Task 7.3 — UI store: slope toggle and opacity

**Files:**
- Modify: `src/store/ui.ts`, `src/store/ui.test.ts`

- [x] **Step 7.3.1: Tests first.** In a new `describe('ui store — slope overlay')`:
  - It defaults to off with opacity 0.6.
  - `toggleSlope` flips it and writes `couloir_slope_enabled` (`'true'`/`'false'`).
  - `setSlopeOpacity` clamps to 0.2–1 and writes `couloir_slope_opacity`.
  - `hydrateFromStorage` restores both. Garbage values fall back to the defaults, the same as the terrain/basemap handling.

- [x] **Step 7.3.2: Implement.** Add `slopeEnabled`, `slopeOpacity`, `toggleSlope` and `setSlopeOpacity` to `UiState`, under a `// Phase 7 — slope overlay` comment. Extend `hydrateFromStorage`. Export `SLOPE_OPACITY_MIN = 0.2` and `SLOPE_OPACITY_MAX = 1` for the slider.

- [x] **Step 7.3.3:** Tests and typecheck pass. Commit `feat(ui): slope overlay toggle and opacity state`.

---

## Task 7.4 — SlopeLayer on the map

**Files:**
- Modify: `src/map/layers/layerStyles.ts`
- Create: `src/map/layers/SlopeLayer.tsx`, `SlopeLayer.test.tsx`
- Modify: `src/map/MapView.tsx`, `src/test/mocks/maplibre-gl.ts`

- [ ] **Step 7.4.1: Constants in `layerStyles.ts`** (values confirmed in 7.0):

```ts
export const SLOPE_SOURCE_ID = 'slope-source'
export const SLOPE_LAYER_ID = 'slope-raster'
// Below this a DEM pixel covers ≥ ~50 m and slope values are meaningless.
export const SLOPE_MIN_ZOOM = 10
// Maptiler terrain-rgb-v2: pixel size of one tile and deepest zoom served.
export const DEM_TILE_SIZE = 512
export const DEM_MAX_ZOOM = 14
```

- [ ] **Step 7.4.2: Mock additions.** Add `setPaintProperty = vi.fn()` and `getStyle = vi.fn(() => ({ layers: [] as { id: string; type: string }[] }))` to `MockMap`.

- [ ] **Step 7.4.3: Tests first — `SlopeLayer.test.tsx`.** Follow the existing layer tests (map set through `setMap`, `MockMap`):
  - On install it adds a `raster` source with `tiles: [SLOPE_TILE_URL]`, `tileSize: DEM_TILE_SIZE`, `minzoom: SLOPE_MIN_ZOOM`, `maxzoom: DEM_MAX_ZOOM`, and a `raster` layer with `minzoom: SLOPE_MIN_ZOOM`, `raster-opacity` from the store, `raster-fade-duration: 0`, and `visibility` from `slopeEnabled`.
  - `beforeId` is the first `symbol` layer in `getStyle().layers`. If there is none, it is the first Couloir layer present (`ROUTES_GLOW_LAYER_ID`, `TRACKS_LINE_LAYER_ID`, …). Otherwise it is `undefined`.
  - Toggling `slopeEnabled` calls `setLayoutProperty(SLOPE_LAYER_ID, 'visibility', …)`. Changing the opacity calls `setPaintProperty(SLOPE_LAYER_ID, 'raster-opacity', …)`.
  - It installs again on `style.load` (basemap switch) and doesn't add the source twice.
  - Unmount removes the layer and source if present.

- [ ] **Step 7.4.4: Implement `SlopeLayer.tsx`.** Follow the `RoutesLayer` pattern: install on `style.load` (and straight away if the style is already loaded), read fresh state through `getState()`, and keep separate effects for visibility and opacity. The layer is **always** installed, and toggling only changes visibility. That keeps its position in the layer stack fixed and doesn't throw away tiles already computed.

- [ ] **Step 7.4.5:** Render `<SlopeLayer />` in `MapView.tsx` **before** `<RoutesLayer />` (for readability; `beforeId` is what actually guarantees the order).

- [ ] **Step 7.4.6:** Tests and typecheck pass. Commit `feat(map): slope angle raster layer`.

---

## Task 7.5 — Controls and legend

**Files:**
- Modify: `src/map/controls/TerrainControl.tsx`, `TerrainControl.test.tsx`, `TerrainControl.module.css`
- Create: `src/map/controls/SlopeLegend.tsx`

- [ ] **Step 7.5.1: Tests first** (extend `TerrainControl.test.tsx`):
  - It renders a `switch` named "Slope angle", unchecked by default. Clicking it toggles `slopeEnabled`.
  - The "Slope opacity" slider is disabled while slope is off and updates `slopeOpacity` when changed.
  - The legend (`role="list"`, name "Slope angle legend") appears only while slope is on, has one item per `SLOPE_BANDS` entry, and shows the caveat text.
  - When `map.getZoom()` is below `SLOPE_MIN_ZOOM`, the hint "Zoom in to see slope" appears. It updates on `zoomend`.

- [ ] **Step 7.5.2: Implement.** Add a second section to `TerrainControl`, separated by a divider: the switch, the opacity slider (shown as a percentage) and `<SlopeLegend />`. The legend shows a swatch and label for each band, using inline `style={{ background: band.color }}` (the swatch for the near-black band needs a `--color-border` outline). The caveat line reads: "Approximate. Computed from ~30 m elevation data; short steep features read low. Not a substitute for field assessment." Style it with the existing `--color-text-dim` and spacing variables.

- [ ] **Step 7.5.3: Mobile.** Check that the larger control still clears the mobile tab bar at 375 px. If the legend makes it too tall, collapse the legend behind a "Legend" disclosure on narrow screens with `useMediaQuery`.

- [ ] **Step 7.5.4:** Tests and typecheck pass. Commit `feat(map): slope overlay toggle, opacity, and legend`.

---

## Task 7.6 — Docs and browser QA

**Files:**
- Modify: `ARCHITECTURE.md`, `SPEC.md`, `TASKS.md`

- [ ] **Step 7.6.1: `ARCHITECTURE.md`.**
  - Add a "Slope Overlay" subsection under Maptiler Integration covering the protocol, the `tiles.json` template, the decode formula, Horn's method with extrapolated edges, how missing tiles and errors are handled, and the quota note.
  - Add `SlopeLayer → source: 'slope-source' (raster, slope://) → layer: 'slope-raster'` to Map Layer Architecture.
  - Add slope toggle/opacity to the `ui` slice description.
  - Add `map/slope/` to the project structure.
- [ ] **Step 7.6.2: `SPEC.md`.** Move slope shading out of "out of scope" / "Future Considerations" into the map features list. Aspect shading stays future.
- [ ] **Step 7.6.3: Browser QA (Playwright, real key):**
  1. Slope off on first load, and no `slope://` requests in the network log.
  2. Toggle on near Fernie (Island Lake / Fernie Alpine Resort bowls). Bands appear under labels and under the routes, tracks, waypoints and photos layers.
  3. Rough check against known terrain: obvious cliff bands read 45°+, groomed runs mostly under 27°. Compare one area by eye with CalTopo's slope shading and note any systematic bias.
  4. No visible seams at tile edges at z11–15. If there are, note it and open the neighbour-fetch follow-up.
  5. It drapes correctly with 3D terrain on (pitch 60°), and exaggeration changes don't break it.
  6. Switch basemap (all three): the overlay persists and stays under labels.
  7. Below z10 the overlay is hidden and the hint shows. Above z14 it stretches without errors.
  8. Opacity slider works live. Reload: enabled state and opacity are restored.
  9. Perf: `debug` timing per tile below about 30 ms on desktop. No visible stutter while panning. Record the numbers here.
  10. Pan over the Pacific: no tile-error banner.
  11. Mobile width 375 px: the control fits and the legend is readable.
  12. No console errors.
- [ ] **Step 7.6.4: `TASKS.md`.** Tick 7.6. Remove "Slope angle shading overlay" from the Post-MVP Backlog. Commit `docs: slope overlay architecture and spec`. Open the PR.

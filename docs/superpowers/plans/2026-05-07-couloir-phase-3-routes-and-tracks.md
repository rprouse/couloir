# Couloir Phase 3 — Routes and Tracks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end GPX import for routes and tracks, both rendered on the map as styled lines, both clickable to open a detail panel that shows full metadata plus an elevation profile chart, and both editable and deletable from that panel. The Layer panel gains an Import GPX button, the map gains a drag-and-drop overlay, and the Routes/Tracks count badges show real counts.

**Architecture:** GPX parsing is a pure utility (no UI, no storage) returning normalized objects that match `Route`/`Track` field shapes. SHA-256 hashing of file bytes is a separate utility. The import orchestrator (`features/import/gpxImport.ts`) is a pure async function that walks a list of files and calls a `promptDuplicate` callback when it encounters a `source_hash` collision; the React layer (`features/import/DuplicatePrompt.tsx`) supplies the prompt by holding a queue in component state and resolving promises. Routes and tracks land on the map through `RoutesLayer` and `TracksLayer` components that subscribe to the relevant Zustand slice + `layerVisibility` and reconcile a single GeoJSON source on the existing `MapView`'s map instance via the `useMap()` accessor introduced here. Clicks on those layers dispatch `openEntity('route' | 'track', id)`. A new `<DetailPanel>` mounts overlay-style next to the map, switches on `panel.entityType`, and renders the matching detail/edit child.

**Tech Stack:** Browser `DOMParser` for GPX, `crypto.subtle.digest` for SHA-256, MapLibre native click handlers + GeoJSON sources for line rendering, `recharts` (new dep) for the elevation profile chart, Vitest + React Testing Library for tests. No new state libraries; reuse `zustand` slices.

**Spec references:** `SPEC.md` (Routes, Tracks sections), `ARCHITECTURE.md` (GPX Parsing and Import, Map Layer Architecture, State Management/panel state), `DATA-MODEL.md` (Route, Track types, MOVING_SPEED_THRESHOLD_M_S, GeoJSON LineString-with-Z), `TASKS.md` Tasks 3.1–3.7.

**Out of scope for this phase:** Waypoint placement (Phase 4), photo import (Phase 5), tag *management* and *filtering* UI (Phase 6.1/6.2 — tag pills render in detail panels here read-only via the existing `tags` slice), ZIP import/export UI (Phase 6.4 — `exportAll`/`importAll` shape already returned by the storage layer is unused in this phase), GPX `<wpt>` import (post-MVP backlog), GPX export, route/track sharing.

---

## File Structure

```
couloir/
├── package.json                                          Task 3.5 (add recharts)
├── src/
│   ├── App.tsx                                           Tasks 3.2, 3.5 (mount FileDropzone + DetailPanel)
│   ├── utils/
│   │   ├── gpx.ts                                        Task 3.1
│   │   ├── gpx.test.ts                                   Task 3.1
│   │   ├── hash.ts                                       Task 3.1
│   │   ├── hash.test.ts                                  Task 3.1
│   │   ├── geo.ts                                        Task 3.1 (haversine, distance/elev derivations, profile series)
│   │   ├── geo.test.ts                                   Task 3.1
│   │   ├── format.ts                                     Task 3.5 (km/m/duration formatters)
│   │   └── format.test.ts                                Task 3.5
│   ├── features/
│   │   └── import/
│   │       ├── gpxImport.ts                              Task 3.2 (orchestrator)
│   │       ├── gpxImport.test.ts                         Task 3.2
│   │       ├── ImportButton.tsx                          Task 3.2 (file picker, lives in LayerPanel)
│   │       ├── DuplicatePrompt.tsx                       Task 3.2 (modal + queue)
│   │       ├── DuplicatePrompt.module.css                Task 3.2
│   │       ├── DuplicatePrompt.test.tsx                  Task 3.2
│   │       ├── importToast.ts                            Task 3.2 (queue-driven summary toast)
│   │       └── importToast.test.tsx                      Task 3.2
│   ├── components/
│   │   ├── FileDropzone/
│   │   │   ├── FileDropzone.tsx                          Task 3.2
│   │   │   ├── FileDropzone.module.css                   Task 3.2
│   │   │   └── FileDropzone.test.tsx                     Task 3.2
│   │   └── ElevationProfile/
│   │       ├── ElevationProfile.tsx                      Task 3.5
│   │       ├── ElevationProfile.module.css               Task 3.5
│   │       └── ElevationProfile.test.tsx                 Task 3.5
│   ├── hooks/
│   │   └── useMap.ts                                     Task 3.3 (singleton accessor + setter for the live map)
│   ├── map/
│   │   ├── MapView.tsx                                   Task 3.3 (publish map via setMap; mount layers)
│   │   └── layers/
│   │       ├── RoutesLayer.tsx                           Task 3.3
│   │       ├── RoutesLayer.test.tsx                      Task 3.3 (tests for the GeoJSON-build helper)
│   │       ├── routesLayerData.ts                        Task 3.3 (pure GeoJSON builder)
│   │       ├── routesLayerData.test.ts                   Task 3.3
│   │       ├── TracksLayer.tsx                           Task 3.4
│   │       ├── tracksLayerData.ts                        Task 3.4
│   │       ├── tracksLayerData.test.ts                   Task 3.4
│   │       └── layerStyles.ts                            Tasks 3.3, 3.4 (shared constants — line widths, dash arrays)
│   └── panels/
│       ├── DetailPanel/
│       │   ├── DetailPanel.tsx                           Task 3.5 (router on panel state)
│       │   ├── DetailPanel.module.css                    Task 3.5
│       │   ├── DetailPanel.test.tsx                      Task 3.5
│       │   ├── RouteDetail.tsx                           Task 3.5 (view + edit + delete)
│       │   ├── RouteDetail.test.tsx                      Task 3.5
│       │   ├── TrackDetail.tsx                           Task 3.6
│       │   ├── TrackDetail.test.tsx                      Task 3.6
│       │   ├── TagPills.tsx                              Task 3.5 (read-only pills; full picker in Phase 6.1)
│       │   ├── ConfirmDelete.tsx                         Task 3.5 (small inline confirm)
│       │   └── DetailPanel.shared.module.css             Task 3.5 (form styling shared by Route/Track edit)
│       └── LayerPanel/
│           └── LayerPanel.tsx                            Tasks 3.2, 3.7 (Import button + live counts)
└── (no waypoint/photo layers, no tag-management UI, no PWA — those land in Phase 4–6)
```

**Test conventions** (carried forward from Phase 2):
- Vitest globals (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`) are enabled — no per-file imports.
- All Zustand store tests reset both the slice state *and* the storage provider in `beforeEach` using `InMemoryStorageProvider`. The OPFS backend is never touched by Vitest.
- jsdom does not render MapLibre — for layer code, only the pure GeoJSON-building helpers are unit tested. Visual map verification happens in the browser per the TASKS.md acceptance criteria.

---

## Task 3.1 — GPX parser

**Files:**
- Create: `src/utils/hash.ts`
- Create: `src/utils/hash.test.ts`
- Create: `src/utils/geo.ts`
- Create: `src/utils/geo.test.ts`
- Create: `src/utils/gpx.ts`
- Create: `src/utils/gpx.test.ts`

This task ends with: a `parseGpx(xml, filename)` function that returns a discriminated union `{ kind: 'route' | 'track', ... }` with all the metadata needed to call `useRoutesStore.add(input)` or `useTracksStore.add(input)`, plus a `sha256Hex(bytes)` helper. No UI, no map. `npm test` and `npm run typecheck` pass.

- [ ] **Step 3.1.1: Create `src/utils/hash.test.ts`**

```typescript
import { sha256Hex } from './hash'

describe('sha256Hex', () => {
  it('hashes an empty input to the well-known SHA-256 value', async () => {
    const hex = await sha256Hex(new Uint8Array())
    expect(hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('hashes "abc" to the FIPS 180-2 reference value', async () => {
    const bytes = new TextEncoder().encode('abc')
    const hex = await sha256Hex(bytes)
    expect(hex).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('returns the same hash for two equal-content Uint8Arrays', async () => {
    const a = await sha256Hex(new TextEncoder().encode('couloir'))
    const b = await sha256Hex(new TextEncoder().encode('couloir'))
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 3.1.2: Run hash tests; expect them to fail**

Run: `npm test -- src/utils/hash.test.ts`
Expected: FAIL — `Cannot find module './hash'`.

- [ ] **Step 3.1.3: Implement `src/utils/hash.ts`**

```typescript
// SHA-256 of a byte array, returned as a lowercase hex string.
// Uses the Web Crypto API (subtle.digest), which is available in modern
// browsers and in jsdom (via Node's crypto). No fallback path — if the
// platform doesn't expose subtle.digest, we'd rather fail loudly.
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer so SubtleCrypto's strict typing accepts
  // the input regardless of the source view (DataView, slice, etc.).
  // SharedArrayBuffer-backed views are intentionally rejected by digest().
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  )
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 3.1.4: Run hash tests; expect them to pass**

Run: `npm test -- src/utils/hash.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 3.1.5: Create `src/utils/geo.test.ts`** — these helpers are used by both the GPX parser (Task 3.1) and the elevation profile (Task 3.5)

```typescript
import {
  haversineMeters,
  lineDistanceMeters,
  elevationGainLoss,
  cumulativeDistanceMeters,
  type ProfilePoint,
} from './geo'
import type { LineStringZ } from '../types'

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(49.5, -116, 49.5, -116)).toBeCloseTo(0, 6)
  })

  it('returns ~111 km for one degree of latitude at the equator', () => {
    const m = haversineMeters(0, 0, 1, 0)
    expect(m).toBeGreaterThan(110_000)
    expect(m).toBeLessThan(112_000)
  })

  it('is symmetric', () => {
    const a = haversineMeters(49.5, -116, 49.6, -115.9)
    const b = haversineMeters(49.6, -115.9, 49.5, -116)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('lineDistanceMeters', () => {
  it('returns 0 for a single-point line', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [[-116, 49.5, 1500]] }
    expect(lineDistanceMeters(ls)).toBe(0)
  })

  it('sums consecutive haversine segments', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1510],
        [-116, 49.502, 1520],
      ],
    }
    const a = haversineMeters(49.5, -116, 49.501, -116)
    const b = haversineMeters(49.501, -116, 49.502, -116)
    expect(lineDistanceMeters(ls)).toBeCloseTo(a + b, 6)
  })
})

describe('elevationGainLoss', () => {
  it('returns 0/0 for a flat line', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1500],
      ],
    }
    expect(elevationGainLoss(ls)).toEqual({ gain: 0, loss: 0 })
  })

  it('sums positive deltas as gain and negative deltas as loss', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1000],
        [-116, 49.501, 1100], // +100 gain
        [-116, 49.502, 1050], // -50 loss
        [-116, 49.503, 1080], // +30 gain
      ],
    }
    expect(elevationGainLoss(ls)).toEqual({ gain: 130, loss: 50 })
  })

  it('returns 0/0 for a one-point line', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [[-116, 49.5, 1500]] }
    expect(elevationGainLoss(ls)).toEqual({ gain: 0, loss: 0 })
  })
})

describe('cumulativeDistanceMeters', () => {
  it('returns a [0, d1, d1+d2, ...] series matching coordinate count', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1510],
        [-116, 49.502, 1520],
      ],
    }
    const series = cumulativeDistanceMeters(ls)
    expect(series).toHaveLength(3)
    expect(series[0]).toBe(0)
    expect(series[1]).toBeGreaterThan(0)
    expect(series[2]).toBeGreaterThan(series[1])
  })

  it('produces a profile point per coordinate when zipped with elevation', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1510],
      ],
    }
    const distances = cumulativeDistanceMeters(ls)
    const profile: ProfilePoint[] = distances.map((d, i) => ({
      distance_m: d,
      elevation_m: ls.coordinates[i][2],
    }))
    expect(profile).toEqual([
      { distance_m: 0, elevation_m: 1500 },
      { distance_m: distances[1], elevation_m: 1510 },
    ])
  })
})
```

- [ ] **Step 3.1.6: Implement `src/utils/geo.ts`**

```typescript
import type { LineStringZ } from '../types'

const EARTH_RADIUS_M = 6_371_000

// Great-circle distance between two lat/lng pairs (degrees) in metres.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Total polyline length (metres) by summing inter-point haversine distances.
// 0 for a 0- or 1-point line.
export function lineDistanceMeters(line: LineStringZ): number {
  let total = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    const [lng1, lat1] = line.coordinates[i - 1]
    const [lng2, lat2] = line.coordinates[i]
    total += haversineMeters(lat1, lng1, lat2, lng2)
  }
  return total
}

// Cumulative distance series — distance from the first point to each point
// in turn. Same length as coordinates; first entry is always 0.
export function cumulativeDistanceMeters(line: LineStringZ): number[] {
  const out: number[] = new Array(line.coordinates.length)
  if (out.length === 0) return out
  out[0] = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    const [lng1, lat1] = line.coordinates[i - 1]
    const [lng2, lat2] = line.coordinates[i]
    out[i] = out[i - 1] + haversineMeters(lat1, lng1, lat2, lng2)
  }
  return out
}

// Sum positive elevation deltas as gain, negative deltas as loss (absolute).
export function elevationGainLoss(line: LineStringZ): { gain: number; loss: number } {
  let gain = 0
  let loss = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    const dz = line.coordinates[i][2] - line.coordinates[i - 1][2]
    if (dz > 0) gain += dz
    else if (dz < 0) loss += -dz
  }
  return { gain, loss }
}

export interface ProfilePoint {
  distance_m: number
  elevation_m: number
}
```

- [ ] **Step 3.1.7: Run geo tests; expect PASS**

Run: `npm test -- src/utils/geo.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 3.1.8: Create `src/utils/gpx.test.ts`**

Tests cover the cases in TASKS.md Task 3.1: real-world route, real-world track, missing elevation, multi-segment timing, no timestamps, idle gap detection.

```typescript
import { parseGpx } from './gpx'

const ROUTE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>Test Route</name>
    <desc>A test route</desc>
    <rtept lat="49.500" lon="-116.000"><ele>1500</ele></rtept>
    <rtept lat="49.501" lon="-116.000"><ele>1600</ele></rtept>
    <rtept lat="49.502" lon="-116.000"><ele>1550</ele></rtept>
  </rte>
</gpx>`

const TRACK_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Test Track</name>
    <desc>A recorded tour</desc>
    <trkseg>
      <trkpt lat="49.500" lon="-116.000">
        <ele>1500</ele>
        <time>2026-04-01T08:00:00Z</time>
      </trkpt>
      <trkpt lat="49.501" lon="-116.000">
        <ele>1510</ele>
        <time>2026-04-01T08:01:00Z</time>
      </trkpt>
      <trkpt lat="49.502" lon="-116.000">
        <ele>1520</ele>
        <time>2026-04-01T08:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpx — routes', () => {
  it('parses a single route', () => {
    const result = parseGpx(ROUTE_GPX, 'route.gpx')
    expect(result.kind).toBe('route')
    if (result.kind !== 'route') return
    expect(result.name).toBe('Test Route')
    expect(result.description).toBe('A test route')
    expect(result.geojson.coordinates).toHaveLength(3)
    // Coordinates are [lng, lat, ele]
    expect(result.geojson.coordinates[0]).toEqual([-116, 49.5, 1500])
    expect(result.distance_m).toBeGreaterThan(0)
    expect(result.elevation_gain_m).toBe(100) // 1500 → 1600
    expect(result.elevation_loss_m).toBe(50)  // 1600 → 1550
    expect(result.source_filename).toBe('route.gpx')
  })

  it('treats missing elevation as zero in coordinates and gain/loss', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><rte><name>n</name>
        <rtept lat="49.5" lon="-116.0"/>
        <rtept lat="49.501" lon="-116.0"/>
      </rte></gpx>`
    const result = parseGpx(xml, 'flat.gpx')
    expect(result.kind).toBe('route')
    if (result.kind !== 'route') return
    for (const c of result.geojson.coordinates) {
      expect(c[2]).toBe(0)
    }
    expect(result.elevation_gain_m).toBe(0)
    expect(result.elevation_loss_m).toBe(0)
  })

  it('falls back to filename-derived name when <name> is missing', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><rte>
        <rtept lat="49.5" lon="-116.0"><ele>1000</ele></rtept>
      </rte></gpx>`
    const result = parseGpx(xml, 'My Route.gpx')
    expect(result.kind).toBe('route')
    if (result.kind !== 'route') return
    expect(result.name).toBe('My Route')
  })
})

describe('parseGpx — tracks', () => {
  it('parses a single track with timestamps', () => {
    const result = parseGpx(TRACK_GPX, 'tour.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.name).toBe('Test Track')
    expect(result.recorded_at).toBe('2026-04-01T08:00:00.000Z')
    expect(result.duration_s).toBe(120) // 8:00 -> 8:02
    expect(result.moving_time_s).toBe(120)
    expect(result.geojson.coordinates).toHaveLength(3)
  })

  it('produces null time fields when no <time> elements are present', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><trk><name>N</name>
        <trkseg>
          <trkpt lat="49.5" lon="-116.0"><ele>1500</ele></trkpt>
          <trkpt lat="49.501" lon="-116.0"><ele>1510</ele></trkpt>
        </trkseg>
      </trk></gpx>`
    const result = parseGpx(xml, 'untimed.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.duration_s).toBeNull()
    expect(result.moving_time_s).toBeNull()
    expect(result.recorded_at).toBeNull()
  })

  it('concatenates multiple <trkseg> elements into one LineString', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><trk><name>multi</name>
        <trkseg>
          <trkpt lat="49.500" lon="-116.0"><ele>1500</ele><time>2026-04-01T08:00:00Z</time></trkpt>
          <trkpt lat="49.501" lon="-116.0"><ele>1510</ele><time>2026-04-01T08:01:00Z</time></trkpt>
        </trkseg>
        <trkseg>
          <trkpt lat="49.502" lon="-116.0"><ele>1520</ele><time>2026-04-01T08:32:00Z</time></trkpt>
          <trkpt lat="49.503" lon="-116.0"><ele>1530</ele><time>2026-04-01T08:33:00Z</time></trkpt>
        </trkseg>
      </trk></gpx>`
    const result = parseGpx(xml, 'multi.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.geojson.coordinates).toHaveLength(4)
    // Total elapsed: 8:00 → 8:33 = 1980s
    expect(result.duration_s).toBe(1980)
    // Moving time excludes the 31-minute mid-segment gap. Three moving
    // intervals (≈60s each) at modest speed remain.
    expect(result.moving_time_s).toBeLessThan(result.duration_s ?? 0)
    expect(result.moving_time_s).toBeGreaterThan(0)
  })

  it('idle 30-minute mid-tour gap reduces moving_time materially', () => {
    // 30s of skinning, then a 30-minute pause at the same point, then 30s more.
    const xml = `<?xml version="1.0"?>
      <gpx><trk><name>rest</name>
        <trkseg>
          <trkpt lat="49.500" lon="-116.0"><ele>1500</ele><time>2026-04-01T08:00:00Z</time></trkpt>
          <trkpt lat="49.5005" lon="-116.0"><ele>1510</ele><time>2026-04-01T08:00:30Z</time></trkpt>
          <trkpt lat="49.5005" lon="-116.0"><ele>1510</ele><time>2026-04-01T08:30:30Z</time></trkpt>
          <trkpt lat="49.5010" lon="-116.0"><ele>1520</ele><time>2026-04-01T08:31:00Z</time></trkpt>
        </trkseg>
      </trk></gpx>`
    const result = parseGpx(xml, 'rest.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.duration_s).toBe(31 * 60) // 1860s
    // Two 30-second moving intervals; the middle 1800s is below threshold.
    expect(result.moving_time_s).toBe(60)
  })

  it('throws a descriptive error for malformed XML', () => {
    expect(() => parseGpx('<not really gpx>', 'bad.gpx')).toThrow(/parse/i)
  })

  it('throws a descriptive error when neither <rte> nor <trk> is present', () => {
    const xml = `<?xml version="1.0"?><gpx></gpx>`
    expect(() => parseGpx(xml, 'empty.gpx')).toThrow(/no route or track/i)
  })
})
```

- [ ] **Step 3.1.9: Run gpx tests; expect FAIL** (module missing)

Run: `npm test -- src/utils/gpx.test.ts`
Expected: FAIL — `Cannot find module './gpx'`.

- [ ] **Step 3.1.10: Implement `src/utils/gpx.ts`**

```typescript
import type { LineStringZ } from '../types'
import { MOVING_SPEED_THRESHOLD_M_S } from '../types'
import {
  haversineMeters,
  lineDistanceMeters,
  elevationGainLoss,
} from './geo'

export interface ParsedRoute {
  kind: 'route'
  name: string
  description: string
  geojson: LineStringZ
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  source_filename: string
}

export interface ParsedTrack {
  kind: 'track'
  name: string
  description: string
  geojson: LineStringZ
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  duration_s: number | null
  moving_time_s: number | null
  recorded_at: string | null
  source_filename: string
}

export type ParsedGpx = ParsedRoute | ParsedTrack

// Parse a GPX XML document into a normalized object suitable for storage.
// The raw GPX is not retained.
export function parseGpx(xml: string, sourceFilename: string): ParsedGpx {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  // DOMParser reports parse errors as a <parsererror> element rather than
  // throwing. Detect that and surface a clear error.
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`GPX parse error: ${parseError.textContent ?? 'unknown'}`)
  }

  // Prefer the first <rte> if present; otherwise take the first <trk>.
  // GPX files containing both are rare; the route side wins by convention.
  const route = doc.querySelector('rte')
  if (route) return parseRouteElement(route, sourceFilename)

  const track = doc.querySelector('trk')
  if (track) return parseTrackElement(track, sourceFilename)

  throw new Error('GPX contains no route or track')
}

function parseRouteElement(rte: Element, sourceFilename: string): ParsedRoute {
  const points = Array.from(rte.querySelectorAll('rtept'))
  const coordinates: LineStringZ['coordinates'] = points.map((pt) => [
    Number(pt.getAttribute('lon')),
    Number(pt.getAttribute('lat')),
    elevationOf(pt),
  ])
  const geojson: LineStringZ = { type: 'LineString', coordinates }
  const { gain, loss } = elevationGainLoss(geojson)
  return {
    kind: 'route',
    name: textOf(rte, 'name') ?? deriveNameFromFilename(sourceFilename),
    description: textOf(rte, 'desc') ?? '',
    geojson,
    distance_m: lineDistanceMeters(geojson),
    elevation_gain_m: gain,
    elevation_loss_m: loss,
    source_filename: sourceFilename,
  }
}

function parseTrackElement(trk: Element, sourceFilename: string): ParsedTrack {
  // Concatenate trackpoints from all <trkseg> elements. We do not preserve
  // segment boundaries in the geometry — DATA-MODEL.md says trackpoints are
  // joined into a single LineString.
  const segments = Array.from(trk.querySelectorAll('trkseg'))
  const allPoints: Element[] = []
  for (const seg of segments) {
    allPoints.push(...Array.from(seg.querySelectorAll('trkpt')))
  }

  const coordinates: LineStringZ['coordinates'] = allPoints.map((pt) => [
    Number(pt.getAttribute('lon')),
    Number(pt.getAttribute('lat')),
    elevationOf(pt),
  ])
  const geojson: LineStringZ = { type: 'LineString', coordinates }

  const timestamps = allPoints.map(timestampOf)
  const haveAnyTimestamp = timestamps.some((t) => t !== null)
  const haveAllTimestamps = timestamps.every((t) => t !== null)

  let duration_s: number | null = null
  let moving_time_s: number | null = null
  let recorded_at: string | null = null

  if (haveAnyTimestamp && haveAllTimestamps && timestamps.length >= 2) {
    const first = timestamps[0] as Date
    const last = timestamps[timestamps.length - 1] as Date
    duration_s = Math.round((last.getTime() - first.getTime()) / 1000)
    recorded_at = first.toISOString()

    let moving = 0
    for (let i = 1; i < allPoints.length; i++) {
      const t1 = timestamps[i - 1] as Date
      const t2 = timestamps[i] as Date
      const dt = (t2.getTime() - t1.getTime()) / 1000
      if (dt <= 0) continue
      const [lng1, lat1] = coordinates[i - 1]
      const [lng2, lat2] = coordinates[i]
      const dist = haversineMeters(lat1, lng1, lat2, lng2)
      const speed = dist / dt
      if (speed >= MOVING_SPEED_THRESHOLD_M_S) moving += dt
    }
    moving_time_s = Math.round(moving)
  } else if (haveAnyTimestamp && timestamps[0] !== null) {
    // Mixed: some points have <time>, others don't. Record the first
    // timestamp but treat duration/moving as unknown rather than guess.
    recorded_at = (timestamps[0] as Date).toISOString()
  }

  const { gain, loss } = elevationGainLoss(geojson)
  return {
    kind: 'track',
    name: textOf(trk, 'name') ?? deriveNameFromFilename(sourceFilename),
    description: textOf(trk, 'desc') ?? '',
    geojson,
    distance_m: lineDistanceMeters(geojson),
    elevation_gain_m: gain,
    elevation_loss_m: loss,
    duration_s,
    moving_time_s,
    recorded_at,
    source_filename: sourceFilename,
  }
}

// `<name>` and `<desc>` are *direct* children of <rte>/<trk>. We don't use
// querySelector('name') because it would also match nested tag names inside
// extension elements; iterate direct children instead.
function textOf(parent: Element, tag: string): string | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) {
      const txt = child.textContent?.trim() ?? ''
      return txt.length > 0 ? txt : null
    }
  }
  return null
}

function elevationOf(point: Element): number {
  const ele = textOf(point, 'ele')
  if (ele === null) return 0
  const n = Number(ele)
  return Number.isFinite(n) ? n : 0
}

function timestampOf(point: Element): Date | null {
  const t = textOf(point, 'time')
  if (t === null) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

function deriveNameFromFilename(filename: string): string {
  // Strip extension and any leading path; treat as the user's name fallback.
  const base = filename.replace(/^.*[\\/]/, '')
  return base.replace(/\.gpx$/i, '') || 'Untitled'
}
```

- [ ] **Step 3.1.11: Run gpx tests; expect PASS**

Run: `npm test -- src/utils/gpx.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 3.1.12: Run typecheck and full test suite**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: all suites green.

- [ ] **Step 3.1.13: Commit**

```bash
git add src/utils/hash.ts src/utils/hash.test.ts \
        src/utils/geo.ts src/utils/geo.test.ts \
        src/utils/gpx.ts src/utils/gpx.test.ts
git commit -m "feat(gpx): add hash, geo, and GPX parser utilities for Phase 3 import"
```

(All `git` commands run via the PowerShell tool per `CLAUDE.md`.)

---

## Task 3.2 — GPX import UI

**Files:**
- Create: `src/features/import/gpxImport.ts`
- Create: `src/features/import/gpxImport.test.ts`
- Create: `src/features/import/ImportButton.tsx`
- Create: `src/features/import/DuplicatePrompt.tsx`
- Create: `src/features/import/DuplicatePrompt.module.css`
- Create: `src/features/import/DuplicatePrompt.test.tsx`
- Create: `src/features/import/importToast.ts`
- Create: `src/features/import/importToast.test.tsx`
- Create: `src/components/FileDropzone/FileDropzone.tsx`
- Create: `src/components/FileDropzone/FileDropzone.module.css`
- Create: `src/components/FileDropzone/FileDropzone.test.tsx`
- Modify: `src/panels/LayerPanel/LayerPanel.tsx` (add Import GPX button row)
- Modify: `src/App.tsx` (mount `<FileDropzone>` over the map area)

This task ends with: clicking the Import GPX button in the Layer panel opens a file picker; dropping `.gpx` files anywhere in the map area imports them; duplicates trigger a 3-button prompt with an "apply to all" checkbox; a brief summary toast shows after the drop completes. `npm test`/`npm run typecheck` pass.

- [ ] **Step 3.2.1: Create `src/features/import/gpxImport.test.ts`**

```typescript
import { importGpxFiles, type ImportDeps, type DuplicateChoice } from './gpxImport'
import type { ParsedGpx } from '../../utils/gpx'

// Build a fake GPX file. The real parser isn't exercised here; we stub out
// `parseGpx` via deps so the test focuses on orchestration.
function fakeFile(name: string, content = name): File {
  return new File([content], name, { type: 'application/gpx+xml' })
}

const baseDeps: () => ImportDeps = () => ({
  parseGpx: (xml, filename) => {
    if (xml === 'BAD') throw new Error('parse error')
    return {
      kind: filename.includes('track') ? 'track' : 'route',
      name: filename,
      description: '',
      geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
      distance_m: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      source_filename: filename,
      ...(filename.includes('track')
        ? { duration_s: null, moving_time_s: null, recorded_at: null }
        : {}),
    } as ParsedGpx
  },
  hashBytes: async (bytes) => `hash-${new TextDecoder().decode(bytes)}`,
  lookupRouteByHash: async () => null,
  lookupTrackByHash: async () => null,
  saveRoute: vi.fn().mockResolvedValue({ id: 'r1' }),
  saveTrack: vi.fn().mockResolvedValue({ id: 't1' }),
  replaceRoute: vi.fn().mockResolvedValue(undefined),
  replaceTrack: vi.fn().mockResolvedValue(undefined),
  promptDuplicate: async () => ({ choice: 'skip', applyToAll: false }),
})

describe('importGpxFiles', () => {
  it('imports a single non-duplicate route', async () => {
    const deps = baseDeps()
    const summary = await importGpxFiles([fakeFile('a.gpx')], deps)
    expect(summary.routesImported).toBe(1)
    expect(summary.tracksImported).toBe(0)
    expect(summary.duplicatesSkipped).toBe(0)
    expect(summary.errors).toEqual([])
    expect(deps.saveRoute).toHaveBeenCalledOnce()
  })

  it('routes track files to saveTrack', async () => {
    const deps = baseDeps()
    await importGpxFiles([fakeFile('my-track.gpx')], deps)
    expect(deps.saveTrack).toHaveBeenCalledOnce()
    expect(deps.saveRoute).not.toHaveBeenCalled()
  })

  it('skips a duplicate when the user chooses skip', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => ({ id: 'existing' } as any)
    deps.promptDuplicate = async () => ({ choice: 'skip', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('dup.gpx')], deps)
    expect(summary.duplicatesSkipped).toBe(1)
    expect(summary.routesImported).toBe(0)
    expect(deps.saveRoute).not.toHaveBeenCalled()
  })

  it('replaces a duplicate when the user chooses replace', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => ({ id: 'existing-id' } as any)
    deps.promptDuplicate = async () => ({ choice: 'replace', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('dup.gpx')], deps)
    expect(summary.routesReplaced).toBe(1)
    expect(deps.replaceRoute).toHaveBeenCalledWith('existing-id', expect.any(Object))
  })

  it('imports a duplicate as a new copy when chosen', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => ({ id: 'existing-id' } as any)
    deps.promptDuplicate = async () => ({ choice: 'new-copy', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('dup.gpx')], deps)
    expect(summary.routesImported).toBe(1)
    expect(summary.duplicatesSkipped).toBe(0)
    expect(deps.saveRoute).toHaveBeenCalledOnce()
  })

  it('honors applyToAll across remaining files in the drop', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => ({ id: 'existing' } as any)
    let prompts = 0
    deps.promptDuplicate = async () => {
      prompts++
      return { choice: 'skip', applyToAll: true }
    }
    const summary = await importGpxFiles(
      [fakeFile('a.gpx'), fakeFile('b.gpx'), fakeFile('c.gpx')],
      deps,
    )
    expect(prompts).toBe(1)
    expect(summary.duplicatesSkipped).toBe(3)
  })

  it('continues after a parse error and reports it', async () => {
    const deps = baseDeps()
    const summary = await importGpxFiles(
      [
        new File(['BAD'], 'broken.gpx'),
        fakeFile('good.gpx'),
      ],
      deps,
    )
    expect(summary.routesImported).toBe(1)
    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0].filename).toBe('broken.gpx')
  })
})

// `DuplicateChoice` is a literal union, so the array annotation below would
// fail typecheck if a string was misspelled — no runtime expect needed.
const _validChoices: DuplicateChoice[] = ['replace', 'skip', 'new-copy']
void _validChoices
```

- [ ] **Step 3.2.2: Run import tests; expect FAIL** (module missing)

Run: `npm test -- src/features/import/gpxImport.test.ts`
Expected: FAIL — `Cannot find module './gpxImport'`.

- [ ] **Step 3.2.3: Implement `src/features/import/gpxImport.ts`**

```typescript
import type { Route, Track } from '../../types'
import type { ParsedGpx } from '../../utils/gpx'

export type DuplicateChoice = 'replace' | 'skip' | 'new-copy'

export interface DuplicatePromptArgs {
  filename: string
  existing: Route | Track
  parsed: ParsedGpx
  remainingFiles: number  // how many files come after this one in the drop
}

export interface DuplicateDecision {
  choice: DuplicateChoice
  applyToAll: boolean
}

export interface ImportDeps {
  parseGpx: (xml: string, filename: string) => ParsedGpx
  hashBytes: (bytes: Uint8Array) => Promise<string>
  lookupRouteByHash: (hash: string) => Promise<Route | null>
  lookupTrackByHash: (hash: string) => Promise<Track | null>
  // saveRoute/saveTrack take a "new" payload (no id/created_at/updated_at).
  // We let the store fill those in; the orchestrator stays storage-agnostic.
  saveRoute: (input: NewRouteInput) => Promise<Route>
  saveTrack: (input: NewTrackInput) => Promise<Track>
  replaceRoute: (id: string, patch: RoutePatch) => Promise<unknown>
  replaceTrack: (id: string, patch: TrackPatch) => Promise<unknown>
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export type NewRouteInput = Omit<Route, 'id' | 'created_at' | 'updated_at'>
export type NewTrackInput = Omit<Track, 'id' | 'created_at' | 'updated_at'>
export type RoutePatch = Partial<Omit<Route, 'id' | 'created_at'>>
export type TrackPatch = Partial<Omit<Track, 'id' | 'created_at'>>

export interface ImportSummary {
  routesImported: number
  tracksImported: number
  routesReplaced: number
  tracksReplaced: number
  duplicatesSkipped: number
  errors: Array<{ filename: string; error: string }>
}

export async function importGpxFiles(
  files: File[],
  deps: ImportDeps,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    routesImported: 0,
    tracksImported: 0,
    routesReplaced: 0,
    tracksReplaced: 0,
    duplicatesSkipped: 0,
    errors: [],
  }

  // "Apply to all" memory: once set by the user, all remaining duplicates
  // in this same drop reuse the same choice without re-prompting.
  let stickyChoice: DuplicateChoice | null = null

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const xml = await file.text()
      const bytes = new Uint8Array(await file.arrayBuffer())
      const parsed = deps.parseGpx(xml, file.name)
      const hash = await deps.hashBytes(bytes)

      if (parsed.kind === 'route') {
        const existing = await deps.lookupRouteByHash(hash)
        if (existing) {
          const choice =
            stickyChoice ?? (await consumePrompt('route', existing, parsed))
          await applyRouteChoice(choice, existing, parsed, hash)
        } else {
          await deps.saveRoute(toRouteInput(parsed, hash))
          summary.routesImported++
        }
      } else {
        const existing = await deps.lookupTrackByHash(hash)
        if (existing) {
          const choice =
            stickyChoice ?? (await consumePrompt('track', existing, parsed))
          await applyTrackChoice(choice, existing, parsed, hash)
        } else {
          await deps.saveTrack(toTrackInput(parsed, hash))
          summary.tracksImported++
        }
      }
    } catch (err) {
      summary.errors.push({
        filename: file.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary

  async function consumePrompt(
    kind: 'route' | 'track',
    existing: Route | Track,
    parsed: ParsedGpx,
  ): Promise<DuplicateChoice> {
    const decision = await deps.promptDuplicate({
      filename: parsed.source_filename,
      existing,
      parsed,
      remainingFiles: files.length - 1 - files.indexOf(parsed.source_filename as never),
    })
    if (decision.applyToAll) stickyChoice = decision.choice
    void kind  // discriminator handled by caller
    return decision.choice
  }

  async function applyRouteChoice(
    choice: DuplicateChoice,
    existing: Route,
    parsed: ParsedGpx,
    hash: string,
  ): Promise<void> {
    if (parsed.kind !== 'route') return
    if (choice === 'skip') {
      summary.duplicatesSkipped++
      return
    }
    if (choice === 'replace') {
      await deps.replaceRoute(existing.id, parsedToRoutePatch(parsed, hash))
      summary.routesReplaced++
      return
    }
    // 'new-copy'
    await deps.saveRoute(toRouteInput(parsed, hash))
    summary.routesImported++
  }

  async function applyTrackChoice(
    choice: DuplicateChoice,
    existing: Track,
    parsed: ParsedGpx,
    hash: string,
  ): Promise<void> {
    if (parsed.kind !== 'track') return
    if (choice === 'skip') {
      summary.duplicatesSkipped++
      return
    }
    if (choice === 'replace') {
      await deps.replaceTrack(existing.id, parsedToTrackPatch(parsed, hash))
      summary.tracksReplaced++
      return
    }
    await deps.saveTrack(toTrackInput(parsed, hash))
    summary.tracksImported++
  }
}

import { DEFAULTS } from '../../types'

function toRouteInput(parsed: ParsedGpx, hash: string): NewRouteInput {
  if (parsed.kind !== 'route') throw new Error('toRouteInput called with non-route')
  return {
    user_id: 'local',
    name: parsed.name,
    description: parsed.description,
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    color: DEFAULTS.route.color,
    ates: null,
    technical_difficulty: null,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
    tags: [],
  }
}

function toTrackInput(parsed: ParsedGpx, hash: string): NewTrackInput {
  if (parsed.kind !== 'track') throw new Error('toTrackInput called with non-track')
  return {
    user_id: 'local',
    name: parsed.name,
    description: parsed.description,
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    color: DEFAULTS.track.color,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
    duration_s: parsed.duration_s,
    moving_time_s: parsed.moving_time_s,
    recorded_at: parsed.recorded_at,
    tags: [],
  }
}

function parsedToRoutePatch(parsed: ParsedGpx, hash: string): RoutePatch {
  if (parsed.kind !== 'route') return {}
  // Replace overwrites geometry/derived fields and source metadata.
  // Name, description, color, ATES, technical difficulty, and tags are
  // preserved on the existing row — the user's edits should survive a
  // re-import of the same file.
  return {
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
  }
}

function parsedToTrackPatch(parsed: ParsedGpx, hash: string): TrackPatch {
  if (parsed.kind !== 'track') return {}
  return {
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
    duration_s: parsed.duration_s,
    moving_time_s: parsed.moving_time_s,
    recorded_at: parsed.recorded_at,
  }
}
```

- [ ] **Step 3.2.4: Fix the `remainingFiles` computation**

The first draft wrongly used `files.indexOf(parsed.source_filename as never)`. Replace the `consumePrompt` helper with one that closes over the loop index `i`:

In `gpxImport.ts`, replace the inner `consumePrompt` definition with a parameterized one:

```typescript
  async function consumePrompt(
    existing: Route | Track,
    parsed: ParsedGpx,
    index: number,
  ): Promise<DuplicateChoice> {
    const decision = await deps.promptDuplicate({
      filename: parsed.source_filename,
      existing,
      parsed,
      remainingFiles: files.length - 1 - index,
    })
    if (decision.applyToAll) stickyChoice = decision.choice
    return decision.choice
  }
```

And update the two call sites in the loop to pass `i`:

```typescript
const choice = stickyChoice ?? (await consumePrompt(existing, parsed, i))
```

(Both the route and track branches.)

- [ ] **Step 3.2.5: Run import tests; expect PASS**

Run: `npm test -- src/features/import/gpxImport.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 3.2.6: Create `src/components/FileDropzone/FileDropzone.tsx`**

A document-level drag listener shows the overlay; dropping files anywhere in the page calls `onFiles` with the dropped files filtered to `.gpx`. Filtering and parsing happen later — the component's job is to surface visual affordance + filtered file list.

```tsx
import { useEffect, useState } from 'react'
import styles from './FileDropzone.module.css'

interface Props {
  onFiles: (files: File[]) => void
  // Predicate so the dropzone can filter by extension without hard-coding
  // .gpx — Phase 5 reuses this component for image drops.
  accept?: (file: File) => boolean
  label?: string
}

const defaultAccept = (file: File): boolean =>
  file.name.toLowerCase().endsWith('.gpx')

export function FileDropzone({
  onFiles,
  accept = defaultAccept,
  label = 'Drop GPX files to import',
}: Props): JSX.Element {
  const [active, setActive] = useState(false)
  // Counter rather than boolean to handle dragenter/leave bouncing across
  // child elements: every dragenter increments, every dragleave decrements,
  // overlay stays visible while the count > 0.
  const [, setDepth] = useState(0)

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth((d) => {
        const next = d + 1
        if (next === 1) setActive(true)
        return next
      })
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      // Required to allow `drop` to fire.
      e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth((d) => {
        const next = Math.max(0, d - 1)
        if (next === 0) setActive(false)
        return next
      })
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDepth(0)
      setActive(false)
      const all = Array.from(e.dataTransfer?.files ?? [])
      const accepted = all.filter(accept)
      if (accepted.length > 0) onFiles(accepted)
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [onFiles, accept])

  if (!active) return <></>
  return (
    <div role="status" aria-live="polite" className={styles.overlay}>
      <div className={styles.label}>{label}</div>
    </div>
  )
}

function hasFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types
  if (!types) return false
  for (let i = 0; i < types.length; i++) if (types[i] === 'Files') return true
  return false
}
```

- [ ] **Step 3.2.7: Create `src/components/FileDropzone/FileDropzone.module.css`**

```css
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(14, 16, 20, 0.7);
  border: 2px dashed var(--color-accent);
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  z-index: 50;
  pointer-events: none;
}

.label {
  font-size: 16px;
  color: var(--color-text);
  background: var(--color-bg-2);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
```

- [ ] **Step 3.2.8: Create `src/components/FileDropzone/FileDropzone.test.tsx`**

```tsx
import { render, screen, act } from '@testing-library/react'
import { FileDropzone } from './FileDropzone'

function dragEvent(type: string, files: File[] = []): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      types: files.length > 0 ? ['Files'] : [],
    },
  })
  return event
}

describe('FileDropzone', () => {
  it('shows overlay on dragenter and hides on drop', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      document.dispatchEvent(dragEvent('dragenter', [new File([''], 'a.gpx')]))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      document.dispatchEvent(dragEvent('drop', [new File([''], 'a.gpx')]))
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(onFiles).toHaveBeenCalledWith([expect.any(File)])
  })

  it('filters out non-gpx files by default', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    act(() => {
      document.dispatchEvent(
        dragEvent('drop', [new File([''], 'photo.jpg'), new File([''], 'a.gpx')]),
      )
    })
    expect(onFiles).toHaveBeenCalledOnce()
    const arg = onFiles.mock.calls[0][0] as File[]
    expect(arg).toHaveLength(1)
    expect(arg[0].name).toBe('a.gpx')
  })

  it('does not call onFiles when no accepted files are dropped', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    act(() => {
      document.dispatchEvent(dragEvent('drop', [new File([''], 'photo.jpg')]))
    })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('ignores drag events with no Files type (e.g. text drags)', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} />)
    act(() => {
      document.dispatchEvent(dragEvent('dragenter', []))
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(onFiles).not.toHaveBeenCalled()
  })
})
```

Run: `npm test -- src/components/FileDropzone/FileDropzone.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 3.2.9: Create `src/features/import/DuplicatePrompt.module.css`**

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 100;
}

.dialog {
  background: var(--color-bg-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  min-width: 360px;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  color: var(--color-text);
}

.title {
  margin: 0;
  font-size: 14px;
}

.subtle {
  color: var(--color-text-dim);
  font-size: 12px;
}

.actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

.actions button {
  background: var(--color-bg-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font: inherit;
}

.actions button:hover {
  background: var(--color-bg-0);
}

.applyAll {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
```

- [ ] **Step 3.2.10: Create `src/features/import/DuplicatePrompt.tsx`**

The component manages a queue of pending prompts. The orchestrator (Task 3.2.3) calls `enqueue(args)`, which returns a Promise that resolves once the user clicks one of the buttons. The component renders the modal whenever the queue is non-empty.

```tsx
import { useCallback, useState } from 'react'
import styles from './DuplicatePrompt.module.css'
import type { DuplicateDecision, DuplicatePromptArgs } from './gpxImport'

interface QueueItem {
  args: DuplicatePromptArgs
  resolve: (decision: DuplicateDecision) => void
}

export interface DuplicatePromptHandle {
  enqueue: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

interface Props {
  onReady: (handle: DuplicatePromptHandle) => void
}

// React component that exposes its `enqueue` API via the `onReady` callback,
// so the import orchestrator (a plain async function) can await user input.
// Modeled as a queue rather than a single slot to be safe against concurrent
// drops, even though the orchestrator is sequential.
export function DuplicatePrompt({ onReady }: Props): JSX.Element | null {
  const [queue, setQueue] = useState<QueueItem[]>([])

  // Stable handle — reset when `onReady` identity changes (it shouldn't).
  // `useCallback` ensures the orchestrator gets a referentially stable fn.
  const enqueue = useCallback((args: DuplicatePromptArgs) => {
    return new Promise<DuplicateDecision>((resolve) => {
      setQueue((q) => [...q, { args, resolve }])
    })
  }, [])

  // One-shot ready broadcast: parent stores the handle on first render.
  // Effect dependency on `enqueue` keeps it stable; the parent should not
  // remount this component.
  if (typeof window !== 'undefined') {
    // Schedule the ready notification via microtask so it lands after
    // commit. Doing this in render is safe because `onReady` is expected
    // to set state in the parent — we accept the one-tick delay.
    queueMicrotask(() => onReady({ enqueue }))
  }

  if (queue.length === 0) return null
  const head = queue[0]
  const { existing, parsed, remainingFiles } = head.args

  const decide = (decision: DuplicateDecision) => {
    head.resolve(decision)
    setQueue((q) => q.slice(1))
  }

  // Read the user's "apply to all" checkbox from form state on the dialog.
  // Local component state keeps it scoped to one prompt at a time.
  return (
    <DialogShell
      filename={head.args.filename}
      existingName={existing.name}
      parsedName={parsed.name}
      remainingFiles={remainingFiles}
      onDecide={decide}
    />
  )
}

function DialogShell({
  filename,
  existingName,
  parsedName,
  remainingFiles,
  onDecide,
}: {
  filename: string
  existingName: string
  parsedName: string
  remainingFiles: number
  onDecide: (d: DuplicateDecision) => void
}) {
  const [applyToAll, setApplyToAll] = useState(false)
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.dialog}>
        <h2 className={styles.title}>Already imported: {filename}</h2>
        <p className={styles.subtle}>
          A previous import has the same file contents. Existing entry: <strong>{existingName}</strong>.
          Incoming: <strong>{parsedName}</strong>.
        </p>
        {remainingFiles > 0 && (
          <label className={styles.applyAll}>
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            <span>Apply to all remaining ({remainingFiles}) files in this drop</span>
          </label>
        )}
        <div className={styles.actions}>
          <button type="button" onClick={() => onDecide({ choice: 'skip', applyToAll })}>
            Skip
          </button>
          <button type="button" onClick={() => onDecide({ choice: 'new-copy', applyToAll })}>
            Import as new copy
          </button>
          <button type="button" onClick={() => onDecide({ choice: 'replace', applyToAll })}>
            Replace
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2.11: Refactor `DuplicatePrompt` to publish its handle via `useEffect`**

The microtask-in-render approach in Step 3.2.10 is fragile. Replace with a proper effect.

In `DuplicatePrompt.tsx`, replace the body above the `if (queue.length === 0)` line with:

```tsx
import { useCallback, useEffect, useState, useMemo } from 'react'
// ...
export function DuplicatePrompt({ onReady }: Props): JSX.Element | null {
  const [queue, setQueue] = useState<QueueItem[]>([])

  const enqueue = useCallback((args: DuplicatePromptArgs) => {
    return new Promise<DuplicateDecision>((resolve) => {
      setQueue((q) => [...q, { args, resolve }])
    })
  }, [])

  const handle = useMemo<DuplicatePromptHandle>(() => ({ enqueue }), [enqueue])

  useEffect(() => {
    onReady(handle)
  }, [onReady, handle])

  if (queue.length === 0) return null
  const head = queue[0]
  // ...rest unchanged
```

Drop the import of `queueMicrotask` (it's a global anyway) and remove the inline ready broadcast.

- [ ] **Step 3.2.12: Create `src/features/import/DuplicatePrompt.test.tsx`**

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DuplicatePrompt, type DuplicatePromptHandle } from './DuplicatePrompt'
import type { DuplicateDecision, DuplicatePromptArgs } from './gpxImport'
import type { Route } from '../../types'

const fakeRoute: Route = {
  id: 'r1',
  user_id: 'local',
  name: 'Existing Route',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
  source_hash: 'h',
  source_filename: 'a.gpx',
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const args = (overrides: Partial<DuplicatePromptArgs> = {}): DuplicatePromptArgs => ({
  filename: 'a.gpx',
  existing: fakeRoute,
  parsed: {
    kind: 'route',
    name: 'New Route',
    description: '',
    geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
    distance_m: 0,
    elevation_gain_m: 0,
    elevation_loss_m: 0,
    source_filename: 'a.gpx',
  },
  remainingFiles: 0,
  ...overrides,
})

describe('DuplicatePrompt', () => {
  it('exposes enqueue via onReady, then shows the modal when called', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    // onReady fires after first effect commit; microtask flush is enough.
    await Promise.resolve()
    expect(handle).not.toBeNull()

    let resolved: DuplicateDecision | null = null
    act(() => {
      handle!.enqueue(args()).then((d) => { resolved = d })
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Existing Route/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Skip$/ }))
    await Promise.resolve()
    expect(resolved).toEqual({ choice: 'skip', applyToAll: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hides the apply-to-all checkbox when remainingFiles is 0', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    await Promise.resolve()
    act(() => { void handle!.enqueue(args({ remainingFiles: 0 })) })
    expect(screen.queryByLabelText(/apply to all/i)).toBeNull()
  })

  it('reports applyToAll: true when the checkbox is ticked', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    await Promise.resolve()

    let resolved: DuplicateDecision | null = null
    act(() => {
      handle!.enqueue(args({ remainingFiles: 5 })).then((d) => { resolved = d })
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Replace/ }))
    await Promise.resolve()
    expect(resolved).toEqual({ choice: 'replace', applyToAll: true })
  })

  it('queues multiple prompts and resolves them in order', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    await Promise.resolve()

    const decisions: DuplicateDecision[] = []
    act(() => {
      handle!.enqueue(args({ filename: 'first.gpx' })).then((d) => decisions.push(d))
      handle!.enqueue(args({ filename: 'second.gpx' })).then((d) => decisions.push(d))
    })
    expect(screen.getByText(/first.gpx/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Skip$/ }))
    await Promise.resolve()
    expect(screen.getByText(/second.gpx/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Skip$/ }))
    await Promise.resolve()
    expect(decisions).toHaveLength(2)
  })
})
```

Run: `npm test -- src/features/import/DuplicatePrompt.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 3.2.13: Create `src/features/import/importToast.ts`**

A tiny imperative API for showing a transient summary toast. The toast component renders via React; the API is a singleton-driven event.

```typescript
import type { ImportSummary } from './gpxImport'

type ToastListener = (message: string | null) => void

let listener: ToastListener | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function subscribeToast(fn: ToastListener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}

export function showImportSummaryToast(
  summary: ImportSummary,
  durationMs = 4000,
): void {
  if (!listener) return
  const parts: string[] = []
  if (summary.routesImported > 0)
    parts.push(`Imported ${summary.routesImported} route${summary.routesImported === 1 ? '' : 's'}`)
  if (summary.tracksImported > 0)
    parts.push(`${summary.tracksImported} track${summary.tracksImported === 1 ? '' : 's'}`)
  if (summary.routesReplaced + summary.tracksReplaced > 0)
    parts.push(`${summary.routesReplaced + summary.tracksReplaced} replaced`)
  if (summary.duplicatesSkipped > 0)
    parts.push(`${summary.duplicatesSkipped} duplicate skipped`)
  if (summary.errors.length > 0)
    parts.push(`${summary.errors.length} error${summary.errors.length === 1 ? '' : 's'}`)

  const message = parts.length > 0 ? parts.join(', ') + '.' : 'Nothing to import.'
  listener(message)

  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    if (listener) listener(null)
    timer = null
  }, durationMs)
}
```

- [ ] **Step 3.2.14: Create `src/features/import/importToast.test.tsx`**

```tsx
import { showImportSummaryToast, subscribeToast } from './importToast'
import type { ImportSummary } from './gpxImport'

const empty = (): ImportSummary => ({
  routesImported: 0,
  tracksImported: 0,
  routesReplaced: 0,
  tracksReplaced: 0,
  duplicatesSkipped: 0,
  errors: [],
})

describe('importToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('summarizes a multi-outcome import', () => {
    const messages: (string | null)[] = []
    const unsub = subscribeToast((m) => messages.push(m))
    showImportSummaryToast({
      ...empty(),
      routesImported: 2,
      tracksImported: 1,
      duplicatesSkipped: 1,
    })
    expect(messages).toEqual(['Imported 2 routes, 1 track, 1 duplicate skipped.'])
    unsub()
  })

  it('clears the toast after the duration', () => {
    const messages: (string | null)[] = []
    const unsub = subscribeToast((m) => messages.push(m))
    showImportSummaryToast(
      { ...empty(), routesImported: 1 },
      1000,
    )
    expect(messages).toEqual(['Imported 1 route.'])
    vi.advanceTimersByTime(1500)
    expect(messages).toEqual(['Imported 1 route.', null])
    unsub()
  })

  it('reports "Nothing to import" when summary is empty', () => {
    const messages: (string | null)[] = []
    const unsub = subscribeToast((m) => messages.push(m))
    showImportSummaryToast(empty())
    expect(messages[0]).toBe('Nothing to import.')
    unsub()
  })
})
```

Run: `npm test -- src/features/import/importToast.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 3.2.15: Create `src/features/import/ImportButton.tsx`**

Wires together: a hidden `<input type="file">`, the duplicate-prompt handle (held in module state on the parent component, not here), the storage lookups, and the store `add`/`update` actions. Calls into `importGpxFiles` and shows the toast.

```tsx
import { useRef } from 'react'
import { sha256Hex } from '../../utils/hash'
import { parseGpx } from '../../utils/gpx'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { getStorage } from '../../storage/provider'
import { importGpxFiles, type DuplicateDecision, type DuplicatePromptArgs } from './gpxImport'
import { showImportSummaryToast } from './importToast'

interface Props {
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export function ImportButton({ promptDuplicate }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    const summary = await importGpxFiles(files, {
      parseGpx,
      hashBytes: sha256Hex,
      lookupRouteByHash: (h) => getStorage().getRouteBySourceHash(h),
      lookupTrackByHash: (h) => getStorage().getTrackBySourceHash(h),
      saveRoute: useRoutesStore.getState().add,
      saveTrack: useTracksStore.getState().add,
      replaceRoute: useRoutesStore.getState().update,
      replaceTrack: useTracksStore.getState().update,
      promptDuplicate,
    })
    showImportSummaryToast(summary)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        Import GPX
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Reset so picking the same file twice fires onChange again.
          e.target.value = ''
          void handleFiles(files)
        }}
      />
    </>
  )
}

// Exported separately so the FileDropzone path can call the same code.
export async function runImport(
  files: File[],
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>,
): Promise<void> {
  const summary = await importGpxFiles(files, {
    parseGpx,
    hashBytes: sha256Hex,
    lookupRouteByHash: (h) => getStorage().getRouteBySourceHash(h),
    lookupTrackByHash: (h) => getStorage().getTrackBySourceHash(h),
    saveRoute: useRoutesStore.getState().add,
    saveTrack: useTracksStore.getState().add,
    replaceRoute: useRoutesStore.getState().update,
    replaceTrack: useTracksStore.getState().update,
    promptDuplicate,
  })
  showImportSummaryToast(summary)
}
```

- [ ] **Step 3.2.16: Modify `src/panels/LayerPanel/LayerPanel.tsx` to host the Import button and the prompt handle**

Add an `<ImportButton>` row above the layer toggles. The duplicate-prompt handle is held by the App-level container (Step 3.2.18); the LayerPanel receives it via context-free prop drilling — accept a `promptDuplicate` prop.

Replace `LayerPanel.tsx` with:

```tsx
import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'
import { ImportButton } from '../../features/import/ImportButton'
import type { DuplicateDecision, DuplicatePromptArgs } from '../../features/import/gpxImport'

interface RowDef {
  key: LayerKey
  label: string
  color: string
}

const ROWS: ReadonlyArray<RowDef> = [
  { key: 'routes',    label: 'Routes',    color: '#E05C2A' },
  { key: 'tracks',    label: 'Tracks',    color: '#2A7BE0' },
  { key: 'waypoints', label: 'Waypoints', color: '#FBBF24' },
  { key: 'photos',    label: 'Photos',    color: '#94A3B8' },
]

interface Props {
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export function LayerPanel({ promptDuplicate }: Props) {
  const visibility = useUiStore((s) => s.layerVisibility)
  const toggleLayer = useUiStore((s) => s.toggleLayer)

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Layers</h2>
      <div className={styles.actions}>
        <ImportButton promptDuplicate={promptDuplicate} />
      </div>
      <ul className={styles.rows}>
        {ROWS.map((row) => {
          const inputId = `layer-toggle-${row.key}`
          return (
            <li key={row.key} className={styles.row} data-row={row.key}>
              <span
                className={styles.swatch}
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <label htmlFor={inputId} className={styles.label}>
                {row.label}
              </label>
              <span className={styles.count} data-count={0}>
                0
              </span>
              <input
                id={inputId}
                type="checkbox"
                role="switch"
                checked={visibility[row.key]}
                onChange={() => toggleLayer(row.key)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

(The count badges are still hard-coded to 0; Task 3.7 wires them up. The button styling reuses the existing `.section button` rule from SettingsPanel — but LayerPanel doesn't import that stylesheet, so we add a small `.actions` selector.)

In `src/panels/LayerPanel/LayerPanel.module.css`, append:

```css
.actions {
  display: flex;
  gap: var(--space-sm);
}

.actions button {
  background: var(--color-bg-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font: inherit;
}

.actions button:hover {
  background: var(--color-bg-1);
}
```

Update `src/panels/LayerPanel/LayerPanel.test.tsx` to pass a stub `promptDuplicate`:

In every `render(<LayerPanel />)` call, change to `render(<LayerPanel promptDuplicate={async () => ({ choice: 'skip', applyToAll: false })} />)`.

Run: `npm test -- src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: PASS (3 existing tests still green).

- [ ] **Step 3.2.17: Add a toast renderer to `src/App.tsx`**

A small inline toast component that subscribes to `subscribeToast` and renders a banner at the bottom of the map area.

We'll create it inline within App.tsx for now to keep the surface tight; if the toast needs more polish later, we can extract.

In `src/App.tsx`, replace the file body with:

```tsx
import { useCallback, useEffect, useState } from 'react'
import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'
import { SettingsPanel } from './panels/SettingsPanel/SettingsPanel'
import { LayerPanel } from './panels/LayerPanel/LayerPanel'
import { useEscapeKey } from './hooks/useEscapeKey'
import { FileDropzone } from './components/FileDropzone/FileDropzone'
import { DuplicatePrompt, type DuplicatePromptHandle } from './features/import/DuplicatePrompt'
import { runImport } from './features/import/ImportButton'
import { subscribeToast } from './features/import/importToast'

export default function App() {
  useEscapeKey()

  const [promptHandle, setPromptHandle] = useState<DuplicatePromptHandle | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => subscribeToast(setToast), [])

  // Stable callback so LayerPanel/dropzone don't re-bind on every render.
  // If the handle isn't ready (StrictMode double-render edge), the prompt
  // resolves immediately to 'skip' as a safe default.
  const promptDuplicate = useCallback(
    async (args: Parameters<DuplicatePromptHandle['enqueue']>[0]) => {
      if (!promptHandle) return { choice: 'skip' as const, applyToAll: false }
      return promptHandle.enqueue(args)
    },
    [promptHandle],
  )

  const onDropFiles = useCallback(
    (files: File[]) => {
      void runImport(files, promptDuplicate)
    },
    [promptDuplicate],
  )

  return (
    <div className={styles.app}>
      <Sidebar
        panels={{
          layers:   <LayerPanel promptDuplicate={promptDuplicate} />,
          settings: <SettingsPanel />,
        }}
      />
      <div data-testid="map-area" className={styles.mapArea}>
        <MapView />
        <FileDropzone onFiles={onDropFiles} />
        {toast && (
          <div role="status" aria-live="polite" className={styles.toast}>
            {toast}
          </div>
        )}
      </div>
      <DuplicatePrompt onReady={setPromptHandle} />
    </div>
  )
}
```

In `src/App.module.css`, append:

```css
.toast {
  position: absolute;
  bottom: var(--space-lg);
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-bg-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  z-index: 60;
}
```

- [ ] **Step 3.2.18: Run typecheck and full test suite**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: every suite green. The full set so far (Phase 1, Phase 2, Task 3.1, Task 3.2) should pass.

- [ ] **Step 3.2.19: Browser smoke test**

Run: `npm run dev` and open the app.
- Open Settings → confirm the API key is set (or set one).
- Open the Layer panel → click **Import GPX**, pick a real GPX route. The route doesn't render yet (Task 3.3) but the toast should say `Imported 1 route.`
- Drag the same file onto the map → drop overlay appears, then a `Already imported` dialog. Click **Skip**. Toast says `1 duplicate skipped.`
- Drag two files at once, one new and one duplicate. Tick **Apply to all**, click **Skip**. Toast reflects both.

`window.__couloir.listAll()` in DevTools confirms the routes are persisted.

- [ ] **Step 3.2.20: Commit**

```bash
git add src/features/import \
        src/components/FileDropzone \
        src/panels/LayerPanel/LayerPanel.tsx src/panels/LayerPanel/LayerPanel.module.css \
        src/panels/LayerPanel/LayerPanel.test.tsx \
        src/App.tsx src/App.module.css
git commit -m "feat(import): GPX import button, drag-drop, dedup prompt, summary toast"
```

---

## Task 3.3 — Routes layer

**Files:**
- Create: `src/hooks/useMap.ts`
- Modify: `src/map/MapView.tsx` (publish the live map via `setMap`; mount `<RoutesLayer/>` and friends inside the map container)
- Create: `src/map/layers/layerStyles.ts`
- Create: `src/map/layers/routesLayerData.ts`
- Create: `src/map/layers/routesLayerData.test.ts`
- Create: `src/map/layers/RoutesLayer.tsx`

This task ends with: imported routes render as colored polylines on the map. Toggling the Routes switch in the Layer panel hides/shows them. Click on a route → detail panel transitions to view mode (no UI for view mode yet — Task 3.5 — but verifiable via `useUiStore.getState().panel.mode === 'view'`).

- [ ] **Step 3.3.1: Create `src/hooks/useMap.ts`**

A small singleton seam: the MapView publishes its `maplibregl.Map` instance via `setMap`, and layer components read it via `useMap`. This avoids prop drilling the map into every layer.

```typescript
import { useSyncExternalStore } from 'react'
import type maplibregl from 'maplibre-gl'

let current: maplibregl.Map | null = null
const listeners = new Set<() => void>()

export function setMap(map: maplibregl.Map | null): void {
  current = map
  for (const l of listeners) l()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot(): maplibregl.Map | null {
  return current
}

// Hook returns the live map instance, or null while the map is being
// initialized / has been torn down. Layer components must guard against null.
export function useMap(): maplibregl.Map | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}
```

- [ ] **Step 3.3.2: Modify `src/map/MapView.tsx` to publish the live map**

Add `import { setMap } from '../hooks/useMap'`. After `mapRef.current = map`, call `setMap(map)`. In the unmount cleanup (the bottom effect), call `setMap(null)`. In the teardown branch where `mapRef.current.remove()` is invoked because the key was cleared, also call `setMap(null)`.

Concretely, three edits in `MapView.tsx`:

1. Top of file:

```typescript
import { setMap } from '../hooks/useMap'
```

2. Inside the main effect, after `mapRef.current = map`:

```typescript
mapRef.current = map
setMap(map)
```

3. In the same effect's "no key" early-return branch, after the `mapRef.current.remove()` call:

```typescript
if (mapRef.current) {
  mapRef.current.remove()
  mapRef.current = null
  setMap(null)
}
```

4. In the unmount-only effect at the bottom:

```typescript
useEffect(() => {
  return () => {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
    setMap(null)
    monitorRef.current = null
  }
}, [])
```

5. Mount the layers inside the map container, after `<TerrainControl />`:

```tsx
<RoutesLayer />
```

(TracksLayer is added in Task 3.4.)

Add the import: `import { RoutesLayer } from './layers/RoutesLayer'`.

- [ ] **Step 3.3.3: Create `src/map/layers/layerStyles.ts`**

```typescript
export const ROUTE_LINE_WIDTH = 3
export const ROUTE_LINE_GLOW_WIDTH = 7
export const ROUTE_LINE_GLOW_OPACITY = 0.25

export const TRACK_LINE_WIDTH = 3
export const TRACK_LINE_DASH: [number, number] = [2, 1.5]

export const ROUTES_SOURCE_ID = 'routes-source'
export const ROUTES_GLOW_LAYER_ID = 'routes-glow'
export const ROUTES_LINE_LAYER_ID = 'routes-line'

export const TRACKS_SOURCE_ID = 'tracks-source'
export const TRACKS_LINE_LAYER_ID = 'tracks-line'
```

- [ ] **Step 3.3.4: Create `src/map/layers/routesLayerData.test.ts`**

```typescript
import { buildRoutesGeoJson } from './routesLayerData'
import type { Route } from '../../types'

const baseRoute = (over: Partial<Route> = {}): Route => ({
  id: 'r1',
  user_id: 'local',
  name: 'r',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
  source_hash: 'h',
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 100,
  elevation_gain_m: 10,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('buildRoutesGeoJson', () => {
  it('returns a FeatureCollection with one feature per route', () => {
    const fc = buildRoutesGeoJson([
      baseRoute({ id: 'a' }),
      baseRoute({ id: 'b' }),
    ])
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features).toHaveLength(2)
    expect(fc.features.map((f) => f.properties.id)).toEqual(['a', 'b'])
  })

  it('exposes id and color as feature properties for click + paint', () => {
    const fc = buildRoutesGeoJson([baseRoute({ id: 'a', color: '#ff0000' })])
    expect(fc.features[0].properties).toEqual({ id: 'a', color: '#ff0000' })
  })

  it('produces an empty collection for no routes', () => {
    const fc = buildRoutesGeoJson([])
    expect(fc).toEqual({ type: 'FeatureCollection', features: [] })
  })
})
```

- [ ] **Step 3.3.5: Run; expect FAIL**

Run: `npm test -- src/map/layers/routesLayerData.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3.3.6: Implement `src/map/layers/routesLayerData.ts`**

```typescript
import type { Route } from '../../types'

// We intentionally don't depend on @types/geojson — minimal local shape.
interface Feature {
  type: 'Feature'
  geometry: Route['geojson']
  properties: { id: string; color: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export function buildRoutesGeoJson(routes: Route[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: routes.map((r) => ({
      type: 'Feature',
      geometry: r.geojson,
      properties: { id: r.id, color: r.color },
    })),
  }
}
```

Run: `npm test -- src/map/layers/routesLayerData.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 3.3.7: Implement `src/map/layers/RoutesLayer.tsx`**

```tsx
import { useEffect } from 'react'
import { useMap } from '../../hooks/useMap'
import { useRoutesStore } from '../../store/routes'
import { useUiStore } from '../../store/ui'
import { buildRoutesGeoJson } from './routesLayerData'
import {
  ROUTES_GLOW_LAYER_ID,
  ROUTES_LINE_LAYER_ID,
  ROUTES_SOURCE_ID,
  ROUTE_LINE_GLOW_OPACITY,
  ROUTE_LINE_GLOW_WIDTH,
  ROUTE_LINE_WIDTH,
} from './layerStyles'

export function RoutesLayer(): null {
  const map = useMap()
  const routes = useRoutesStore((s) => s.routes)
  const visible = useUiStore((s) => s.layerVisibility.routes)

  // (1) Add source and layers when the map first becomes available.
  // setStyle() (basemap or key change) wipes sources, so re-attach on every
  // style.load — same pattern as the DEM source in MapView.tsx.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(ROUTES_SOURCE_ID)) return
      map.addSource(ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: ROUTES_GLOW_LAYER_ID,
        type: 'line',
        source: ROUTES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ROUTE_LINE_GLOW_WIDTH,
          'line-opacity': ROUTE_LINE_GLOW_OPACITY,
          'line-blur': 1,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: ROUTES_LINE_LAYER_ID,
        type: 'line',
        source: ROUTES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ROUTE_LINE_WIDTH,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    install()
    map.on('style.load', install)

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('route', id)
      }
    }
    map.on('click', ROUTES_LINE_LAYER_ID, onClick)
    // Cursor affordance — show pointer when hovering a clickable line.
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }
    map.on('mouseenter', ROUTES_LINE_LAYER_ID, onEnter)
    map.on('mouseleave', ROUTES_LINE_LAYER_ID, onLeave)

    return () => {
      map.off('style.load', install)
      map.off('click', ROUTES_LINE_LAYER_ID, onClick)
      map.off('mouseenter', ROUTES_LINE_LAYER_ID, onEnter)
      map.off('mouseleave', ROUTES_LINE_LAYER_ID, onLeave)
    }
  }, [map])

  // (2) Sync GeoJSON when routes change.
  useEffect(() => {
    if (!map) return
    const src = map.getSource(ROUTES_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    src.setData(buildRoutesGeoJson(routes) as never)
  }, [map, routes])

  // (3) Sync visibility on toggle change.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(ROUTES_LINE_LAYER_ID)) return
    const value = visible ? 'visible' : 'none'
    map.setLayoutProperty(ROUTES_LINE_LAYER_ID, 'visibility', value)
    map.setLayoutProperty(ROUTES_GLOW_LAYER_ID, 'visibility', value)
  }, [map, visible])

  return null
}
```

(Type imports: `import type maplibregl from 'maplibre-gl'` is implicit through the module-level `import 'maplibre-gl'` from MapView, but adding `import type maplibregl from 'maplibre-gl'` here makes the click handler signature happy.)

Add at the top:

```typescript
import type maplibregl from 'maplibre-gl'
```

- [ ] **Step 3.3.8: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors. Run: `npm test`
Expected: green (no new tests for the React layer; pure-data helper already covered).

- [ ] **Step 3.3.9: Browser smoke test**

Run `npm run dev` and:
- Import a route GPX (Task 3.2 path).
- The route should render as a burnt-orange line with a soft glow.
- Toggle Routes off in the Layer panel → the line disappears. Toggle on → reappears.
- Click the line → DevTools `useUiStore.getState().panel.mode` returns `'view'`, with the route's id.
- Switch the basemap (BasemapControl) → the route survives the style swap (it's re-attached on `style.load`).

- [ ] **Step 3.3.10: Commit**

```bash
git add src/hooks/useMap.ts \
        src/map/MapView.tsx \
        src/map/layers/layerStyles.ts \
        src/map/layers/routesLayerData.ts src/map/layers/routesLayerData.test.ts \
        src/map/layers/RoutesLayer.tsx
git commit -m "feat(map): RoutesLayer + useMap hook; render imported routes"
```

---

## Task 3.4 — Tracks layer

**Files:**
- Modify: `src/map/MapView.tsx` (mount `<TracksLayer/>`)
- Create: `src/map/layers/tracksLayerData.ts`
- Create: `src/map/layers/tracksLayerData.test.ts`
- Create: `src/map/layers/TracksLayer.tsx`

This task ends with: imported tracks render as dashed sky-blue lines, visually distinct from routes. The Tracks layer toggle works independently. Clicks dispatch `openEntity('track', id)`.

- [ ] **Step 3.4.1: Create `src/map/layers/tracksLayerData.test.ts`**

Mirrors the routes test:

```typescript
import { buildTracksGeoJson } from './tracksLayerData'
import type { Track } from '../../types'

const baseTrack = (over: Partial<Track> = {}): Track => ({
  id: 't1',
  user_id: 'local',
  name: 't',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
  source_hash: 'h',
  source_filename: null,
  color: '#2A7BE0',
  distance_m: 100,
  elevation_gain_m: 10,
  elevation_loss_m: 0,
  duration_s: null,
  moving_time_s: null,
  recorded_at: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('buildTracksGeoJson', () => {
  it('returns one feature per track with id + color properties', () => {
    const fc = buildTracksGeoJson([
      baseTrack({ id: 'a', color: '#111111' }),
      baseTrack({ id: 'b', color: '#222222' }),
    ])
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].properties).toEqual({ id: 'a', color: '#111111' })
    expect(fc.features[1].properties).toEqual({ id: 'b', color: '#222222' })
  })

  it('returns an empty collection for no tracks', () => {
    const fc = buildTracksGeoJson([])
    expect(fc).toEqual({ type: 'FeatureCollection', features: [] })
  })
})
```

- [ ] **Step 3.4.2: Run; expect FAIL, then implement `src/map/layers/tracksLayerData.ts`**

```typescript
import type { Track } from '../../types'

interface Feature {
  type: 'Feature'
  geometry: Track['geojson']
  properties: { id: string; color: string }
}

interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export function buildTracksGeoJson(tracks: Track[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: tracks.map((t) => ({
      type: 'Feature',
      geometry: t.geojson,
      properties: { id: t.id, color: t.color },
    })),
  }
}
```

Run: `npm test -- src/map/layers/tracksLayerData.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 3.4.3: Implement `src/map/layers/TracksLayer.tsx`**

```tsx
import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useTracksStore } from '../../store/tracks'
import { useUiStore } from '../../store/ui'
import { buildTracksGeoJson } from './tracksLayerData'
import {
  TRACKS_LINE_LAYER_ID,
  TRACKS_SOURCE_ID,
  TRACK_LINE_DASH,
  TRACK_LINE_WIDTH,
} from './layerStyles'

export function TracksLayer(): null {
  const map = useMap()
  const tracks = useTracksStore((s) => s.tracks)
  const visible = useUiStore((s) => s.layerVisibility.tracks)

  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(TRACKS_SOURCE_ID)) return
      map.addSource(TRACKS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: TRACKS_LINE_LAYER_ID,
        type: 'line',
        source: TRACKS_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': TRACK_LINE_WIDTH,
          'line-dasharray': TRACK_LINE_DASH,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    install()
    map.on('style.load', install)

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('track', id)
      }
    }
    map.on('click', TRACKS_LINE_LAYER_ID, onClick)
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }
    map.on('mouseenter', TRACKS_LINE_LAYER_ID, onEnter)
    map.on('mouseleave', TRACKS_LINE_LAYER_ID, onLeave)

    return () => {
      map.off('style.load', install)
      map.off('click', TRACKS_LINE_LAYER_ID, onClick)
      map.off('mouseenter', TRACKS_LINE_LAYER_ID, onEnter)
      map.off('mouseleave', TRACKS_LINE_LAYER_ID, onLeave)
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    const src = map.getSource(TRACKS_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    src.setData(buildTracksGeoJson(tracks) as never)
  }, [map, tracks])

  useEffect(() => {
    if (!map) return
    if (!map.getLayer(TRACKS_LINE_LAYER_ID)) return
    map.setLayoutProperty(TRACKS_LINE_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible])

  return null
}
```

- [ ] **Step 3.4.4: Mount `<TracksLayer />` inside `MapView.tsx`**

Add `import { TracksLayer } from './layers/TracksLayer'` and a `<TracksLayer />` element next to `<RoutesLayer />` in the JSX.

- [ ] **Step 3.4.5: Run typecheck and tests**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: green.

- [ ] **Step 3.4.6: Browser smoke test**

- Import a track GPX. The track renders as a dashed sky-blue line.
- Visually compare against an already-imported route — they should be obviously distinct (solid orange + glow vs. dashed blue).
- Toggle Tracks off in the Layer panel; routes remain visible. Toggle Routes off; tracks remain visible. Toggles are independent.
- Click a track → `useUiStore.getState().panel` shows `mode: 'view', entityType: 'track', entityId: '...'`.

- [ ] **Step 3.4.7: Commit**

```bash
git add src/map/MapView.tsx \
        src/map/layers/tracksLayerData.ts src/map/layers/tracksLayerData.test.ts \
        src/map/layers/TracksLayer.tsx
git commit -m "feat(map): TracksLayer renders dashed lines independent of routes"
```

---

## Task 3.5 — Route detail panel

**Files:**
- Modify: `package.json` (add `recharts`)
- Create: `src/utils/format.ts`
- Create: `src/utils/format.test.ts`
- Create: `src/components/ElevationProfile/ElevationProfile.tsx`
- Create: `src/components/ElevationProfile/ElevationProfile.module.css`
- Create: `src/components/ElevationProfile/ElevationProfile.test.tsx`
- Create: `src/panels/DetailPanel/DetailPanel.tsx`
- Create: `src/panels/DetailPanel/DetailPanel.module.css`
- Create: `src/panels/DetailPanel/DetailPanel.test.tsx`
- Create: `src/panels/DetailPanel/DetailPanel.shared.module.css`
- Create: `src/panels/DetailPanel/RouteDetail.tsx`
- Create: `src/panels/DetailPanel/RouteDetail.test.tsx`
- Create: `src/panels/DetailPanel/TagPills.tsx`
- Create: `src/panels/DetailPanel/ConfirmDelete.tsx`
- Modify: `src/App.tsx` (mount `<DetailPanel/>`)

This task ends with: clicking a route opens a side panel showing all metadata + elevation profile + Edit/Delete. Edit form lets the user change name/description/color/ATES/technical (tags are read-only here; full picker arrives in Phase 6.1). Save persists; Delete removes after a confirm.

- [ ] **Step 3.5.1: Add `recharts` to dependencies**

Edit `package.json` `dependencies`:

```json
"dependencies": {
  "maplibre-gl": "^4.7.1",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "recharts": "^2.13.0",
  "wa-sqlite": "^1.0.0",
  "zustand": "^4.5.5"
}
```

Run: `npm install`
Expected: completes; `node_modules/recharts/package.json` exists.

- [ ] **Step 3.5.2: Create `src/utils/format.test.ts`**

```typescript
import { formatDistanceKm, formatElevationM, formatDuration, isValidHex } from './format'

describe('formatDistanceKm', () => {
  it('returns 0.0 km for 0 m', () => {
    expect(formatDistanceKm(0)).toBe('0.0 km')
  })
  it('rounds to one decimal', () => {
    expect(formatDistanceKm(1234)).toBe('1.2 km')
    expect(formatDistanceKm(99)).toBe('0.1 km')
  })
})

describe('formatElevationM', () => {
  it('returns rounded integer metres', () => {
    expect(formatElevationM(0)).toBe('0 m')
    expect(formatElevationM(1499.6)).toBe('1500 m')
  })
})

describe('formatDuration', () => {
  it('renders short durations as Xm', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(59)).toBe('0m')
    expect(formatDuration(125)).toBe('2m')
  })
  it('renders multi-hour durations as Xh Ym', () => {
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(3661)).toBe('1h 1m')
    expect(formatDuration(22_320)).toBe('6h 12m')
  })
  it('renders null as em-dash', () => {
    expect(formatDuration(null)).toBe('—')
  })
})

describe('isValidHex', () => {
  it('accepts 6-digit RGB hex with leading hash', () => {
    expect(isValidHex('#A1b2c3')).toBe(true)
    expect(isValidHex('#000000')).toBe(true)
  })
  it('rejects bad shapes', () => {
    expect(isValidHex('A1b2c3')).toBe(false)   // no hash
    expect(isValidHex('#fff')).toBe(false)      // shorthand not allowed
    expect(isValidHex('#abcdefg')).toBe(false)  // too long
    expect(isValidHex('')).toBe(false)
  })
})
```

- [ ] **Step 3.5.3: Run; expect FAIL, then implement `src/utils/format.ts`**

```typescript
export function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatElevationM(meters: number): string {
  return `${Math.round(meters)} m`
}

// Track durations: seconds → "Xh Ym" or "Ym" for sub-hour. Null → em-dash.
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes - hours * 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

// Validates 6-digit RGB hex with leading '#'. We deliberately exclude
// shorthand (#abc) and 8-digit (#aabbccdd) — the data model requires #RRGGBB.
const HEX_RE = /^#[0-9a-fA-F]{6}$/
export function isValidHex(value: string): boolean {
  return HEX_RE.test(value)
}
```

Run: `npm test -- src/utils/format.test.ts`
Expected: PASS, 4 describe blocks (10 tests).

- [ ] **Step 3.5.4: Create `src/components/ElevationProfile/ElevationProfile.tsx`**

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { LineStringZ } from '../../types'
import { cumulativeDistanceMeters } from '../../utils/geo'
import styles from './ElevationProfile.module.css'

interface Props {
  geojson: LineStringZ
  height?: number
}

export function ElevationProfile({ geojson, height = 160 }: Props): JSX.Element {
  if (geojson.coordinates.length < 2) {
    return <div className={styles.empty}>Profile unavailable (need ≥ 2 points).</div>
  }
  const distances = cumulativeDistanceMeters(geojson)
  const data = distances.map((d, i) => ({
    distanceKm: d / 1000,
    elevationM: geojson.coordinates[i][2],
  }))

  return (
    <div className={styles.wrap} data-testid="elevation-profile">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
          <XAxis
            dataKey="distanceKm"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => `${v.toFixed(1)} km`}
            stroke="var(--color-text-dim)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            dataKey="elevationM"
            type="number"
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `${Math.round(v)} m`}
            stroke="var(--color-text-dim)"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-2)',
              border: '1px solid var(--color-border)',
            }}
            formatter={(v: number, key: string) =>
              key === 'elevationM' ? `${Math.round(v)} m` : `${v.toFixed(2)} km`
            }
          />
          <Line
            type="monotone"
            dataKey="elevationM"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3.5.5: Create `src/components/ElevationProfile/ElevationProfile.module.css`**

```css
.wrap {
  width: 100%;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
}

.empty {
  color: var(--color-text-dim);
  font-size: 12px;
  padding: var(--space-md);
}
```

- [ ] **Step 3.5.6: Create `src/components/ElevationProfile/ElevationProfile.test.tsx`**

Recharts uses `ResponsiveContainer`, which measures parent size; in jsdom that's 0×0 and renders nothing. We rely on the wrapper `data-testid` for sanity, plus the empty-state branch.

```tsx
import { render, screen } from '@testing-library/react'
import { ElevationProfile } from './ElevationProfile'
import type { LineStringZ } from '../../types'

describe('ElevationProfile', () => {
  it('renders the wrapper for a 2+ point line', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1520],
      ],
    }
    render(<ElevationProfile geojson={ls} />)
    expect(screen.getByTestId('elevation-profile')).toBeInTheDocument()
  })

  it('shows the unavailable message for < 2 points', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [[-116, 49.5, 1500]] }
    render(<ElevationProfile geojson={ls} />)
    expect(screen.getByText(/profile unavailable/i)).toBeInTheDocument()
  })
})
```

Run: `npm test -- src/components/ElevationProfile/ElevationProfile.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 3.5.7: Create `src/panels/DetailPanel/TagPills.tsx`**

Tags are read-only in this phase. The full picker lands in Phase 6.1.

```tsx
import { useTagsStore } from '../../store/tags'

interface Props {
  tagIds: string[]
}

export function TagPills({ tagIds }: Props): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const byId = new Map(tags.map((t) => [t.id, t]))
  if (tagIds.length === 0) {
    return <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>No tags</span>
  }
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tagIds.map((id) => {
        const tag = byId.get(id)
        if (!tag) return null
        return (
          <span
            key={id}
            style={{
              background: tag.color,
              color: '#000',
              fontSize: 11,
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
            }}
          >
            {tag.name}
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3.5.8: Create `src/panels/DetailPanel/ConfirmDelete.tsx`**

```tsx
import { useState } from 'react'

interface Props {
  label?: string
  onConfirm: () => void
}

export function ConfirmDelete({ label = 'Delete', onConfirm }: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)}>
        {label}
      </button>
    )
  }
  return (
    <div style={{ display: 'inline-flex', gap: 'var(--space-sm)' }}>
      <button type="button" onClick={onConfirm}>
        Confirm delete
      </button>
      <button type="button" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 3.5.9: Create `src/panels/DetailPanel/DetailPanel.shared.module.css`**

Shared styles used by both `RouteDetail` and `TrackDetail` (Task 3.6).

```css
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.section h3 {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-dim);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field input,
.field textarea,
.field select {
  background: var(--color-bg-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  color: var(--color-text);
  font: inherit;
}

.row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.metricsGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metricLabel {
  color: var(--color-text-dim);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metricValue {
  font-size: 14px;
}
```

- [ ] **Step 3.5.10: Create `src/panels/DetailPanel/DetailPanel.module.css`**

```css
.panel {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  width: 360px;
  max-height: calc(100% - var(--space-xl));
  overflow-y: auto;
  background: var(--color-bg-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  z-index: 40;
  color: var(--color-text);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-sm);
}

.heading {
  margin: 0;
  font-size: 16px;
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

.actions button {
  background: var(--color-bg-2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  font: inherit;
}

.actions button:hover {
  background: var(--color-bg-0);
}

.subtle {
  color: var(--color-text-dim);
  font-size: 12px;
}
```

- [ ] **Step 3.5.11: Create `src/panels/DetailPanel/RouteDetail.tsx`**

```tsx
import { useState, useEffect } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useRoutesStore } from '../../store/routes'
import { useUiStore } from '../../store/ui'
import { ATES_LABELS, TECHNICAL_DIFFICULTY_LABELS } from '../../types'
import type { ATES, Route, TechnicalDifficulty } from '../../types'
import { formatDistanceKm, formatElevationM, isValidHex } from '../../utils/format'
import { ElevationProfile } from '../../components/ElevationProfile/ElevationProfile'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'

interface Props {
  routeId: string
  mode: 'view' | 'edit'
}

export function RouteDetail({ routeId, mode }: Props): JSX.Element {
  const route = useRoutesStore((s) => s.routes.find((r) => r.id === routeId)) ?? null
  if (!route) {
    return <div className={styles.subtle}>Route not found.</div>
  }
  return mode === 'view' ? <RouteView route={route} /> : <RouteEdit route={route} />
}

function RouteView({ route }: { route: Route }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = useRoutesStore((s) => s.remove)

  const handleDelete = async () => {
    await remove(route.id)
    closePanel()
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{route.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent()}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      {route.description && (
        <p className={styles.subtle}>{route.description}</p>
      )}

      <section className={shared.section}>
        <div className={shared.metricsGrid}>
          <Metric label="Distance" value={formatDistanceKm(route.distance_m)} />
          <Metric label="Gain" value={formatElevationM(route.elevation_gain_m)} />
          <Metric label="Loss" value={formatElevationM(route.elevation_loss_m)} />
          <Metric
            label="ATES"
            value={route.ates ? ATES_LABELS[route.ates] : 'Not rated'}
          />
          <Metric
            label="Technical"
            value={
              route.technical_difficulty
                ? TECHNICAL_DIFFICULTY_LABELS[route.technical_difficulty]
                : 'Not rated'
            }
          />
        </div>
      </section>

      <section className={shared.section}>
        <h3>Elevation profile</h3>
        <ElevationProfile geojson={route.geojson} />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={route.tags} />
      </section>

      <section className={shared.section}>
        <h3>Source</h3>
        <p className={styles.subtle}>{route.source_filename ?? 'Unknown'}</p>
      </section>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className={shared.metric}>
      <span className={shared.metricLabel}>{label}</span>
      <span className={shared.metricValue}>{value}</span>
    </div>
  )
}

function RouteEdit({ route }: { route: Route }): JSX.Element {
  const update = useRoutesStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)

  const [name, setName] = useState(route.name)
  const [description, setDescription] = useState(route.description)
  const [color, setColor] = useState(route.color)
  const [ates, setAtes] = useState<ATES | ''>(route.ates ?? '')
  const [tech, setTech] = useState<TechnicalDifficulty | ''>(route.technical_difficulty ?? '')

  // Reload local state if the underlying route is replaced (e.g. duplicate
  // import re-applied). Keying on id+updated_at makes this exact.
  useEffect(() => {
    setName(route.name)
    setDescription(route.description)
    setColor(route.color)
    setAtes(route.ates ?? '')
    setTech(route.technical_difficulty ?? '')
  }, [route.id, route.updated_at])

  const colorOk = isValidHex(color)
  const canSave = name.trim().length > 0 && colorOk

  const onSave = async () => {
    if (!canSave) return
    await update(route.id, {
      name: name.trim(),
      description,
      color,
      ates: ates === '' ? null : ates,
      technical_difficulty: tech === '' ? null : tech,
    })
    openEntity('route', route.id)
  }

  const onCancel = () => openEntity('route', route.id)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit route</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>
            Save
          </button>
        </div>
      </div>

      <section className={shared.section}>
        <label className={shared.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={shared.field}>
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={shared.field}>
          <span>Color</span>
          <div className={shared.row}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!colorOk}
            />
          </div>
          {!colorOk && (
            <span className={styles.subtle}>Use #RRGGBB hex.</span>
          )}
        </label>
        <label className={shared.field}>
          <span>ATES</span>
          <select value={ates} onChange={(e) => setAtes(e.target.value as ATES | '')}>
            <option value="">— not rated</option>
            {(Object.keys(ATES_LABELS) as ATES[]).map((k) => (
              <option key={k} value={k}>{ATES_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className={shared.field}>
          <span>Technical difficulty</span>
          <select value={tech} onChange={(e) => setTech(e.target.value as TechnicalDifficulty | '')}>
            <option value="">— not rated</option>
            {(Object.keys(TECHNICAL_DIFFICULTY_LABELS) as TechnicalDifficulty[]).map((k) => (
              <option key={k} value={k}>{TECHNICAL_DIFFICULTY_LABELS[k]}</option>
            ))}
          </select>
        </label>
      </section>
    </>
  )
}
```

- [ ] **Step 3.5.12: Create `src/panels/DetailPanel/RouteDetail.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouteDetail } from './RouteDetail'
import { useRoutesStore } from '../../store/routes'
import { useUiStore } from '../../store/ui'
import { useTagsStore } from '../../store/tags'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Route } from '../../types'

const baseRoute: Route = {
  id: 'r1',
  user_id: 'local',
  name: 'Polar Peak',
  description: 'Classic spring line',
  geojson: {
    type: 'LineString',
    coordinates: [
      [-115, 49.5, 1800],
      [-115, 49.51, 2100],
    ],
  },
  source_hash: 'h',
  source_filename: 'polar.gpx',
  color: '#E05C2A',
  ates: 'complex',
  technical_difficulty: 'hard',
  distance_m: 4321,
  elevation_gain_m: 800,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('RouteDetail', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    await storage.saveRoute(baseRoute)
    setStorage(storage)
    useRoutesStore.setState({ routes: [baseRoute], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => {
    clearStorage()
  })

  it('view mode shows name, distance, ATES, technical, and source', () => {
    render(<RouteDetail routeId="r1" mode="view" />)
    expect(screen.getByText('Polar Peak')).toBeInTheDocument()
    expect(screen.getByText('4.3 km')).toBeInTheDocument()
    expect(screen.getByText('800 m')).toBeInTheDocument()
    expect(screen.getByText(/Complex/i)).toBeInTheDocument()
    expect(screen.getByText(/^Hard$/)).toBeInTheDocument()
    expect(screen.getByText('polar.gpx')).toBeInTheDocument()
  })

  it('view mode shows "Not rated" when ratings are null', () => {
    useRoutesStore.setState({
      routes: [{ ...baseRoute, ates: null, technical_difficulty: null }],
    })
    render(<RouteDetail routeId="r1" mode="view" />)
    expect(screen.getAllByText('Not rated').length).toBe(2)
  })

  it('Edit button transitions panel to edit mode', async () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'route', entityId: 'r1' } })
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="view" />)
    await user.click(screen.getByRole('button', { name: /^Edit$/ }))
    expect(useUiStore.getState().panel.mode).toBe('edit')
  })

  it('edit form Save persists changes and returns to view', async () => {
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="edit" />)
    const nameInput = screen.getByDisplayValue('Polar Peak')
    await user.clear(nameInput)
    await user.type(nameInput, 'Polar Peak West')

    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    const after = useRoutesStore.getState().routes[0]
    expect(after.name).toBe('Polar Peak West')
    expect(useUiStore.getState().panel.mode).toBe('view')
  })

  it('edit form rejects empty name', async () => {
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="edit" />)
    const nameInput = screen.getByDisplayValue('Polar Peak')
    await user.clear(nameInput)
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled()
  })

  it('edit form rejects invalid hex color', async () => {
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="edit" />)
    // The color row has two inputs — a `<input type="color">` and the text
    // input — both initially showing the same hex value. Index [1] is the
    // text input (the editable one for invalid-format tests).
    const colorInputs = screen.getAllByDisplayValue('#E05C2A')
    const colorTextInput = colorInputs[1]
    await user.clear(colorTextInput)
    await user.type(colorTextInput, 'not-a-color')
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled()
  })

  it('Delete + Confirm removes the route and closes the panel', async () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'route', entityId: 'r1' } })
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="view" />)
    await user.click(screen.getByRole('button', { name: /^Delete$/ }))
    await user.click(screen.getByRole('button', { name: /^Confirm delete$/ }))
    expect(useRoutesStore.getState().routes).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
```

Run: `npm test -- src/panels/DetailPanel/RouteDetail.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 3.5.13: Create `src/panels/DetailPanel/DetailPanel.tsx`**

The router on `panel.mode` and `panel.entityType`. Renders `null` when idle. For Phase 3 only `route` and `track` are wired; `waypoint` and `photo` show a small placeholder until Phases 4–5.

```tsx
import styles from './DetailPanel.module.css'
import { useUiStore } from '../../store/ui'
import { RouteDetail } from './RouteDetail'
// TrackDetail is added in Task 3.6.

export function DetailPanel(): JSX.Element | null {
  const panel = useUiStore((s) => s.panel)
  const closePanel = useUiStore((s) => s.closePanel)

  if (panel.mode === 'idle') return null

  let body: JSX.Element
  if (panel.mode === 'view' || panel.mode === 'edit') {
    if (panel.entityType === 'route') {
      body = <RouteDetail routeId={panel.entityId} mode={panel.mode} />
    } else if (panel.entityType === 'track') {
      // TrackDetail wired in Task 3.6.
      body = <TrackPlaceholder id={panel.entityId} />
    } else {
      body = <UnsupportedPlaceholder type={panel.entityType} />
    }
  } else {
    // panel.mode === 'create' (waypoints/photos in Phase 4–5).
    body = <UnsupportedPlaceholder type={panel.entityType} />
  }

  return (
    <aside className={styles.panel} role="complementary" aria-label="Detail panel">
      {body}
      <button
        type="button"
        onClick={closePanel}
        style={{ alignSelf: 'flex-start' }}
      >
        Close
      </button>
    </aside>
  )
}

function TrackPlaceholder({ id }: { id: string }): JSX.Element {
  return <div>Track detail (id={id}) — Task 3.6.</div>
}

function UnsupportedPlaceholder({ type }: { type: string }): JSX.Element {
  return <div>Detail for {type} arrives in a later phase.</div>
}
```

- [ ] **Step 3.5.14: Create `src/panels/DetailPanel/DetailPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { DetailPanel } from './DetailPanel'
import { useUiStore } from '../../store/ui'
import { useRoutesStore } from '../../store/routes'
import { useTagsStore } from '../../store/tags'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Route } from '../../types'

const route: Route = {
  id: 'r1',
  user_id: 'local',
  name: 'X',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
  source_hash: 'h',
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('DetailPanel', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useRoutesStore.setState({ routes: [route], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => {
    clearStorage()
  })

  it('renders nothing when idle', () => {
    const { container } = render(<DetailPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the RouteDetail view when panel.entityType is route', () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'route', entityId: 'r1' } })
    render(<DetailPanel />)
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByText('X')).toBeInTheDocument()
  })

  it('renders the track placeholder before Task 3.6 lands', () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'track', entityId: 't1' } })
    render(<DetailPanel />)
    expect(screen.getByText(/track detail/i)).toBeInTheDocument()
  })
})
```

Run: `npm test -- src/panels/DetailPanel/DetailPanel.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 3.5.15: Mount `<DetailPanel/>` in `src/App.tsx`**

Add `import { DetailPanel } from './panels/DetailPanel/DetailPanel'`. Inside the `<div data-testid="map-area">`, after the `{toast && ...}` block, add:

```tsx
<DetailPanel />
```

- [ ] **Step 3.5.16: Run typecheck and full test suite**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: every suite green.

- [ ] **Step 3.5.17: Browser smoke test**

- Import a route GPX.
- Click the line on the map → the detail panel slides in on the right with all metadata, the elevation profile chart, and tag pills (empty state).
- Click **Edit** → form appears. Change the name, ATES → "Complex", Technical → "Hard". Click **Save**. The view returns; the map line stays in place. Reload the page → the changes persist (verify via `window.__couloir.listAll()`).
- Try an invalid color in the text field; **Save** disables.
- Click **Delete** → second confirmation appears → click **Confirm delete**. The route disappears from the map and the panel closes.

- [ ] **Step 3.5.18: Commit**

```bash
git add package.json package-lock.json \
        src/utils/format.ts src/utils/format.test.ts \
        src/components/ElevationProfile \
        src/panels/DetailPanel \
        src/App.tsx
git commit -m "feat(detail): route detail panel with elevation profile, edit, delete"
```

---

## Task 3.6 — Track detail panel

**Files:**
- Create: `src/panels/DetailPanel/TrackDetail.tsx`
- Create: `src/panels/DetailPanel/TrackDetail.test.tsx`
- Modify: `src/panels/DetailPanel/DetailPanel.tsx` (replace placeholder with `<TrackDetail />`)

This task ends with: clicking a track on the map opens the panel with all track-specific metadata: date recorded, total elapsed time + moving time displayed side by side, distance, elevation gain/loss, color, tags, source filename, elevation profile. Edit and delete work like routes, but without ATES/technical fields.

- [ ] **Step 3.6.1: Create `src/panels/DetailPanel/TrackDetail.tsx`**

```tsx
import { useState, useEffect } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useTracksStore } from '../../store/tracks'
import { useUiStore } from '../../store/ui'
import type { Track } from '../../types'
import {
  formatDistanceKm,
  formatDuration,
  formatElevationM,
  isValidHex,
} from '../../utils/format'
import { ElevationProfile } from '../../components/ElevationProfile/ElevationProfile'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'

interface Props {
  trackId: string
  mode: 'view' | 'edit'
}

export function TrackDetail({ trackId, mode }: Props): JSX.Element {
  const track = useTracksStore((s) => s.tracks.find((t) => t.id === trackId)) ?? null
  if (!track) return <div className={styles.subtle}>Track not found.</div>
  return mode === 'view' ? <TrackView track={track} /> : <TrackEdit track={track} />
}

function TrackView({ track }: { track: Track }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = useTracksStore((s) => s.remove)

  const handleDelete = async () => {
    await remove(track.id)
    closePanel()
  }

  // Bare date format — recorded_at is "2026-04-01T08:00:00Z" — for header
  // display we want something readable. Keep it short and locale-default.
  const recordedAt = track.recorded_at
    ? new Date(track.recorded_at).toLocaleDateString()
    : '—'

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{track.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent()}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      {track.description && (
        <p className={styles.subtle}>{track.description}</p>
      )}

      <section className={shared.section}>
        <div className={shared.metricsGrid}>
          <Metric label="Date" value={recordedAt} />
          <Metric label="Distance" value={formatDistanceKm(track.distance_m)} />
          <Metric label="Gain" value={formatElevationM(track.elevation_gain_m)} />
          <Metric label="Loss" value={formatElevationM(track.elevation_loss_m)} />
        </div>
        <div className={shared.row}>
          <Metric label="Total" value={formatDuration(track.duration_s)} />
          <Metric label="Moving" value={formatDuration(track.moving_time_s)} />
        </div>
      </section>

      <section className={shared.section}>
        <h3>Elevation profile</h3>
        <ElevationProfile geojson={track.geojson} />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={track.tags} />
      </section>

      <section className={shared.section}>
        <h3>Source</h3>
        <p className={styles.subtle}>{track.source_filename ?? 'Unknown'}</p>
      </section>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className={shared.metric}>
      <span className={shared.metricLabel}>{label}</span>
      <span className={shared.metricValue}>{value}</span>
    </div>
  )
}

function TrackEdit({ track }: { track: Track }): JSX.Element {
  const update = useTracksStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)

  const [name, setName] = useState(track.name)
  const [description, setDescription] = useState(track.description)
  const [color, setColor] = useState(track.color)

  useEffect(() => {
    setName(track.name)
    setDescription(track.description)
    setColor(track.color)
  }, [track.id, track.updated_at])

  const colorOk = isValidHex(color)
  const canSave = name.trim().length > 0 && colorOk

  const onSave = async () => {
    if (!canSave) return
    await update(track.id, { name: name.trim(), description, color })
    openEntity('track', track.id)
  }
  const onCancel = () => openEntity('track', track.id)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit track</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        </div>
      </div>

      <section className={shared.section}>
        <label className={shared.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={shared.field}>
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={shared.field}>
          <span>Color</span>
          <div className={shared.row}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!colorOk}
            />
          </div>
          {!colorOk && <span className={styles.subtle}>Use #RRGGBB hex.</span>}
        </label>
      </section>
    </>
  )
}
```

- [ ] **Step 3.6.2: Create `src/panels/DetailPanel/TrackDetail.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrackDetail } from './TrackDetail'
import { useTracksStore } from '../../store/tracks'
import { useTagsStore } from '../../store/tags'
import { useUiStore } from '../../store/ui'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Track } from '../../types'

const baseTrack: Track = {
  id: 't1',
  user_id: 'local',
  name: 'Tour A',
  description: '',
  geojson: {
    type: 'LineString',
    coordinates: [
      [-116, 49.5, 1500],
      [-116, 49.51, 1510],
    ],
  },
  source_hash: 'h',
  source_filename: 'tour.gpx',
  color: '#2A7BE0',
  distance_m: 12_345,
  elevation_gain_m: 800,
  elevation_loss_m: 800,
  duration_s: 22_320, // 6h 12m
  moving_time_s: 17_220, // 4h 47m
  recorded_at: '2026-03-15T15:00:00.000Z',
  tags: [],
  created_at: '2026-03-15T20:00:00.000Z',
  updated_at: '2026-03-15T20:00:00.000Z',
}

describe('TrackDetail', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    await storage.saveTrack(baseTrack)
    setStorage(storage)
    useTracksStore.setState({ tracks: [baseTrack], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => {
    clearStorage()
  })

  it('renders total and moving times as separate values', () => {
    render(<TrackDetail trackId="t1" mode="view" />)
    expect(screen.getByText('6h 12m')).toBeInTheDocument()
    expect(screen.getByText('4h 47m')).toBeInTheDocument()
  })

  it('renders em-dash for both time fields when timestamps are absent', () => {
    useTracksStore.setState({
      tracks: [{ ...baseTrack, duration_s: null, moving_time_s: null, recorded_at: null }],
    })
    render(<TrackDetail trackId="t1" mode="view" />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('does not show ATES or technical difficulty fields', () => {
    render(<TrackDetail trackId="t1" mode="view" />)
    expect(screen.queryByText(/ATES/i)).toBeNull()
    expect(screen.queryByText(/Technical/i)).toBeNull()
  })

  it('Edit form Save updates name and color', async () => {
    const user = userEvent.setup()
    render(<TrackDetail trackId="t1" mode="edit" />)
    const nameInput = screen.getByDisplayValue('Tour A')
    await user.clear(nameInput)
    await user.type(nameInput, 'Tour A v2')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(useTracksStore.getState().tracks[0].name).toBe('Tour A v2')
    expect(useUiStore.getState().panel.mode).toBe('view')
  })

  it('Delete + Confirm removes the track and closes the panel', async () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'track', entityId: 't1' } })
    const user = userEvent.setup()
    render(<TrackDetail trackId="t1" mode="view" />)
    await user.click(screen.getByRole('button', { name: /^Delete$/ }))
    await user.click(screen.getByRole('button', { name: /^Confirm delete$/ }))
    expect(useTracksStore.getState().tracks).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
```

Run: `npm test -- src/panels/DetailPanel/TrackDetail.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 3.6.3: Wire `<TrackDetail/>` into `DetailPanel.tsx`**

Replace the `TrackPlaceholder` import/component with the real one. In `DetailPanel.tsx`:

Add: `import { TrackDetail } from './TrackDetail'`

Replace this block:

```tsx
} else if (panel.entityType === 'track') {
  // TrackDetail wired in Task 3.6.
  body = <TrackPlaceholder id={panel.entityId} />
}
```

with:

```tsx
} else if (panel.entityType === 'track') {
  body = <TrackDetail trackId={panel.entityId} mode={panel.mode} />
}
```

Delete the `TrackPlaceholder` helper function (no longer referenced).

Update `DetailPanel.test.tsx`'s "renders the track placeholder" test: rename to "renders TrackDetail when entityType is track", and replace its assertion with one that checks for the track's name. To do that, set up a track in the store:

Replace that test with:

```tsx
it('renders TrackDetail when entityType is track', async () => {
  const { useTracksStore } = await import('../../store/tracks')
  useTracksStore.setState({
    tracks: [{
      id: 't1',
      user_id: 'local',
      name: 'A track',
      description: '',
      geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
      source_hash: 'h',
      source_filename: null,
      color: '#2A7BE0',
      distance_m: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      duration_s: null,
      moving_time_s: null,
      recorded_at: null,
      tags: [],
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }],
    loading: false,
    error: null,
  })
  useUiStore.setState({ panel: { mode: 'view', entityType: 'track', entityId: 't1' } })
  render(<DetailPanel />)
  expect(screen.getByText('A track')).toBeInTheDocument()
})
```

- [ ] **Step 3.6.4: Run typecheck and tests**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: green.

- [ ] **Step 3.6.5: Browser smoke test**

- Import a track GPX with timestamps and at least one rest period.
- Click the dashed line → panel shows date, distance, gain, loss, **Total: 6h 12m · Moving: 4h 47m** (or your file's values).
- Edit name + color, save, reload — values persist.
- Delete works as for routes.
- Re-import a timestamp-less GPX (or test fixture) — both Total and Moving show "—".

- [ ] **Step 3.6.6: Commit**

```bash
git add src/panels/DetailPanel/TrackDetail.tsx \
        src/panels/DetailPanel/TrackDetail.test.tsx \
        src/panels/DetailPanel/DetailPanel.tsx \
        src/panels/DetailPanel/DetailPanel.test.tsx
git commit -m "feat(detail): track detail panel with total/moving time, edit, delete"
```

---

## Task 3.7 — Layer panel counts

**Files:**
- Modify: `src/panels/LayerPanel/LayerPanel.tsx`
- Modify: `src/panels/LayerPanel/LayerPanel.test.tsx`

This task ends with: the count badges in the Layer panel reflect the live entity counts. Routes/Tracks update on import and delete. Waypoints and Photos still show 0 (their CRUD lands in Phase 4–5).

- [ ] **Step 3.7.1: Modify `LayerPanel.tsx` to read counts from the stores**

In `src/panels/LayerPanel/LayerPanel.tsx`, add at the top:

```typescript
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
```

Inside the `LayerPanel` component, replace the existing `visibility` and `toggleLayer` selectors with:

```typescript
  const visibility = useUiStore((s) => s.layerVisibility)
  const toggleLayer = useUiStore((s) => s.toggleLayer)
  const routesCount    = useRoutesStore((s) => s.routes.length)
  const tracksCount    = useTracksStore((s) => s.tracks.length)
  const waypointsCount = useWaypointsStore((s) => s.waypoints.length)
  const photosCount    = usePhotosStore((s) => s.photos.length)

  const counts: Record<LayerKey, number> = {
    routes: routesCount,
    tracks: tracksCount,
    waypoints: waypointsCount,
    photos: photosCount,
  }
```

Replace the count `<span>` line:

```tsx
              <span className={styles.count} data-count={0}>
                0
              </span>
```

with:

```tsx
              <span className={styles.count} data-count={counts[row.key]}>
                {counts[row.key]}
              </span>
```

- [ ] **Step 3.7.2: Update `LayerPanel.test.tsx` for the count behavior**

Replace the existing "renders four rows with zero counts" test with one that exercises both the empty-state and the populated case. Add a `beforeEach` that resets the stores.

Replace the file body with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayerPanel } from './LayerPanel'
import { useUiStore } from '../../store/ui'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import type { Route, Track } from '../../types'

const stubPrompt = async () =>
  ({ choice: 'skip' as const, applyToAll: false })

const fakeRoute = (id: string): Route => ({
  id,
  user_id: 'local',
  name: id,
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
  source_hash: 'h',
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
})

const fakeTrack = (id: string): Track => ({
  id,
  user_id: 'local',
  name: id,
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
  source_hash: 'h',
  source_filename: null,
  color: '#2A7BE0',
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  duration_s: null,
  moving_time_s: null,
  recorded_at: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
})

describe('LayerPanel', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
    useRoutesStore.setState({ routes: [], loading: false, error: null })
    useTracksStore.setState({ tracks: [], loading: false, error: null })
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
    usePhotosStore.setState({ photos: [], loading: false, error: null })
  })

  it('shows zero counts for an empty store', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    for (const label of ['Routes', 'Tracks', 'Waypoints', 'Photos']) {
      const row = screen.getByText(label).closest('[data-row]')
      expect(row?.querySelector('[data-count]')).toHaveAttribute('data-count', '0')
    }
  })

  it('reflects route and track counts from the stores', () => {
    useRoutesStore.setState({
      routes: [fakeRoute('a'), fakeRoute('b')],
      loading: false,
      error: null,
    })
    useTracksStore.setState({
      tracks: [fakeTrack('x')],
      loading: false,
      error: null,
    })
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    const routesRow = screen.getByText('Routes').closest('[data-row]')
    const tracksRow = screen.getByText('Tracks').closest('[data-row]')
    expect(routesRow?.querySelector('[data-count]')).toHaveAttribute('data-count', '2')
    expect(tracksRow?.querySelector('[data-count]')).toHaveAttribute('data-count', '1')
  })

  it('toggles layer visibility when the switch is clicked', async () => {
    const user = userEvent.setup()
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    await user.click(screen.getByRole('switch', { name: 'Routes' }))
    expect(screen.getByRole('switch', { name: 'Routes' })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
  })

  it('toggles layer visibility when the visible label is clicked', async () => {
    const user = userEvent.setup()
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    await user.click(screen.getByText('Tracks'))
    expect(screen.getByRole('switch', { name: 'Tracks' })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.tracks).toBe(false)
  })

  it('updates the routes count when a route is added to the store after render', () => {
    const { rerender } = render(<LayerPanel promptDuplicate={stubPrompt} />)
    useRoutesStore.setState({
      routes: [fakeRoute('a')],
      loading: false,
      error: null,
    })
    rerender(<LayerPanel promptDuplicate={stubPrompt} />)
    const routesRow = screen.getByText('Routes').closest('[data-row]')
    expect(routesRow?.querySelector('[data-count]')).toHaveAttribute('data-count', '1')
  })
})
```

Run: `npm test -- src/panels/LayerPanel/LayerPanel.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 3.7.3: Run full test suite and typecheck**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: every suite green.

- [ ] **Step 3.7.4: Browser smoke test**

- Cold reload with no data → all counts read 0.
- Import 2 routes and 1 track → Routes shows 2, Tracks shows 1.
- Delete a route via the detail panel → Routes drops to 1.
- Drag-and-drop import a third route → Routes shows 2.

- [ ] **Step 3.7.5: Commit**

```bash
git add src/panels/LayerPanel/LayerPanel.tsx src/panels/LayerPanel/LayerPanel.test.tsx
git commit -m "feat(layers): live count badges in LayerPanel"
```

---

## Task 3.8 — Update TASKS.md and run final verification

**Files:**
- Modify: `TASKS.md`

- [ ] **Step 3.8.1: Mark Phase 3 tasks as complete in `TASKS.md`**

In the Progress section, replace:

```markdown
### Phase 3 — Routes and Tracks  ·  Plan: not yet written

- [ ] [3.1 GPX parser](#task-31---gpx-parser)
- [ ] [3.2 GPX import UI](#task-32---gpx-import-ui)
- [ ] [3.3 Routes layer](#task-33---routes-layer)
- [ ] [3.4 Tracks layer](#task-34---tracks-layer)
- [ ] [3.5 Route detail panel](#task-35---route-detail-panel)
- [ ] [3.6 Track detail panel](#task-36---track-detail-panel)
- [ ] [3.7 Layer panel counts](#task-37---layer-panel-counts)
```

with:

```markdown
### Phase 3 — Routes and Tracks  ·  Plan: [`2026-05-07-couloir-phase-3-routes-and-tracks.md`](docs/superpowers/plans/2026-05-07-couloir-phase-3-routes-and-tracks.md)

- [x] [3.1 GPX parser](#task-31---gpx-parser)
- [x] [3.2 GPX import UI](#task-32---gpx-import-ui)
- [x] [3.3 Routes layer](#task-33---routes-layer)
- [x] [3.4 Tracks layer](#task-34---tracks-layer)
- [x] [3.5 Route detail panel](#task-35---route-detail-panel)
- [x] [3.6 Track detail panel](#task-36---track-detail-panel)
- [x] [3.7 Layer panel counts](#task-37---layer-panel-counts)
```

(If executing this plan with subagent-driven development: tick each box only when the corresponding task above is done, not all at once.)

- [ ] **Step 3.8.2: Final verification**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm test`
Expected: all suites green.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3.8.3: End-to-end browser walkthrough**

Run `npm run dev` and walk through:

1. Cold start (clear OPFS via DevTools → Application → Storage → Clear site data) → welcome state, enter API key.
2. Import a real GPX route from a backcountry tool (Gaia, CalTopo, etc.). Verify rendering, click-to-detail, elevation profile renders.
3. Edit name + color + ATES + technical difficulty. Verify the line color changes immediately on save.
4. Import the same file again → duplicate prompt appears. Choose Replace. Verify edits to name/color/ATES/technical were preserved (per the `parsedToRoutePatch` contract).
5. Import the same file a third time and choose **Import as new copy**. Verify two routes exist.
6. Drop multiple GPX files at once on the map; tick "Apply to all" on the first duplicate prompt; verify the rest of the drop respects the choice.
7. Import a recorded track with timestamps. Verify Total > Moving in the detail panel.
8. Toggle Routes off, then Tracks off. Toggle each back on independently.
9. Switch basemap (Satellite → Outdoor → Winter). Verify lines persist across switches.
10. Switch the Maptiler API key (revoke and re-enter). Verify lines persist across the source rebind.
11. Delete a route and a track via their detail panels. Reload — both stay deleted.

- [ ] **Step 3.8.4: Commit the TASKS.md update**

```bash
git add TASKS.md
git commit -m "docs: link Phase 3 plan and mark Phase 3 tasks complete"
```

---

## Out-of-band notes for the executor

- **Test runner workaround:** if `npm test` hangs or errors with a Vitest "esbuild service" issue on Windows, run `npx vitest run --pool=forks --poolOptions.forks.singleFork=true` per `CLAUDE.md`. Do not modify `package.json`.
- **Git on Windows:** all `git` commands run via the PowerShell tool, not Bash. The 1Password agent that signs commits is wired into PowerShell.
- **Per-file test commands:** the steps above invoke `npm test -- <path>` for fast feedback. After each task's commit step, run a full `npm test` once to be sure the entire suite stays green.
- **No debug logging in commits:** if you add `debug(...)` calls during browser testing, remove them before commit, or set them to no-op via the `debug()` utility (gated by `localStorage.couloir_debug`).
- **No new dependencies beyond `recharts`:** the plan adds exactly one production dependency. `@types/geojson` is intentionally avoided (LineStringZ in `src/types/index.ts` is sufficient for our shape).

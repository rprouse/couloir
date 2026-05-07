# Couloir Phase 2 — Storage Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working storage layer for Couloir: SQLite running in OPFS via `wa-sqlite` + `OPFSCoopSyncVFS` inside a Web Worker, a `StorageProvider` interface implemented by both the production OPFS backend and an in-memory backend used by tests, full CRUD for routes/tracks/waypoints/photos/tags including OPFS blob storage for photo full-size and thumbnail JPEGs, an in-memory export/import shape, and Zustand store slices for every entity type that wire through the interface and load on app startup. The phase also extends the UI slice with the panel and placement state machines and adds the global ESC-key precedence hook.

**Architecture:** All entity reads/writes go through `StorageProvider` — feature code never touches SQLite directly. The OPFS implementation lives entirely inside a dedicated Web Worker (sync access handles only work cross-browser inside a Worker context); the main thread holds a thin postMessage RPC client. Schema is owned by versioned `.sql` files applied by an `ensureSchema()` migration runner that throws `SchemaVersionError` if the on-disk DB is newer than the build. Photo blobs and thumbnails are stored as OPFS files at `photos/{id}.jpg` and `photos/{id}_thumb.jpg`. The in-memory implementation uses plain JavaScript Maps and exists for unit tests of the Zustand layer; jsdom has no OPFS so the OPFS backend is verified manually in the browser per the TASKS.md acceptance criteria.

**Tech Stack:** wa-sqlite 1.0+ with `OPFSCoopSyncVFS`, dedicated Web Worker (raw `postMessage`, no Comlink), Vite worker imports (`?worker`) and `?url` for the wasm asset, Zustand for store slices, Vitest + React Testing Library for tests, ISO 8601 timestamps generated via `new Date().toISOString()` at write time.

**Spec references:** `SPEC.md` (data model overview), `ARCHITECTURE.md` (Storage Interface, VFS Choice and OPFS Caveats, State Management, Schema Migrations, Backup Format, Photo Storage Detail), `DATA-MODEL.md` (TypeScript types, SQLite schema, constants), `TASKS.md` Tasks 2.1–2.5.

**Out of scope for this phase:** GPX parsing/import (Phase 3), entity rendering on the map (Phase 3+), placement-mode UI behavior on the map cursor/banner (Phase 4–5 use the state machine added here, but the visual cursor + banner are wired in those phases), ZIP packaging and download (Phase 6.4 — the in-memory `exportAll`/`importAll` shape is built here, the file format isn't), tag management UI (Phase 6.1), tag filtering UI (Phase 6.2). All entity types now exist in `src/types/index.ts` (extended in this phase) but no map layers consume them yet.

---

## File Structure

```
couloir/
├── package.json                                      Task 2.1 (add wa-sqlite)
├── vite.config.ts                                    Task 2.1 (worker + wasm config)
├── src/
│   ├── main.tsx                                      Task 2.5 (init storage, fire loads)
│   ├── App.tsx                                       Task 2.5 (mount ESC hook)
│   ├── types/
│   │   └── index.ts                                  Tasks 2.1–2.4 (extend with all entity types + ExportBundle + WAYPOINT_CATEGORIES + EntityDraft)
│   ├── utils/
│   │   ├── id.ts                                     Task 2.1 (newId UUID helper, mockable in tests)
│   │   ├── id.test.ts                                Task 2.1
│   │   ├── time.ts                                   Task 2.5 (now() ISO 8601 helper)
│   │   └── time.test.ts                              Task 2.5
│   ├── storage/
│   │   ├── interface.ts                              Task 2.1 (StorageProvider, EntityType)
│   │   ├── errors.ts                                 Task 2.1 (SchemaVersionError)
│   │   ├── provider.ts                               Task 2.5 (DI: getStorage / setStorage)
│   │   ├── memory.ts                                 Tasks 2.1–2.4 (InMemoryStorageProvider — used by every Vitest test)
│   │   ├── memory.test.ts                            Tasks 2.2–2.4
│   │   ├── opfs.ts                                   Tasks 2.1–2.4 (OPFSStorageProvider main-thread shell)
│   │   ├── workerProtocol.ts                         Task 2.1 (Request/Response message types)
│   │   ├── workerClient.ts                           Task 2.1 (postMessage RPC wrapper)
│   │   ├── workerHost.ts                             Tasks 2.1–2.4 (Worker entry: wa-sqlite + OPFS)
│   │   └── migrations/
│   │       ├── 1.sql                                 Task 2.1 (initial schema, copy of DATA-MODEL.md)
│   │       └── index.ts                              Task 2.1 (MIGRATIONS list, SCHEMA_VERSION constant)
│   ├── store/
│   │   ├── routes.ts                                 Task 2.5
│   │   ├── routes.test.ts                            Task 2.5
│   │   ├── tracks.ts                                 Task 2.5
│   │   ├── tracks.test.ts                            Task 2.5
│   │   ├── waypoints.ts                              Task 2.5
│   │   ├── waypoints.test.ts                         Task 2.5
│   │   ├── photos.ts                                 Task 2.5
│   │   ├── photos.test.ts                            Task 2.5
│   │   ├── tags.ts                                   Task 2.5
│   │   ├── tags.test.ts                              Task 2.5
│   │   ├── ui.ts                                     Task 2.5 (extend with panel + placement state machines)
│   │   └── ui.test.ts                                Task 2.5 (add panel/placement coverage)
│   ├── hooks/
│   │   ├── useEscapeKey.ts                           Task 2.5
│   │   └── useEscapeKey.test.tsx                     Task 2.5
│   └── dev/
│       └── devConsole.ts                             Task 2.2 (window.__couloir helper, dev-only)
└── (no map layers, no panels, no GPX, no PWA — those land in Phase 3+)
```

**Test conventions** (carried forward from Phase 1):
- Test files live next to the implementation. Vitest globals (`describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`) are enabled — no per-file imports.
- All Zustand store tests reset both the slice state *and* the storage provider in `beforeEach`. Tests use `InMemoryStorageProvider` exclusively. The OPFS backend is never touched by Vitest.
- Component tests for the ESC hook use React Testing Library; storage tests are pure module tests.

---

## Task 2.1 — wa-sqlite setup

**Files:**
- Modify: `package.json` (add `wa-sqlite`)
- Modify: `vite.config.ts` (worker format, exclude `wa-sqlite` from optimizeDeps)
- Create: `src/types/index.ts` (extend — add all entity types + EntityType + ExportBundle + EntityTagRow + BackupManifest + WAYPOINT_CATEGORIES + ATES_LABELS + TECHNICAL_DIFFICULTY_LABELS + MOVING_SPEED_THRESHOLD_M_S + PHOTO_CLUSTER + ATES + TechnicalDifficulty + WaypointCategory + EntityDraft)
- Create: `src/storage/interface.ts`
- Create: `src/storage/errors.ts`
- Create: `src/storage/migrations/1.sql`
- Create: `src/storage/migrations/index.ts`
- Create: `src/storage/workerProtocol.ts`
- Create: `src/storage/workerClient.ts`
- Create: `src/storage/workerHost.ts`
- Create: `src/storage/opfs.ts`
- Create: `src/storage/memory.ts` (skeleton — only the constructor + init + close + a stubbed `getRoutes` returning `[]`; CRUD lands in 2.2–2.4)
- Create: `src/utils/id.ts`, `src/utils/id.test.ts`
- Create: `src/storage/wa-sqlite.d.ts` (ambient module declarations covering only what we use)

This task ends with: the schema migration runs cleanly in the browser against a fresh OPFS database, the in-memory provider exists with empty stubs, and `npm test` + `npm run typecheck` pass.

- [ ] **Step 2.1.1: Add `wa-sqlite` to dependencies**

Edit `package.json` `dependencies`:

```json
"dependencies": {
  "maplibre-gl": "^4.7.1",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "wa-sqlite": "^1.0.0",
  "zustand": "^4.5.5"
}
```

Run: `npm install`
Expected: completes; `node_modules/wa-sqlite/dist/wa-sqlite.mjs` and `wa-sqlite.wasm` exist.

- [ ] **Step 2.1.2: Update `vite.config.ts`**

`wa-sqlite` ships its wasm next to the ES module factory. Pre-bundling it via Vite breaks the relative wasm load, and we want the wasm asset emitted into the build output unmodified. We also use `?worker` imports for the storage worker and need the worker to use the `es` format.

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['wa-sqlite'],
  },
})
```

- [ ] **Step 2.1.3: Write `src/storage/wa-sqlite.d.ts`** (ambient declarations — `wa-sqlite` ships no `.d.ts` in the npm bundle)

```typescript
// Minimal ambient module declarations for the wa-sqlite surface we use.
// We only declare what the worker actually calls; expand on demand.

declare module 'wa-sqlite/dist/wa-sqlite.mjs' {
  type Module = unknown
  type FactoryOptions = { locateFile?: (path: string) => string }
  const factory: (opts?: FactoryOptions) => Promise<Module>
  export default factory
}

declare module 'wa-sqlite' {
  export const SQLITE_ROW: number
  export const SQLITE_DONE: number
  export const SQLITE_OK: number

  type Pointer = number
  type SQLValue = string | number | bigint | Uint8Array | null

  interface Statement {
    readonly _stmt: Pointer
  }

  export interface SQLiteAPI {
    open_v2(filename: string): Promise<Pointer>
    close(db: Pointer): Promise<number>
    exec(
      db: Pointer,
      sql: string,
      callback?: (row: SQLValue[], columns: string[]) => void,
    ): Promise<number>
    statements(db: Pointer, sql: string): AsyncIterable<Statement>
    bind_collection(stmt: Statement, values: SQLValue[] | Record<string, SQLValue>): number
    step(stmt: Statement): Promise<number>
    reset(stmt: Statement): Promise<number>
    column_names(stmt: Statement): string[]
    row(stmt: Statement): SQLValue[]
    vfs_register(vfs: unknown, makeDefault?: boolean): number
  }

  export function Factory(module: unknown): SQLiteAPI
}

declare module 'wa-sqlite/src/examples/OPFSCoopSyncVFS.js' {
  export class OPFSCoopSyncVFS {
    static create(name: string, module: unknown): Promise<OPFSCoopSyncVFS>
  }
}

declare module 'wa-sqlite/dist/wa-sqlite.wasm?url' {
  const url: string
  export default url
}
```

- [ ] **Step 2.1.4: Extend `src/types/index.ts`** with the full data model

Replace the existing file. The Phase 1 `Basemap` and `MAP_DEFAULTS` exports are preserved.

```typescript
// ============================================================================
// Domain types — canonical shapes for every Couloir entity.
// SQLite schema in src/storage/migrations/1.sql is derived from these types.
// ============================================================================

export type EntityType = 'route' | 'track' | 'waypoint' | 'photo'

export type ATES = 'simple' | 'challenging' | 'complex' | 'extreme'

export type TechnicalDifficulty = 'easy' | 'moderate' | 'hard' | 'expert'

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

// GeoJSON LineString with [lng, lat, elevation_m] tuples. We don't pull in
// @types/geojson because we only need this one shape and the standard type
// allows 2D coordinates which we want to forbid by convention here.
export interface LineStringZ {
  type: 'LineString'
  coordinates: Array<[number, number, number]>
}

export interface Tag {
  id: string           // uuid
  name: string
  color: string        // hex '#RRGGBB'
  created_at: string   // ISO 8601
}

export interface Route {
  id: string
  user_id: string
  name: string
  description: string
  geojson: LineStringZ
  source_hash: string
  source_filename: string | null
  color: string
  ates: ATES | null
  technical_difficulty: TechnicalDifficulty | null
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Track {
  id: string
  user_id: string
  name: string
  description: string
  geojson: LineStringZ
  source_hash: string
  source_filename: string | null
  color: string
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  duration_s: number | null
  moving_time_s: number | null
  recorded_at: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Waypoint {
  id: string
  user_id: string
  name: string
  description: string
  lat: number
  lng: number
  elevation_m: number | null
  category: WaypointCategory
  color: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  user_id: string
  name: string
  description: string

  // Subject location (user-placed)
  lat: number
  lng: number
  elevation_m: number | null

  // Camera (capture) metadata
  camera_lat: number | null
  camera_lng: number | null
  camera_elevation_m: number | null
  bearing: number | null

  blob_ref: string                      // 'photos/{id}.jpg'
  width: number
  height: number
  file_size_bytes: number
  taken_at: string | null

  tags: string[]
  created_at: string
  updated_at: string
}

// ============================================================================
// Backup bundle — written as `metadata.json` inside the ZIP archive (Phase 6).
// The Phase 2 storage layer returns this in-memory shape from `exportAll()`.
// ============================================================================

export interface ExportBundle {
  bundle_version: number
  app_version: string
  exported_at: string
  routes: Route[]
  tracks: Track[]
  waypoints: Waypoint[]
  photos: Photo[]
  tags: Tag[]
  entity_tags: EntityTagRow[]
}

export interface EntityTagRow {
  entity_type: EntityType
  entity_id: string
  tag_id: string
}

export interface BackupManifest {
  bundle_version: number
  app_version: string
  exported_at: string
  photo_count: number
  total_size_bytes: number
}

// ============================================================================
// Panel / placement state machine drafts.
// EntityDraft is intentionally permissive — Phase 2 only needs a placeholder
// for the create/edit forms that arrive in Phases 3–5.
// ============================================================================

export type EntityDraft =
  | Partial<Omit<Route, 'id' | 'created_at'>>
  | Partial<Omit<Track, 'id' | 'created_at'>>
  | Partial<Omit<Waypoint, 'id' | 'created_at'>>
  | Partial<Omit<Photo, 'id' | 'created_at'>>

// ============================================================================
// Constants
// ============================================================================

export const DEFAULTS = {
  route: { color: '#E05C2A' },
  track: { color: '#2A7BE0' },
} as const

export const WAYPOINT_CATEGORIES: Record<WaypointCategory, {
  label: string
  color: string
  icon: string
}> = {
  entry_gate:  { label: 'Entry Gate',        color: '#22C55E', icon: 'gate' },
  cliff_band:  { label: 'Cliff Band',        color: '#EF4444', icon: 'warning' },
  rollover:    { label: 'Rollover',          color: '#F59E0B', icon: 'arrow-down' },
  hazard:      { label: 'Hazard',            color: '#EF4444', icon: 'hazard' },
  skin_track:  { label: 'Skin Track',        color: '#A78BFA', icon: 'track' },
  cache:       { label: 'Cache',             color: '#60A5FA', icon: 'cache' },
  summit:      { label: 'Summit',            color: '#FBBF24', icon: 'summit' },
  poi:         { label: 'Point of Interest', color: '#94A3B8', icon: 'poi' },
  other:       { label: 'Other',             color: '#94A3B8', icon: 'pin' },
}

export const ATES_LABELS: Record<ATES, string> = {
  simple:      'Simple (Class 1)',
  challenging: 'Challenging (Class 2)',
  complex:     'Complex (Class 3)',
  extreme:     'Extreme (Class 4)',
}

export const TECHNICAL_DIFFICULTY_LABELS: Record<TechnicalDifficulty, string> = {
  easy:     'Easy',
  moderate: 'Moderate',
  hard:     'Hard',
  expert:   'Expert',
}

// 0.14 m/s ≈ 0.5 km/h. Tuned for backcountry skinning. See DATA-MODEL.md.
export const MOVING_SPEED_THRESHOLD_M_S = 0.14

export const PHOTO_CLUSTER = {
  clusterMaxZoom: 13,
  clusterRadius: 50,
} as const

// ============================================================================
// Map types/constants — preserved from Phase 1
// ============================================================================

export type Basemap = 'satellite' | 'outdoor' | 'winter'

export const MAP_DEFAULTS = {
  center: [-116.0, 49.5] as [number, number],
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  // Default basemap lives in the UI store's initial state — see notes in
  // src/store/ui.ts. Don't reintroduce it here.
} as const

export const APP_VERSION = '0.0.1'
```

- [ ] **Step 2.1.5: Write `src/storage/errors.ts`**

```typescript
export class SchemaVersionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaVersionError'
  }
}

export class StorageNotInitializedError extends Error {
  constructor() {
    super('Storage provider has not been initialized. Call init() first.')
    this.name = 'StorageNotInitializedError'
  }
}
```

- [ ] **Step 2.1.6: Write `src/storage/interface.ts`**

```typescript
import type {
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'

export interface StorageProvider {
  /** Open the database, run pending migrations, and prepare for use. */
  init(): Promise<void>

  /** Release resources. Idempotent. */
  close(): Promise<void>

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
  getPhotoBlob(id: string): Promise<Blob | null>
  getPhotoThumb(id: string): Promise<Blob | null>
  deletePhoto(id: string): Promise<void>

  // Tags
  getTags(): Promise<Tag[]>
  saveTag(tag: Tag): Promise<void>
  deleteTag(id: string): Promise<void>
  setEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): Promise<void>

  // Backup (in-memory shape; ZIP packaging lives in Phase 6.4)
  exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }>
  importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void>
}
```

- [ ] **Step 2.1.7: Write `src/storage/migrations/1.sql`** (verbatim copy of the schema in `DATA-MODEL.md`)

```sql
-- src/storage/migrations/1.sql
-- Initial schema. Forward-compatible with Postgres when cloud sync arrives.
-- Avoid SQLite-specific column types; use plain TEXT/REAL/INTEGER.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#888888',
  created_at  TEXT NOT NULL
);

CREATE TABLE routes (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL DEFAULT 'local',
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  geojson               TEXT NOT NULL,
  source_hash           TEXT NOT NULL,
  source_filename       TEXT,
  color                 TEXT NOT NULL DEFAULT '#E05C2A',
  ates                  TEXT,
  technical_difficulty  TEXT,
  distance_m            REAL NOT NULL DEFAULT 0,
  elevation_gain_m      REAL NOT NULL DEFAULT 0,
  elevation_loss_m      REAL NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);

CREATE TABLE tracks (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL DEFAULT 'local',
  name              TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  geojson           TEXT NOT NULL,
  source_hash       TEXT NOT NULL,
  source_filename   TEXT,
  color             TEXT NOT NULL DEFAULT '#2A7BE0',
  distance_m        REAL NOT NULL DEFAULT 0,
  elevation_gain_m  REAL NOT NULL DEFAULT 0,
  elevation_loss_m  REAL NOT NULL DEFAULT 0,
  duration_s        REAL,
  moving_time_s     REAL,
  recorded_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE waypoints (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL DEFAULT 'local',
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  elevation_m   REAL,
  category      TEXT NOT NULL DEFAULT 'poi',
  color         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE photos (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL DEFAULT 'local',
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  lat                 REAL NOT NULL,
  lng                 REAL NOT NULL,
  elevation_m         REAL,
  camera_lat          REAL,
  camera_lng          REAL,
  camera_elevation_m  REAL,
  bearing             REAL,
  blob_ref            TEXT NOT NULL,
  width               INTEGER NOT NULL,
  height              INTEGER NOT NULL,
  file_size_bytes     INTEGER NOT NULL,
  taken_at            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE entity_tags (
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  tag_id       TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_type, entity_id, tag_id)
);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag_id);
```

- [ ] **Step 2.1.8: Write `src/storage/migrations/index.ts`**

Vite's `?raw` import suffix loads `.sql` files as plain text strings.

```typescript
import sql1 from './1.sql?raw'

export const SCHEMA_VERSION = 1

export interface Migration {
  version: number
  sql: string
}

export const MIGRATIONS: readonly Migration[] = [
  { version: 1, sql: sql1 },
]
```

- [ ] **Step 2.1.9: Write `src/utils/id.ts`**

```typescript
// Thin wrapper around crypto.randomUUID(). Centralized so tests can mock it
// for deterministic IDs and so we have one place to swap implementations
// (e.g. crypto.subtle when targeting older Safari) if needed.
export function newId(): string {
  return crypto.randomUUID()
}
```

- [ ] **Step 2.1.10: Write the failing test `src/utils/id.test.ts`**

```typescript
import { newId } from './id'

describe('newId', () => {
  it('returns a UUID-shaped string', () => {
    const id = newId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('returns a unique value on each call', () => {
    const a = newId()
    const b = newId()
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2.1.11: Run the test, verify it passes**

Run: `npm test src/utils/id.test.ts`
Expected: 2 tests passing.

- [ ] **Step 2.1.12: Write `src/storage/workerProtocol.ts`**

The protocol intentionally exposes a small set of operations: pre-canned SQL is sent down with parameter arrays, and blob ops are explicit. There is no "open arbitrary SQL connection" surface — the worker is the gatekeeper.

```typescript
// Wire protocol between the main-thread storage client and the OPFS worker.
// All requests carry a numeric `id`; the worker echoes it on the response so
// the client can match against an in-flight promise.

export type SqlValue = string | number | bigint | null | Uint8Array

export interface SqlOp {
  sql: string
  params?: SqlValue[]
}

export type Request =
  | { id: number; type: 'init' }
  | { id: number; type: 'close' }
  | { id: number; type: 'all'; sql: string; params?: SqlValue[] }
  | { id: number; type: 'one'; sql: string; params?: SqlValue[] }
  | { id: number; type: 'run'; sql: string; params?: SqlValue[] }
  | { id: number; type: 'tx'; ops: SqlOp[] }
  | { id: number; type: 'writeBlob'; path: string; data: ArrayBuffer }
  | { id: number; type: 'readBlob'; path: string }
  | { id: number; type: 'deleteBlob'; path: string }

export interface SqlRow {
  [column: string]: SqlValue
}

export type Response =
  | { id: number; ok: true; result: SqlRow[] | SqlRow | null | ArrayBuffer | undefined }
  | { id: number; ok: false; error: string }
```

- [ ] **Step 2.1.13: Write `src/storage/workerClient.ts`**

```typescript
import type {
  Request,
  Response,
  SqlOp,
  SqlRow,
  SqlValue,
} from './workerProtocol'

// One in-flight RPC per request id. The client posts a Request and resolves
// the corresponding promise when a Response with the matching id arrives.
export class WorkerClient {
  private nextId = 1
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >()

  constructor(private worker: Worker) {
    this.worker.addEventListener('message', this.onMessage)
  }

  private onMessage = (event: MessageEvent<Response>): void => {
    const msg = event.data
    const slot = this.pending.get(msg.id)
    if (!slot) return
    this.pending.delete(msg.id)
    if (msg.ok) slot.resolve(msg.result)
    else slot.reject(new Error(msg.error))
  }

  private send<T>(req: Omit<Request, 'id'>, transfer: Transferable[] = []): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      })
      this.worker.postMessage({ ...req, id } as Request, transfer)
    })
  }

  init(): Promise<void> {
    return this.send<void>({ type: 'init' })
  }

  close(): Promise<void> {
    return this.send<void>({ type: 'close' })
  }

  all(sql: string, params?: SqlValue[]): Promise<SqlRow[]> {
    return this.send<SqlRow[]>({ type: 'all', sql, params })
  }

  one(sql: string, params?: SqlValue[]): Promise<SqlRow | null> {
    return this.send<SqlRow | null>({ type: 'one', sql, params })
  }

  run(sql: string, params?: SqlValue[]): Promise<void> {
    return this.send<void>({ type: 'run', sql, params })
  }

  tx(ops: SqlOp[]): Promise<void> {
    return this.send<void>({ type: 'tx', ops })
  }

  writeBlob(path: string, data: ArrayBuffer): Promise<void> {
    // Transfer ownership of the buffer — we don't need it on the main thread
    // after the post.
    return this.send<void>({ type: 'writeBlob', path, data }, [data])
  }

  readBlob(path: string): Promise<ArrayBuffer | null> {
    return this.send<ArrayBuffer | null>({ type: 'readBlob', path })
  }

  deleteBlob(path: string): Promise<void> {
    return this.send<void>({ type: 'deleteBlob', path })
  }

  terminate(): void {
    this.worker.terminate()
  }
}
```

- [ ] **Step 2.1.14: Write `src/storage/workerHost.ts`** — the worker entry

```typescript
/// <reference lib="webworker" />

import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite'
import { OPFSCoopSyncVFS } from 'wa-sqlite/src/examples/OPFSCoopSyncVFS.js'
import wasmUrl from 'wa-sqlite/dist/wa-sqlite.wasm?url'
import { MIGRATIONS, SCHEMA_VERSION } from './migrations'
import type {
  Request,
  Response,
  SqlOp,
  SqlRow,
  SqlValue,
} from './workerProtocol'

const DB_FILENAME = 'couloir.db'
const PHOTOS_DIR = 'photos'

let sqlite3: SQLite.SQLiteAPI | null = null
let dbHandle: number | null = null

async function init(): Promise<void> {
  if (sqlite3 !== null) return
  // `locateFile` redirects the wasm fetch to the URL emitted by Vite — without
  // this, the factory looks for `wa-sqlite.wasm` next to the .mjs which fails
  // when the module is bundled and served from a hashed path.
  const module = await SQLiteESMFactory({ locateFile: () => wasmUrl })
  const api = SQLite.Factory(module)
  const vfs = await OPFSCoopSyncVFS.create('opfs-vfs', module)
  api.vfs_register(vfs, true)
  const handle = await api.open_v2(DB_FILENAME)
  sqlite3 = api
  dbHandle = handle
  await ensureSchema()
}

async function close(): Promise<void> {
  if (sqlite3 && dbHandle !== null) await sqlite3.close(dbHandle)
  sqlite3 = null
  dbHandle = null
}

function api(): SQLite.SQLiteAPI {
  if (!sqlite3 || dbHandle === null) throw new Error('worker: not initialized')
  return sqlite3
}

function db(): number {
  if (dbHandle === null) throw new Error('worker: not initialized')
  return dbHandle
}

// ---- SQL helpers -----------------------------------------------------------

async function exec(sql: string): Promise<void> {
  await api().exec(db(), sql)
}

async function all(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
  const rows: SqlRow[] = []
  for await (const stmt of api().statements(db(), sql)) {
    if (params.length > 0) api().bind_collection(stmt, params)
    while ((await api().step(stmt)) === SQLite.SQLITE_ROW) {
      const cols = api().column_names(stmt)
      const values = api().row(stmt)
      const row: SqlRow = {}
      for (let i = 0; i < cols.length; i++) row[cols[i]] = values[i]
      rows.push(row)
    }
  }
  return rows
}

async function one(sql: string, params: SqlValue[] = []): Promise<SqlRow | null> {
  const rows = await all(sql, params)
  return rows[0] ?? null
}

async function run(sql: string, params: SqlValue[] = []): Promise<void> {
  for await (const stmt of api().statements(db(), sql)) {
    if (params.length > 0) api().bind_collection(stmt, params)
    while ((await api().step(stmt)) === SQLite.SQLITE_ROW) {
      // discard rows
    }
  }
}

async function tx(ops: SqlOp[]): Promise<void> {
  await exec('BEGIN')
  try {
    for (const op of ops) await run(op.sql, op.params ?? [])
    await exec('COMMIT')
  } catch (err) {
    await exec('ROLLBACK')
    throw err
  }
}

// ---- Schema migration ------------------------------------------------------

async function ensureSchema(): Promise<void> {
  // schema_version table may not exist yet on a fresh DB; check via sqlite_master.
  const meta = await one(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'`,
  )
  let current = 0
  if (meta) {
    const row = await one(`SELECT version FROM schema_version LIMIT 1`)
    if (row && typeof row.version === 'number') current = row.version
  }

  if (current === SCHEMA_VERSION) return
  if (current > SCHEMA_VERSION) {
    throw new Error(
      `SchemaVersionError: Database is v${current}; this build expects ` +
      `v${SCHEMA_VERSION}. Refresh or downgrade the app.`,
    )
  }

  for (const m of MIGRATIONS) {
    if (m.version <= current) continue
    await exec('BEGIN')
    try {
      // Migration files contain multi-statement SQL; exec() handles that.
      await api().exec(db(), m.sql)
      await run(
        `INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)`,
        [m.version, new Date().toISOString()],
      )
      await exec('COMMIT')
    } catch (err) {
      await exec('ROLLBACK')
      throw err
    }
  }
}

// ---- OPFS blob ops ---------------------------------------------------------

async function getPhotosDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory()
  return await root.getDirectoryHandle(PHOTOS_DIR, { create: true })
}

function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

async function writeBlob(path: string, data: ArrayBuffer): Promise<void> {
  const dir = await getPhotosDir()
  const file = await dir.getFileHandle(basename(path), { create: true })
  const writable = await file.createWritable()
  await writable.write(data)
  await writable.close()
}

async function readBlob(path: string): Promise<ArrayBuffer | null> {
  try {
    const dir = await getPhotosDir()
    const file = await dir.getFileHandle(basename(path), { create: false })
    const f = await file.getFile()
    return await f.arrayBuffer()
  } catch {
    return null
  }
}

async function deleteBlob(path: string): Promise<void> {
  try {
    const dir = await getPhotosDir()
    await dir.removeEntry(basename(path))
  } catch {
    // missing file is not an error
  }
}

// ---- Message dispatch ------------------------------------------------------

const scope = self as unknown as DedicatedWorkerGlobalScope

scope.addEventListener('message', async (event: MessageEvent<Request>) => {
  const req = event.data
  try {
    let result: unknown = undefined
    switch (req.type) {
      case 'init':       await init();                              break
      case 'close':      await close();                             break
      case 'all':        result = await all(req.sql, req.params);   break
      case 'one':        result = await one(req.sql, req.params);   break
      case 'run':        await run(req.sql, req.params);            break
      case 'tx':         await tx(req.ops);                         break
      case 'writeBlob':  await writeBlob(req.path, req.data);       break
      case 'readBlob':   result = await readBlob(req.path);         break
      case 'deleteBlob': await deleteBlob(req.path);                break
    }
    const response = { id: req.id, ok: true, result } as Response
    // Transfer ArrayBuffer results to avoid a structured-clone copy.
    const transfer: Transferable[] = result instanceof ArrayBuffer ? [result] : []
    scope.postMessage(response, transfer)
  } catch (err) {
    const response: Response = { id: req.id, ok: false, error: String(err) }
    scope.postMessage(response)
  }
})
```

- [ ] **Step 2.1.15: Write `src/storage/opfs.ts`** (main-thread shell — only `init`/`close` for this task; CRUD methods are stubbed and land in 2.2–2.4)

```typescript
import type {
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import type { StorageProvider } from './interface'
import { WorkerClient } from './workerClient'
import StorageWorker from './workerHost?worker'

export class OPFSStorageProvider implements StorageProvider {
  private client: WorkerClient

  constructor() {
    this.client = new WorkerClient(new StorageWorker())
  }

  async init(): Promise<void> {
    await this.client.init()
  }

  async close(): Promise<void> {
    await this.client.close()
    this.client.terminate()
  }

  // --- Routes ---------------------------------------------------------------
  // Implemented in Task 2.2.
  getRoutes(): Promise<Route[]> { throw new Error('not implemented') }
  getRoute(_id: string): Promise<Route | null> { throw new Error('not implemented') }
  saveRoute(_route: Route): Promise<void> { throw new Error('not implemented') }
  deleteRoute(_id: string): Promise<void> { throw new Error('not implemented') }
  getRouteBySourceHash(_h: string): Promise<Route | null> { throw new Error('not implemented') }

  // --- Tracks ---------------------------------------------------------------
  getTracks(): Promise<Track[]> { throw new Error('not implemented') }
  getTrack(_id: string): Promise<Track | null> { throw new Error('not implemented') }
  saveTrack(_track: Track): Promise<void> { throw new Error('not implemented') }
  deleteTrack(_id: string): Promise<void> { throw new Error('not implemented') }
  getTrackBySourceHash(_h: string): Promise<Track | null> { throw new Error('not implemented') }

  // --- Waypoints ------------------------------------------------------------
  getWaypoints(): Promise<Waypoint[]> { throw new Error('not implemented') }
  getWaypoint(_id: string): Promise<Waypoint | null> { throw new Error('not implemented') }
  saveWaypoint(_w: Waypoint): Promise<void> { throw new Error('not implemented') }
  deleteWaypoint(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Photos ---------------------------------------------------------------
  getPhotos(): Promise<Photo[]> { throw new Error('not implemented') }
  getPhoto(_id: string): Promise<Photo | null> { throw new Error('not implemented') }
  savePhoto(_p: Photo, _b: Blob, _t: Blob): Promise<void> { throw new Error('not implemented') }
  getPhotoBlob(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  getPhotoThumb(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  deletePhoto(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Tags -----------------------------------------------------------------
  getTags(): Promise<Tag[]> { throw new Error('not implemented') }
  saveTag(_t: Tag): Promise<void> { throw new Error('not implemented') }
  deleteTag(_id: string): Promise<void> { throw new Error('not implemented') }
  setEntityTags(_t: EntityType, _id: string, _ids: string[]): Promise<void> {
    throw new Error('not implemented')
  }

  // --- Backup ---------------------------------------------------------------
  exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    throw new Error('not implemented')
  }
  importAll(
    _b: ExportBundle,
    _p: Map<string, Blob>,
    _t: Map<string, Blob>,
  ): Promise<void> {
    throw new Error('not implemented')
  }
}
```

- [ ] **Step 2.1.16: Write `src/storage/memory.ts`** (skeleton — only init/close + stubbed CRUD; full impls land in 2.2–2.4)

```typescript
import type {
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import type { StorageProvider } from './interface'

// In-memory reference implementation of StorageProvider. Used by every
// Vitest test (jsdom has no OPFS) and by any future automated environment
// that doesn't have a browser. Never used in production.
export class InMemoryStorageProvider implements StorageProvider {
  private routes = new Map<string, Route>()
  private tracks = new Map<string, Track>()
  private waypoints = new Map<string, Waypoint>()
  private photos = new Map<string, Photo>()
  private tags = new Map<string, Tag>()
  private entityTags = new Set<string>() // 'route|abc|tag1' style composite keys
  private blobs = new Map<string, Blob>()
  private thumbs = new Map<string, Blob>()

  async init(): Promise<void> {
    // No-op; in-memory state is ready on construction.
  }

  async close(): Promise<void> {
    // No-op.
  }

  // --- Routes (Task 2.2) ----------------------------------------------------
  async getRoutes(): Promise<Route[]> { throw new Error('not implemented') }
  async getRoute(_id: string): Promise<Route | null> { throw new Error('not implemented') }
  async saveRoute(_route: Route): Promise<void> { throw new Error('not implemented') }
  async deleteRoute(_id: string): Promise<void> { throw new Error('not implemented') }
  async getRouteBySourceHash(_h: string): Promise<Route | null> { throw new Error('not implemented') }

  // --- Tracks (Task 2.2) ----------------------------------------------------
  async getTracks(): Promise<Track[]> { throw new Error('not implemented') }
  async getTrack(_id: string): Promise<Track | null> { throw new Error('not implemented') }
  async saveTrack(_track: Track): Promise<void> { throw new Error('not implemented') }
  async deleteTrack(_id: string): Promise<void> { throw new Error('not implemented') }
  async getTrackBySourceHash(_h: string): Promise<Track | null> { throw new Error('not implemented') }

  // --- Waypoints (Task 2.3) -------------------------------------------------
  async getWaypoints(): Promise<Waypoint[]> { throw new Error('not implemented') }
  async getWaypoint(_id: string): Promise<Waypoint | null> { throw new Error('not implemented') }
  async saveWaypoint(_w: Waypoint): Promise<void> { throw new Error('not implemented') }
  async deleteWaypoint(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Photos (Task 2.3) ----------------------------------------------------
  async getPhotos(): Promise<Photo[]> { throw new Error('not implemented') }
  async getPhoto(_id: string): Promise<Photo | null> { throw new Error('not implemented') }
  async savePhoto(_p: Photo, _b: Blob, _t: Blob): Promise<void> { throw new Error('not implemented') }
  async getPhotoBlob(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  async getPhotoThumb(_id: string): Promise<Blob | null> { throw new Error('not implemented') }
  async deletePhoto(_id: string): Promise<void> { throw new Error('not implemented') }

  // --- Tags (Task 2.4) ------------------------------------------------------
  async getTags(): Promise<Tag[]> { throw new Error('not implemented') }
  async saveTag(_t: Tag): Promise<void> { throw new Error('not implemented') }
  async deleteTag(_id: string): Promise<void> { throw new Error('not implemented') }
  async setEntityTags(_t: EntityType, _id: string, _ids: string[]): Promise<void> {
    throw new Error('not implemented')
  }

  // --- Backup (Task 2.4) ----------------------------------------------------
  async exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    throw new Error('not implemented')
  }
  async importAll(
    _b: ExportBundle,
    _p: Map<string, Blob>,
    _t: Map<string, Blob>,
  ): Promise<void> {
    throw new Error('not implemented')
  }
}
```

- [ ] **Step 2.1.17: Run typecheck**

Run: `npm run typecheck`
Expected: completes with no errors. (TypeScript is happy with the stubbed methods because each `throw` produces `never`, which is assignable to every return type.)

- [ ] **Step 2.1.18: Run the full test suite**

Run: `npm test`
Expected: all existing Phase 1 tests still pass; the new `id.test.ts` passes too.

- [ ] **Step 2.1.19: Browser smoke test — schema migration runs**

Add a temporary block to `src/main.tsx` (will be removed in Task 2.5 when the proper init lands):

```typescript
import { OPFSStorageProvider } from './storage/opfs'

const storage = new OPFSStorageProvider()
await storage.init()
console.log('[couloir] storage initialized')
```

Run: `npm run dev`
Open http://localhost:5173 in Chrome. Open DevTools → Application → Storage → Origin Private File System. Expected: a file named `couloir.db` appears in the origin storage. Console shows `[couloir] storage initialized`. Reload the page; the file persists and the same log appears.

In DevTools console run:
```javascript
indexedDB.databases() // sanity — wa-sqlite uses OPFS, not IDB; should not show couloir
```

Open DevTools → Application → Storage → Origin Private File System. Right-click `couloir.db` → there should be no errors about access handles being held by another tab.

Open the same URL in a second tab. Expected: the second tab logs an error about failing to acquire the access handle (this is the documented `OPFSCoopSyncVFS` single-tab limitation per `ARCHITECTURE.md` "VFS Choice and OPFS Caveats"). Close the second tab.

- [ ] **Step 2.1.20: Browser verification — schema_version row**

In the Console of the first (working) tab, paste:

```javascript
// Quick peek — uses our own provider's worker client.
const { OPFSStorageProvider } = await import('/src/storage/opfs.ts')
const s = new OPFSStorageProvider()
await s.init()
// Reach into the worker via the same RPC the provider uses:
const row = await s['client'].one('SELECT version, applied_at FROM schema_version')
console.log(row)
```

Expected: `{ version: 1, applied_at: '<ISO timestamp>' }`. Reload — the same row is returned (migration did not re-run).

- [ ] **Step 2.1.21: Browser verification — newer-DB rejection**

In the Console:

```javascript
const { OPFSStorageProvider } = await import('/src/storage/opfs.ts')
const s = new OPFSStorageProvider()
await s.init()
await s['client'].run('UPDATE schema_version SET version = 2')
```

Reload the page. Expected: console shows the worker rejecting `init` with a `SchemaVersionError: Database is v2; this build expects v1` message.

Recover by running in console:

```javascript
const { OPFSStorageProvider } = await import('/src/storage/opfs.ts')
const s = new OPFSStorageProvider()
// Note: this will fail since init() throws; instead delete the OPFS file:
const root = await navigator.storage.getDirectory()
await root.removeEntry('couloir.db')
```

Reload — schema is recreated cleanly at version 1.

- [ ] **Step 2.1.22: Remove the smoke-test block from `src/main.tsx`**

Restore `src/main.tsx` to the Phase 1 state (no storage init — that lands properly in Task 2.5).

- [ ] **Step 2.1.23: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/types/index.ts src/utils/id.ts src/utils/id.test.ts src/storage/
git commit -m "$(cat <<'EOF'
feat(storage): wa-sqlite + OPFS worker scaffolding with schema migrations

Adds the StorageProvider interface, the in-memory reference implementation
(stubbed; CRUD lands in 2.2–2.4), and the OPFS-backed provider that hosts
wa-sqlite inside a dedicated Web Worker with the OPFSCoopSyncVFS backend.
Schema is owned by versioned .sql files applied by ensureSchema(); a DB
newer than the build's SCHEMA_VERSION is rejected. Extends src/types/index.ts
with the full Couloir data model (Route/Track/Waypoint/Photo/Tag, ExportBundle,
constants).
EOF
)"
```

---

## Task 2.2 — Route and track CRUD

**Files:**
- Modify: `src/storage/memory.ts` (implement route + track methods)
- Modify: `src/storage/opfs.ts` (implement route + track methods, add SQL helpers)
- Create: `src/storage/memory.test.ts` (cover the in-memory implementation's route + track behavior)
- Create: `src/dev/devConsole.ts` (window.__couloir helper, dev-only)
- Modify: `src/main.tsx` (install the dev console in dev mode)

`saveRoute(route)` and `saveTrack(track)` write the entity row **and** overwrite the `entity_tags` rows for that entity (same transaction in OPFS). The Zustand layer (Task 2.5) calls `saveRoute(route)` with `route.tags` populated and trusts the storage to persist both. `setEntityTags` remains on the interface for callers who want to change tags only — Phase 6.1 uses it.

- [ ] **Step 2.2.1: Add internal helpers and route methods to `src/storage/memory.ts`**

Keep the existing class shell and replace the route stubs. Add the helpers as private methods.

```typescript
// At the top of the InMemoryStorageProvider class, replace the route stubs:

  // --- Routes ---------------------------------------------------------------
  async getRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values())
      .map(r => this.hydrateTags(r, 'route'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getRoute(id: string): Promise<Route | null> {
    const r = this.routes.get(id)
    return r ? this.hydrateTags(r, 'route') : null
  }
  async saveRoute(route: Route): Promise<void> {
    // Store a deep-enough copy so callers mutating their input don't corrupt
    // our state. JSON round-trip is fine — no Date or Blob fields on Route.
    this.routes.set(route.id, JSON.parse(JSON.stringify(route)) as Route)
    this.replaceEntityTags('route', route.id, route.tags)
  }
  async deleteRoute(id: string): Promise<void> {
    this.routes.delete(id)
    this.removeAllTagsFor('route', id)
  }
  async getRouteBySourceHash(hash: string): Promise<Route | null> {
    for (const r of this.routes.values()) {
      if (r.source_hash === hash) return this.hydrateTags(r, 'route')
    }
    return null
  }
```

Add the private helpers (place them at the bottom of the class):

```typescript
  // --- Tag helpers ----------------------------------------------------------

  private tagKey(entityType: EntityType, entityId: string, tagId: string): string {
    return `${entityType}|${entityId}|${tagId}`
  }

  private hydrateTags<T extends { id: string; tags: string[] }>(
    entity: T,
    entityType: EntityType,
  ): T {
    const tags: string[] = []
    const prefix = `${entityType}|${entity.id}|`
    for (const key of this.entityTags) {
      if (key.startsWith(prefix)) tags.push(key.slice(prefix.length))
    }
    tags.sort()
    return { ...entity, tags }
  }

  private replaceEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): void {
    this.removeAllTagsFor(entityType, entityId)
    for (const tagId of tagIds) {
      this.entityTags.add(this.tagKey(entityType, entityId, tagId))
    }
  }

  private removeAllTagsFor(entityType: EntityType, entityId: string): void {
    const prefix = `${entityType}|${entityId}|`
    for (const key of Array.from(this.entityTags)) {
      if (key.startsWith(prefix)) this.entityTags.delete(key)
    }
  }
```

- [ ] **Step 2.2.2: Replace track stubs in `src/storage/memory.ts`** with the same pattern as routes

```typescript
  // --- Tracks ---------------------------------------------------------------
  async getTracks(): Promise<Track[]> {
    return Array.from(this.tracks.values())
      .map(t => this.hydrateTags(t, 'track'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getTrack(id: string): Promise<Track | null> {
    const t = this.tracks.get(id)
    return t ? this.hydrateTags(t, 'track') : null
  }
  async saveTrack(track: Track): Promise<void> {
    this.tracks.set(track.id, JSON.parse(JSON.stringify(track)) as Track)
    this.replaceEntityTags('track', track.id, track.tags)
  }
  async deleteTrack(id: string): Promise<void> {
    this.tracks.delete(id)
    this.removeAllTagsFor('track', id)
  }
  async getTrackBySourceHash(hash: string): Promise<Track | null> {
    for (const t of this.tracks.values()) {
      if (t.source_hash === hash) return this.hydrateTags(t, 'track')
    }
    return null
  }
```

- [ ] **Step 2.2.3: Write the failing test `src/storage/memory.test.ts`**

```typescript
import { InMemoryStorageProvider } from './memory'
import type { Route, Track } from '../types'

const FIXED_GEOJSON = {
  type: 'LineString' as const,
  coordinates: [
    [-116.0, 49.5, 1500] as [number, number, number],
    [-116.001, 49.501, 1520] as [number, number, number],
  ],
}

function buildRoute(overrides: Partial<Route> = {}): Route {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'route-1',
    user_id: 'local',
    name: 'Test Route',
    description: '',
    geojson: FIXED_GEOJSON,
    source_hash: 'hash-1',
    source_filename: 'test.gpx',
    color: '#E05C2A',
    ates: 'simple',
    technical_difficulty: 'moderate',
    distance_m: 100,
    elevation_gain_m: 20,
    elevation_loss_m: 0,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function buildTrack(overrides: Partial<Track> = {}): Track {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'track-1',
    user_id: 'local',
    name: 'Test Track',
    description: '',
    geojson: FIXED_GEOJSON,
    source_hash: 'hash-2',
    source_filename: 'test.gpx',
    color: '#2A7BE0',
    distance_m: 100,
    elevation_gain_m: 20,
    elevation_loss_m: 0,
    duration_s: 600,
    moving_time_s: 540,
    recorded_at: now,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('InMemoryStorageProvider — routes', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('returns an empty list initially', async () => {
    expect(await storage.getRoutes()).toEqual([])
  })

  it('saves and reads a route round-trip', async () => {
    const route = buildRoute()
    await storage.saveRoute(route)
    const fetched = await storage.getRoute(route.id)
    expect(fetched).toEqual(route)
  })

  it('lists routes sorted by created_at', async () => {
    await storage.saveRoute(buildRoute({ id: 'a', created_at: '2026-01-02T00:00:00.000Z' }))
    await storage.saveRoute(buildRoute({ id: 'b', source_hash: 'hb', created_at: '2026-01-01T00:00:00.000Z' }))
    const all = await storage.getRoutes()
    expect(all.map(r => r.id)).toEqual(['b', 'a'])
  })

  it('overwrites on save with same id', async () => {
    await storage.saveRoute(buildRoute({ name: 'A' }))
    await storage.saveRoute(buildRoute({ name: 'B', updated_at: '2026-05-06T13:00:00.000Z' }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.name).toBe('B')
    expect(fetched?.updated_at).toBe('2026-05-06T13:00:00.000Z')
  })

  it('deletes a route', async () => {
    await storage.saveRoute(buildRoute())
    await storage.deleteRoute('route-1')
    expect(await storage.getRoute('route-1')).toBeNull()
    expect(await storage.getRoutes()).toEqual([])
  })

  it('looks up by source_hash', async () => {
    await storage.saveRoute(buildRoute({ source_hash: 'unique-abc' }))
    const found = await storage.getRouteBySourceHash('unique-abc')
    expect(found?.id).toBe('route-1')
    const missing = await storage.getRouteBySourceHash('nope')
    expect(missing).toBeNull()
  })

  it('persists the tags array via the junction store', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags.sort()).toEqual(['t1', 't2'])
  })

  it('replaces tags on subsequent save', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
    await storage.saveRoute(buildRoute({ tags: ['t3'] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags).toEqual(['t3'])
  })

  it('removes tag links when the entity is deleted', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1'] }))
    await storage.deleteRoute('route-1')
    // Re-save under the same id with no tags — should not pick up old links.
    await storage.saveRoute(buildRoute({ tags: [] }))
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.tags).toEqual([])
  })

  it('does not mutate the caller-supplied entity (defensive copy)', async () => {
    const route = buildRoute({ name: 'Original' })
    await storage.saveRoute(route)
    route.name = 'Mutated'
    const fetched = await storage.getRoute('route-1')
    expect(fetched?.name).toBe('Original')
  })
})

describe('InMemoryStorageProvider — tracks', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves and reads a track round-trip', async () => {
    const track = buildTrack()
    await storage.saveTrack(track)
    expect(await storage.getTrack(track.id)).toEqual(track)
  })

  it('looks up by source_hash', async () => {
    await storage.saveTrack(buildTrack({ source_hash: 'th' }))
    expect((await storage.getTrackBySourceHash('th'))?.id).toBe('track-1')
    expect(await storage.getTrackBySourceHash('nope')).toBeNull()
  })

  it('preserves nullable time fields', async () => {
    await storage.saveTrack(buildTrack({
      duration_s: null,
      moving_time_s: null,
      recorded_at: null,
    }))
    const fetched = await storage.getTrack('track-1')
    expect(fetched?.duration_s).toBeNull()
    expect(fetched?.moving_time_s).toBeNull()
    expect(fetched?.recorded_at).toBeNull()
  })

  it('does not mix routes and tracks under the same id', async () => {
    await storage.saveRoute(buildRoute({ id: 'shared' }))
    await storage.saveTrack(buildTrack({ id: 'shared', source_hash: 'tx' }))
    const r = await storage.getRoute('shared')
    const t = await storage.getTrack('shared')
    expect(r?.color).toBe('#E05C2A')
    expect(t?.color).toBe('#2A7BE0')
  })
})
```

- [ ] **Step 2.2.4: Run the test, verify it passes**

Run: `npm test src/storage/memory.test.ts`
Expected: 14 tests passing.

- [ ] **Step 2.2.5: Add SQL helpers and route methods to `src/storage/opfs.ts`**

Replace the route stubs in `OPFSStorageProvider`. We'll also add private serialize/deserialize helpers and a tag-syncing helper.

```typescript
// At the imports, add:
import type { EntityType as ET } from '../types'
// (already have all the entity types and the StorageProvider interface)

// Inside the class, add private serializers below the existing methods:

  // --- Row serialization ----------------------------------------------------

  private routeToRow(r: Route): SqlValue[] {
    return [
      r.id, r.user_id, r.name, r.description,
      JSON.stringify(r.geojson),
      r.source_hash, r.source_filename,
      r.color,
      r.ates, r.technical_difficulty,
      r.distance_m, r.elevation_gain_m, r.elevation_loss_m,
      r.created_at, r.updated_at,
    ]
  }

  private rowToRoute(row: SqlRow, tags: string[]): Route {
    return {
      id:                   row.id as string,
      user_id:              row.user_id as string,
      name:                 row.name as string,
      description:          row.description as string,
      geojson:              JSON.parse(row.geojson as string),
      source_hash:          row.source_hash as string,
      source_filename:      (row.source_filename as string | null) ?? null,
      color:                row.color as string,
      ates:                 (row.ates as Route['ates']) ?? null,
      technical_difficulty: (row.technical_difficulty as Route['technical_difficulty']) ?? null,
      distance_m:           Number(row.distance_m),
      elevation_gain_m:     Number(row.elevation_gain_m),
      elevation_loss_m:     Number(row.elevation_loss_m),
      tags,
      created_at:           row.created_at as string,
      updated_at:           row.updated_at as string,
    }
  }

  private trackToRow(t: Track): SqlValue[] {
    return [
      t.id, t.user_id, t.name, t.description,
      JSON.stringify(t.geojson),
      t.source_hash, t.source_filename,
      t.color,
      t.distance_m, t.elevation_gain_m, t.elevation_loss_m,
      t.duration_s, t.moving_time_s,
      t.recorded_at,
      t.created_at, t.updated_at,
    ]
  }

  private rowToTrack(row: SqlRow, tags: string[]): Track {
    return {
      id:               row.id as string,
      user_id:          row.user_id as string,
      name:             row.name as string,
      description:      row.description as string,
      geojson:          JSON.parse(row.geojson as string),
      source_hash:      row.source_hash as string,
      source_filename:  (row.source_filename as string | null) ?? null,
      color:            row.color as string,
      distance_m:       Number(row.distance_m),
      elevation_gain_m: Number(row.elevation_gain_m),
      elevation_loss_m: Number(row.elevation_loss_m),
      duration_s:       row.duration_s === null ? null : Number(row.duration_s),
      moving_time_s:    row.moving_time_s === null ? null : Number(row.moving_time_s),
      recorded_at:      (row.recorded_at as string | null) ?? null,
      tags,
      created_at:       row.created_at as string,
      updated_at:       row.updated_at as string,
    }
  }

  // --- Tag hydration --------------------------------------------------------

  private async tagsByEntity(
    entityType: EntityType,
    ids: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>()
    for (const id of ids) result.set(id, [])
    if (ids.length === 0) return result
    // SQLite has a parameter-count limit (~999); for our load-all read
    // pattern, ids.length is bounded by the number of rows in the table —
    // for the MVP this is safely well under the limit.
    const placeholders = ids.map(() => '?').join(',')
    const rows = await this.client.all(
      `SELECT entity_id, tag_id FROM entity_tags
       WHERE entity_type = ? AND entity_id IN (${placeholders})`,
      [entityType, ...ids],
    )
    for (const row of rows) {
      const list = result.get(row.entity_id as string)
      if (list) list.push(row.tag_id as string)
    }
    for (const list of result.values()) list.sort()
    return result
  }

  private replaceTagsOps(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): SqlOp[] {
    const ops: SqlOp[] = [
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = ? AND entity_id = ?`,
        params: [entityType, entityId],
      },
    ]
    for (const tagId of tagIds) {
      ops.push({
        sql: `INSERT INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)`,
        params: [entityType, entityId, tagId],
      })
    }
    return ops
  }
```

You'll need to add the imports for `SqlOp`, `SqlRow`, `SqlValue`:

```typescript
import type { SqlOp, SqlRow, SqlValue } from './workerProtocol'
```

- [ ] **Step 2.2.6: Replace the route stubs in `src/storage/opfs.ts`**

```typescript
  // --- Routes ---------------------------------------------------------------

  async getRoutes(): Promise<Route[]> {
    const rows = await this.client.all(`SELECT * FROM routes ORDER BY created_at`)
    const ids = rows.map(r => r.id as string)
    const tagMap = await this.tagsByEntity('route', ids)
    return rows.map(r => this.rowToRoute(r, tagMap.get(r.id as string) ?? []))
  }

  async getRoute(id: string): Promise<Route | null> {
    const row = await this.client.one(`SELECT * FROM routes WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('route', [id])
    return this.rowToRoute(row, tagMap.get(id) ?? [])
  }

  async saveRoute(route: Route): Promise<void> {
    const ops: SqlOp[] = [
      {
        sql: `INSERT OR REPLACE INTO routes (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                ates, technical_difficulty,
                distance_m, elevation_gain_m, elevation_loss_m,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.routeToRow(route),
      },
      ...this.replaceTagsOps('route', route.id, route.tags),
    ]
    await this.client.tx(ops)
  }

  async deleteRoute(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'route' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM routes WHERE id = ?`, params: [id] },
    ])
  }

  async getRouteBySourceHash(hash: string): Promise<Route | null> {
    const row = await this.client.one(
      `SELECT * FROM routes WHERE source_hash = ? LIMIT 1`,
      [hash],
    )
    if (!row) return null
    const id = row.id as string
    const tagMap = await this.tagsByEntity('route', [id])
    return this.rowToRoute(row, tagMap.get(id) ?? [])
  }
```

- [ ] **Step 2.2.7: Replace the track stubs in `src/storage/opfs.ts`**

```typescript
  // --- Tracks ---------------------------------------------------------------

  async getTracks(): Promise<Track[]> {
    const rows = await this.client.all(`SELECT * FROM tracks ORDER BY created_at`)
    const ids = rows.map(r => r.id as string)
    const tagMap = await this.tagsByEntity('track', ids)
    return rows.map(r => this.rowToTrack(r, tagMap.get(r.id as string) ?? []))
  }

  async getTrack(id: string): Promise<Track | null> {
    const row = await this.client.one(`SELECT * FROM tracks WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('track', [id])
    return this.rowToTrack(row, tagMap.get(id) ?? [])
  }

  async saveTrack(track: Track): Promise<void> {
    const ops: SqlOp[] = [
      {
        sql: `INSERT OR REPLACE INTO tracks (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                distance_m, elevation_gain_m, elevation_loss_m,
                duration_s, moving_time_s, recorded_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.trackToRow(track),
      },
      ...this.replaceTagsOps('track', track.id, track.tags),
    ]
    await this.client.tx(ops)
  }

  async deleteTrack(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'track' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM tracks WHERE id = ?`, params: [id] },
    ])
  }

  async getTrackBySourceHash(hash: string): Promise<Track | null> {
    const row = await this.client.one(
      `SELECT * FROM tracks WHERE source_hash = ? LIMIT 1`,
      [hash],
    )
    if (!row) return null
    const id = row.id as string
    const tagMap = await this.tagsByEntity('track', [id])
    return this.rowToTrack(row, tagMap.get(id) ?? [])
  }
```

- [ ] **Step 2.2.8: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests still pass (the OPFS impl isn't tested in vitest, but the in-memory tests cover the contract).

- [ ] **Step 2.2.9: Write `src/dev/devConsole.ts`**

```typescript
import type { StorageProvider } from '../storage/interface'
import { newId } from '../utils/id'
import type { Route, Track } from '../types'

// Installs a `window.__couloir` helper for browser-console verification of
// the storage layer. Tree-shaken out of production builds via the
// `import.meta.env.DEV` guard at the call site (main.tsx).
export function installDevConsole(storage: StorageProvider): void {
  const FIXED_GEOJSON = {
    type: 'LineString' as const,
    coordinates: [
      [-115.05, 49.50, 1500] as [number, number, number],
      [-115.06, 49.51, 1620] as [number, number, number],
    ],
  }

  const helper = {
    storage,

    async createDummyRoute(name = 'Dummy Route'): Promise<Route> {
      const now = new Date().toISOString()
      const route: Route = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyRoute',
        geojson: FIXED_GEOJSON,
        source_hash: `dev-${newId()}`,
        source_filename: 'devConsole.ts',
        color: '#E05C2A',
        ates: 'simple',
        technical_difficulty: 'moderate',
        distance_m: 0,
        elevation_gain_m: 120,
        elevation_loss_m: 0,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveRoute(route)
      return route
    },

    async createDummyTrack(name = 'Dummy Track'): Promise<Track> {
      const now = new Date().toISOString()
      const track: Track = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyTrack',
        geojson: FIXED_GEOJSON,
        source_hash: `dev-${newId()}`,
        source_filename: 'devConsole.ts',
        color: '#2A7BE0',
        distance_m: 0,
        elevation_gain_m: 120,
        elevation_loss_m: 0,
        duration_s: 1800,
        moving_time_s: 1700,
        recorded_at: now,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveTrack(track)
      return track
    },

    async renameRoute(id: string, name: string): Promise<Route> {
      const existing = await storage.getRoute(id)
      if (!existing) throw new Error(`route ${id} not found`)
      const updated: Route = {
        ...existing,
        name,
        updated_at: new Date().toISOString(),
      }
      await storage.saveRoute(updated)
      return updated
    },

    async list(kind: 'routes' | 'tracks'): Promise<unknown[]> {
      return kind === 'routes' ? storage.getRoutes() : storage.getTracks()
    },
  }

  ;(globalThis as unknown as { __couloir: typeof helper }).__couloir = helper
  // eslint-disable-next-line no-console
  console.log('[couloir] dev console installed at window.__couloir')
}
```

- [ ] **Step 2.2.10: Wire the dev console into `src/main.tsx`**

Replace the file contents (the Phase 1 baseline plus the dev-only storage init):

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'
import { OPFSStorageProvider } from './storage/opfs'
import { installDevConsole } from './dev/devConsole'

if (import.meta.env.DEV) {
  // Storage init in dev mode is wired here for the Phase 2 console verification.
  // Task 2.5 will move this to a proper shared bootstrap that also seeds the
  // Zustand stores.
  const storage = new OPFSStorageProvider()
  storage.init().then(() => installDevConsole(storage))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 2.2.11: Browser verification — full route lifecycle**

Run: `npm run dev`. Open http://localhost:5173. Open DevTools console. Wait for `[couloir] dev console installed at window.__couloir`. Then:

```javascript
const r = await __couloir.createDummyRoute('Tonquin')
r.id          // -> some UUID
const fresh = await __couloir.storage.getRoute(r.id)
fresh.name    // -> 'Tonquin'
fresh.created_at === fresh.updated_at  // -> true (just created)

const renamed = await __couloir.renameRoute(r.id, 'Tonquin Traverse')
renamed.updated_at > r.updated_at      // -> true

const byHash = await __couloir.storage.getRouteBySourceHash(r.source_hash)
byHash.id === r.id                     // -> true
const missing = await __couloir.storage.getRouteBySourceHash('does-not-exist')
missing                                // -> null

await __couloir.storage.deleteRoute(r.id)
await __couloir.storage.getRoute(r.id) // -> null
```

Expected: every assertion above is true. Reload the page — `await __couloir.list('routes')` returns `[]` (the route really was deleted from OPFS).

- [ ] **Step 2.2.12: Browser verification — track lifecycle and persistence**

```javascript
const t = await __couloir.createDummyTrack('Mt Murray Skin')
const fetched = await __couloir.storage.getTrack(t.id)
fetched.moving_time_s          // -> 1700 (Number, not string)
fetched.duration_s             // -> 1800
```

Reload the page. In console:

```javascript
const all = await __couloir.list('tracks')
all.length       // -> 1
all[0].name      // -> 'Mt Murray Skin'
```

Expected: track survives reload. Then clean up:

```javascript
await __couloir.storage.deleteTrack(all[0].id)
```

- [ ] **Step 2.2.13: Browser verification — same source_hash returns the existing row**

```javascript
const a = await __couloir.createDummyRoute('A')
// Mimic the dedup-detection lookup the importer will do:
const dup = await __couloir.storage.getRouteBySourceHash(a.source_hash)
dup.id === a.id                // -> true
await __couloir.storage.deleteRoute(a.id)
```

- [ ] **Step 2.2.14: Run typecheck and the full test suite once more**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 2.2.15: Commit**

```bash
git add src/storage/memory.ts src/storage/memory.test.ts src/storage/opfs.ts src/dev/devConsole.ts src/main.tsx
git commit -m "$(cat <<'EOF'
feat(storage): route and track CRUD on both backends

Implements get/save/delete/getBySourceHash for routes and tracks on
InMemoryStorageProvider (test backend) and OPFSStorageProvider
(production). Saves write the entity row and overwrite the entity_tags
junction in one transaction. Adds a dev-only window.__couloir helper
for browser-console verification of the storage lifecycle.
EOF
)"
```

---

## Task 2.3 — Waypoint and photo CRUD

**Files:**
- Modify: `src/storage/memory.ts` (implement waypoint + photo methods)
- Modify: `src/storage/opfs.ts` (implement waypoint + photo methods, including blob calls to the worker)
- Modify: `src/storage/memory.test.ts` (add waypoint + photo coverage)
- Modify: `src/dev/devConsole.ts` (add waypoint + photo helpers)

`savePhoto(photo, blob, thumb)` writes both blobs (full-size at `photos/{id}.jpg`, thumb at `photos/{id}_thumb.jpg`) plus the metadata row. The OPFS implementation does the row write inside a transaction; the blob writes happen separately because they're file-system operations, not SQL. If the row write fails, the in-flight blobs are removed; if a blob write fails, the row write is not attempted (we go blobs-first → metadata-second so a failed blob doesn't leave dangling rows).

- [ ] **Step 2.3.1: Replace the waypoint stubs in `src/storage/memory.ts`**

```typescript
  // --- Waypoints ------------------------------------------------------------

  async getWaypoints(): Promise<Waypoint[]> {
    return Array.from(this.waypoints.values())
      .map(w => this.hydrateTags(w, 'waypoint'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getWaypoint(id: string): Promise<Waypoint | null> {
    const w = this.waypoints.get(id)
    return w ? this.hydrateTags(w, 'waypoint') : null
  }
  async saveWaypoint(waypoint: Waypoint): Promise<void> {
    this.waypoints.set(waypoint.id, JSON.parse(JSON.stringify(waypoint)) as Waypoint)
    this.replaceEntityTags('waypoint', waypoint.id, waypoint.tags)
  }
  async deleteWaypoint(id: string): Promise<void> {
    this.waypoints.delete(id)
    this.removeAllTagsFor('waypoint', id)
  }
```

- [ ] **Step 2.3.2: Replace the photo stubs in `src/storage/memory.ts`**

```typescript
  // --- Photos ---------------------------------------------------------------

  async getPhotos(): Promise<Photo[]> {
    return Array.from(this.photos.values())
      .map(p => this.hydrateTags(p, 'photo'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  async getPhoto(id: string): Promise<Photo | null> {
    const p = this.photos.get(id)
    return p ? this.hydrateTags(p, 'photo') : null
  }
  async savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void> {
    this.photos.set(photo.id, JSON.parse(JSON.stringify(photo)) as Photo)
    this.replaceEntityTags('photo', photo.id, photo.tags)
    this.blobs.set(photo.id, blob)
    this.thumbs.set(photo.id, thumb)
  }
  async getPhotoBlob(id: string): Promise<Blob | null> {
    return this.blobs.get(id) ?? null
  }
  async getPhotoThumb(id: string): Promise<Blob | null> {
    return this.thumbs.get(id) ?? null
  }
  async deletePhoto(id: string): Promise<void> {
    this.photos.delete(id)
    this.blobs.delete(id)
    this.thumbs.delete(id)
    this.removeAllTagsFor('photo', id)
  }
```

- [ ] **Step 2.3.3: Add waypoint and photo tests to `src/storage/memory.test.ts`**

Append after the existing `describe` blocks:

```typescript
import type { Photo, Waypoint } from '../types'

function buildWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'wp-1',
    user_id: 'local',
    name: 'Test Waypoint',
    description: '',
    lat: 49.5,
    lng: -116.0,
    elevation_m: 1500,
    category: 'summit',
    color: null,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function buildPhoto(overrides: Partial<Photo> = {}): Photo {
  const now = '2026-05-06T12:00:00.000Z'
  return {
    id: 'photo-1',
    user_id: 'local',
    name: 'Test Photo',
    description: '',
    lat: 49.5,
    lng: -116.0,
    elevation_m: 1500,
    camera_lat: 49.499,
    camera_lng: -116.001,
    camera_elevation_m: 1495,
    bearing: 90,
    blob_ref: 'photos/photo-1.jpg',
    width: 1024,
    height: 768,
    file_size_bytes: 123456,
    taken_at: now,
    tags: [],
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('InMemoryStorageProvider — waypoints', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves and reads a waypoint round-trip', async () => {
    const wp = buildWaypoint()
    await storage.saveWaypoint(wp)
    expect(await storage.getWaypoint(wp.id)).toEqual(wp)
  })

  it('preserves nullable elevation and color', async () => {
    await storage.saveWaypoint(buildWaypoint({ elevation_m: null, color: null }))
    const fetched = await storage.getWaypoint('wp-1')
    expect(fetched?.elevation_m).toBeNull()
    expect(fetched?.color).toBeNull()
  })

  it('overwrites color when set', async () => {
    await storage.saveWaypoint(buildWaypoint({ color: '#FF0000' }))
    expect((await storage.getWaypoint('wp-1'))?.color).toBe('#FF0000')
  })

  it('deletes a waypoint and clears its tags', async () => {
    await storage.saveWaypoint(buildWaypoint({ tags: ['t1'] }))
    await storage.deleteWaypoint('wp-1')
    await storage.saveWaypoint(buildWaypoint({ tags: [] }))
    expect((await storage.getWaypoint('wp-1'))?.tags).toEqual([])
  })
})

describe('InMemoryStorageProvider — photos', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves a photo with both blobs', async () => {
    const photo = buildPhoto()
    const fullBlob = new Blob(['full'], { type: 'image/jpeg' })
    const thumbBlob = new Blob(['thumb'], { type: 'image/jpeg' })
    await storage.savePhoto(photo, fullBlob, thumbBlob)

    const fetched = await storage.getPhoto(photo.id)
    expect(fetched).toEqual(photo)

    const full = await storage.getPhotoBlob(photo.id)
    const thumb = await storage.getPhotoThumb(photo.id)
    expect(full).toBe(fullBlob)
    expect(thumb).toBe(thumbBlob)
  })

  it('returns null for a missing photo blob', async () => {
    expect(await storage.getPhotoBlob('nope')).toBeNull()
    expect(await storage.getPhotoThumb('nope')).toBeNull()
  })

  it('preserves all camera_* fields including null values', async () => {
    await storage.savePhoto(
      buildPhoto({
        camera_lat: null,
        camera_lng: null,
        camera_elevation_m: null,
        bearing: null,
      }),
      new Blob(),
      new Blob(),
    )
    const fetched = await storage.getPhoto('photo-1')
    expect(fetched?.camera_lat).toBeNull()
    expect(fetched?.camera_lng).toBeNull()
    expect(fetched?.camera_elevation_m).toBeNull()
    expect(fetched?.bearing).toBeNull()
  })

  it('deletes both blobs along with the metadata', async () => {
    const photo = buildPhoto()
    await storage.savePhoto(photo, new Blob(['a']), new Blob(['b']))
    await storage.deletePhoto(photo.id)
    expect(await storage.getPhoto(photo.id)).toBeNull()
    expect(await storage.getPhotoBlob(photo.id)).toBeNull()
    expect(await storage.getPhotoThumb(photo.id)).toBeNull()
  })
})
```

- [ ] **Step 2.3.4: Run the test, verify it passes**

Run: `npm test src/storage/memory.test.ts`
Expected: 21 tests passing (the original 14 plus 7 new).

- [ ] **Step 2.3.5: Add waypoint serializers to `src/storage/opfs.ts`**

Inside the class, alongside the existing serializers:

```typescript
  private waypointToRow(w: Waypoint): SqlValue[] {
    return [
      w.id, w.user_id, w.name, w.description,
      w.lat, w.lng, w.elevation_m,
      w.category, w.color,
      w.created_at, w.updated_at,
    ]
  }

  private rowToWaypoint(row: SqlRow, tags: string[]): Waypoint {
    return {
      id:          row.id as string,
      user_id:     row.user_id as string,
      name:        row.name as string,
      description: row.description as string,
      lat:         Number(row.lat),
      lng:         Number(row.lng),
      elevation_m: row.elevation_m === null ? null : Number(row.elevation_m),
      category:    row.category as Waypoint['category'],
      color:       (row.color as string | null) ?? null,
      tags,
      created_at:  row.created_at as string,
      updated_at:  row.updated_at as string,
    }
  }
```

- [ ] **Step 2.3.6: Replace the waypoint stubs in `src/storage/opfs.ts`**

```typescript
  // --- Waypoints ------------------------------------------------------------

  async getWaypoints(): Promise<Waypoint[]> {
    const rows = await this.client.all(`SELECT * FROM waypoints ORDER BY created_at`)
    const ids = rows.map(r => r.id as string)
    const tagMap = await this.tagsByEntity('waypoint', ids)
    return rows.map(r => this.rowToWaypoint(r, tagMap.get(r.id as string) ?? []))
  }

  async getWaypoint(id: string): Promise<Waypoint | null> {
    const row = await this.client.one(`SELECT * FROM waypoints WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('waypoint', [id])
    return this.rowToWaypoint(row, tagMap.get(id) ?? [])
  }

  async saveWaypoint(waypoint: Waypoint): Promise<void> {
    const ops: SqlOp[] = [
      {
        sql: `INSERT OR REPLACE INTO waypoints (
                id, user_id, name, description,
                lat, lng, elevation_m,
                category, color,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.waypointToRow(waypoint),
      },
      ...this.replaceTagsOps('waypoint', waypoint.id, waypoint.tags),
    ]
    await this.client.tx(ops)
  }

  async deleteWaypoint(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'waypoint' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM waypoints WHERE id = ?`, params: [id] },
    ])
  }
```

- [ ] **Step 2.3.7: Add photo serializers to `src/storage/opfs.ts`**

```typescript
  private photoToRow(p: Photo): SqlValue[] {
    return [
      p.id, p.user_id, p.name, p.description,
      p.lat, p.lng, p.elevation_m,
      p.camera_lat, p.camera_lng, p.camera_elevation_m, p.bearing,
      p.blob_ref,
      p.width, p.height, p.file_size_bytes,
      p.taken_at,
      p.created_at, p.updated_at,
    ]
  }

  private rowToPhoto(row: SqlRow, tags: string[]): Photo {
    return {
      id:                 row.id as string,
      user_id:            row.user_id as string,
      name:               row.name as string,
      description:        row.description as string,
      lat:                Number(row.lat),
      lng:                Number(row.lng),
      elevation_m:        row.elevation_m === null ? null : Number(row.elevation_m),
      camera_lat:         row.camera_lat === null ? null : Number(row.camera_lat),
      camera_lng:         row.camera_lng === null ? null : Number(row.camera_lng),
      camera_elevation_m: row.camera_elevation_m === null ? null : Number(row.camera_elevation_m),
      bearing:            row.bearing === null ? null : Number(row.bearing),
      blob_ref:           row.blob_ref as string,
      width:              Number(row.width),
      height:             Number(row.height),
      file_size_bytes:    Number(row.file_size_bytes),
      taken_at:           (row.taken_at as string | null) ?? null,
      tags,
      created_at:         row.created_at as string,
      updated_at:         row.updated_at as string,
    }
  }
```

- [ ] **Step 2.3.8: Replace the photo stubs in `src/storage/opfs.ts`**

```typescript
  // --- Photos ---------------------------------------------------------------

  private photoFullPath(id: string): string  { return `photos/${id}.jpg` }
  private photoThumbPath(id: string): string { return `photos/${id}_thumb.jpg` }

  async getPhotos(): Promise<Photo[]> {
    const rows = await this.client.all(`SELECT * FROM photos ORDER BY created_at`)
    const ids = rows.map(r => r.id as string)
    const tagMap = await this.tagsByEntity('photo', ids)
    return rows.map(r => this.rowToPhoto(r, tagMap.get(r.id as string) ?? []))
  }

  async getPhoto(id: string): Promise<Photo | null> {
    const row = await this.client.one(`SELECT * FROM photos WHERE id = ?`, [id])
    if (!row) return null
    const tagMap = await this.tagsByEntity('photo', [id])
    return this.rowToPhoto(row, tagMap.get(id) ?? [])
  }

  async savePhoto(photo: Photo, blob: Blob, thumb: Blob): Promise<void> {
    // Write blobs first; if either fails we abort before touching SQL so
    // we never end up with a metadata row pointing at a missing file.
    const fullBuf = await blob.arrayBuffer()
    const thumbBuf = await thumb.arrayBuffer()
    await this.client.writeBlob(this.photoFullPath(photo.id), fullBuf)
    try {
      await this.client.writeBlob(this.photoThumbPath(photo.id), thumbBuf)
    } catch (err) {
      // Roll back the full-size write so we don't leak storage on retry.
      await this.client.deleteBlob(this.photoFullPath(photo.id))
      throw err
    }

    try {
      await this.client.tx([
        {
          sql: `INSERT OR REPLACE INTO photos (
                  id, user_id, name, description,
                  lat, lng, elevation_m,
                  camera_lat, camera_lng, camera_elevation_m, bearing,
                  blob_ref,
                  width, height, file_size_bytes,
                  taken_at,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: this.photoToRow(photo),
        },
        ...this.replaceTagsOps('photo', photo.id, photo.tags),
      ])
    } catch (err) {
      // Roll back the blob writes if we couldn't record the metadata.
      await this.client.deleteBlob(this.photoFullPath(photo.id))
      await this.client.deleteBlob(this.photoThumbPath(photo.id))
      throw err
    }
  }

  async getPhotoBlob(id: string): Promise<Blob | null> {
    const buf = await this.client.readBlob(this.photoFullPath(id))
    return buf ? new Blob([buf], { type: 'image/jpeg' }) : null
  }

  async getPhotoThumb(id: string): Promise<Blob | null> {
    const buf = await this.client.readBlob(this.photoThumbPath(id))
    return buf ? new Blob([buf], { type: 'image/jpeg' }) : null
  }

  async deletePhoto(id: string): Promise<void> {
    await this.client.tx([
      {
        sql: `DELETE FROM entity_tags WHERE entity_type = 'photo' AND entity_id = ?`,
        params: [id],
      },
      { sql: `DELETE FROM photos WHERE id = ?`, params: [id] },
    ])
    // Best-effort blob cleanup. If these fail (file already missing) we
    // swallow — the worker's deleteBlob is already tolerant of that.
    await this.client.deleteBlob(this.photoFullPath(id))
    await this.client.deleteBlob(this.photoThumbPath(id))
  }
```

- [ ] **Step 2.3.9: Add waypoint and photo helpers to `src/dev/devConsole.ts`**

Add these inside the `helper` object (alongside `createDummyRoute` etc.):

```typescript
    async createDummyWaypoint(name = 'Dummy Waypoint'): Promise<Waypoint> {
      const now = new Date().toISOString()
      const wp: Waypoint = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyWaypoint',
        lat: 49.5,
        lng: -116.0,
        elevation_m: 1500,
        category: 'summit',
        color: null,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveWaypoint(wp)
      return wp
    },

    async createDummyPhoto(name = 'Dummy Photo'): Promise<Photo> {
      const now = new Date().toISOString()
      // 1×1 red pixel JPEG, base64 — minimal valid image for blob round-trip
      // testing without bundling fixture files.
      const RED_JPEG_B64 =
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/wgARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUC/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Af/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8C/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyH/2gAMAwEAAgADAAAAEP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q=='
      const bytes = Uint8Array.from(atob(RED_JPEG_B64), c => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/jpeg' })
      const thumb = new Blob([bytes], { type: 'image/jpeg' })

      const id = newId()
      const photo: Photo = {
        id,
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyPhoto',
        lat: 49.5,
        lng: -116.0,
        elevation_m: 1500,
        camera_lat: 49.499,
        camera_lng: -116.001,
        camera_elevation_m: 1495,
        bearing: 90,
        blob_ref: `photos/${id}.jpg`,
        width: 1,
        height: 1,
        file_size_bytes: bytes.byteLength,
        taken_at: now,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.savePhoto(photo, blob, thumb)
      return photo
    },

    async listAll(): Promise<{
      routes: Route[]
      tracks: Track[]
      waypoints: Waypoint[]
      photos: Photo[]
    }> {
      const [routes, tracks, waypoints, photos] = await Promise.all([
        storage.getRoutes(),
        storage.getTracks(),
        storage.getWaypoints(),
        storage.getPhotos(),
      ])
      return { routes, tracks, waypoints, photos }
    },
```

Update the import line at the top to add `Photo` and `Waypoint`:

```typescript
import type { Photo, Route, Track, Waypoint } from '../types'
```

- [ ] **Step 2.3.10: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 2.3.11: Browser verification — waypoint round-trip**

Run: `npm run dev`. In console:

```javascript
const w = await __couloir.createDummyWaypoint('Summit cairn')
const fresh = await __couloir.storage.getWaypoint(w.id)
fresh.category   // -> 'summit'
fresh.lat        // -> 49.5 (Number)
```

Reload, then:

```javascript
const all = await __couloir.storage.getWaypoints()
all.length       // -> 1
await __couloir.storage.deleteWaypoint(all[0].id)
```

Expected: waypoint persists across reload, then deletes cleanly.

- [ ] **Step 2.3.12: Browser verification — photo blob round-trip**

```javascript
const p = await __couloir.createDummyPhoto('Test pic')
p.blob_ref                              // -> 'photos/<uuid>.jpg'

// OPFS verification: open DevTools → Application → Storage → Origin Private
// File System → photos/. Two files should appear: <id>.jpg and <id>_thumb.jpg.

const blob = await __couloir.storage.getPhotoBlob(p.id)
blob instanceof Blob                    // -> true
blob.size                               // -> matches p.file_size_bytes

const thumb = await __couloir.storage.getPhotoThumb(p.id)
thumb instanceof Blob                   // -> true
```

Reload the page:

```javascript
const all = await __couloir.storage.getPhotos()
all.length                              // -> 1
const blob2 = await __couloir.storage.getPhotoBlob(all[0].id)
blob2.size === all[0].file_size_bytes   // -> true
```

Expected: blob and metadata both survive reload. Then delete and verify cleanup:

```javascript
await __couloir.storage.deletePhoto(all[0].id)
await __couloir.storage.getPhoto(all[0].id)        // -> null
await __couloir.storage.getPhotoBlob(all[0].id)    // -> null
await __couloir.storage.getPhotoThumb(all[0].id)   // -> null
```

In DevTools → Application → OPFS → photos/, both files for this id are gone.

- [ ] **Step 2.3.13: Commit**

```bash
git add src/storage/memory.ts src/storage/memory.test.ts src/storage/opfs.ts src/dev/devConsole.ts
git commit -m "$(cat <<'EOF'
feat(storage): waypoint and photo CRUD with OPFS blob storage

Waypoints follow the same pattern as routes/tracks. Photo metadata is
stored in SQLite; full-size and thumbnail JPEGs are stored as OPFS files
at photos/{id}.jpg and photos/{id}_thumb.jpg. savePhoto writes blobs
first then the metadata row in a transaction, with rollback of orphaned
blobs if either step fails. deletePhoto removes both files and the row.
EOF
)"
```

---

## Task 2.4 — Tags and backup

**Files:**
- Modify: `src/storage/memory.ts` (implement tag CRUD + setEntityTags + exportAll/importAll)
- Modify: `src/storage/opfs.ts` (same)
- Modify: `src/storage/memory.test.ts` (add tag and backup coverage)
- Modify: `src/dev/devConsole.ts` (add backup helpers)

`exportAll()` returns the in-memory bundle shape `{ bundle, photos, thumbs }` — Phase 6.4 wraps this in ZIP packaging. `importAll()` is additive: insert if missing, update if the bundle's `updated_at` is newer, skip otherwise. Re-importing the same bundle is a no-op.

- [ ] **Step 2.4.1: Replace the tag stubs in `src/storage/memory.ts`**

```typescript
  // --- Tags -----------------------------------------------------------------

  async getTags(): Promise<Tag[]> {
    return Array.from(this.tags.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(t => ({ ...t }))
  }

  async saveTag(tag: Tag): Promise<void> {
    this.tags.set(tag.id, { ...tag })
  }

  async deleteTag(id: string): Promise<void> {
    this.tags.delete(id)
    // Mirror the OPFS ON DELETE CASCADE: drop every junction row that
    // referenced this tag.
    for (const key of Array.from(this.entityTags)) {
      // key shape: '<entityType>|<entityId>|<tagId>'
      if (key.endsWith(`|${id}`)) this.entityTags.delete(key)
    }
  }

  async setEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    this.replaceEntityTags(entityType, entityId, tagIds)
  }
```

- [ ] **Step 2.4.2: Implement `exportAll` / `importAll` in `src/storage/memory.ts`**

```typescript
  // --- Backup ---------------------------------------------------------------

  async exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    const [routes, tracks, waypoints, photos, tags] = await Promise.all([
      this.getRoutes(),
      this.getTracks(),
      this.getWaypoints(),
      this.getPhotos(),
      this.getTags(),
    ])

    const entity_tags: EntityTagRow[] = []
    for (const key of this.entityTags) {
      const [entity_type, entity_id, tag_id] = key.split('|')
      entity_tags.push({
        entity_type: entity_type as EntityType,
        entity_id,
        tag_id,
      })
    }
    entity_tags.sort((a, b) =>
      `${a.entity_type}|${a.entity_id}|${a.tag_id}`.localeCompare(
        `${b.entity_type}|${b.entity_id}|${b.tag_id}`,
      ),
    )

    const bundle: ExportBundle = {
      bundle_version: 1,
      app_version: APP_VERSION,
      exported_at: new Date().toISOString(),
      routes,
      tracks,
      waypoints,
      photos,
      tags,
      entity_tags,
    }

    return {
      bundle,
      photos: new Map(this.blobs),
      thumbs: new Map(this.thumbs),
    }
  }

  async importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void> {
    const isNewer = (a: string, b: string): boolean => a > b // ISO 8601 sorts lexically

    // Tags first — entity_tags references them.
    for (const tag of bundle.tags) {
      const existing = this.tags.get(tag.id)
      if (!existing) this.tags.set(tag.id, { ...tag })
      // Tags don't carry updated_at; we treat existing rows as winning.
    }

    // Entities. Each implicitly carries its tags array; setEntityTags is
    // applied as part of saveX in the live API. For import we explicitly
    // process entity_tags below to honor whatever shape the bundle carries.
    for (const r of bundle.routes) {
      const existing = this.routes.get(r.id)
      if (!existing || isNewer(r.updated_at, existing.updated_at)) {
        this.routes.set(r.id, JSON.parse(JSON.stringify(r)) as Route)
      }
    }
    for (const t of bundle.tracks) {
      const existing = this.tracks.get(t.id)
      if (!existing || isNewer(t.updated_at, existing.updated_at)) {
        this.tracks.set(t.id, JSON.parse(JSON.stringify(t)) as Track)
      }
    }
    for (const w of bundle.waypoints) {
      const existing = this.waypoints.get(w.id)
      if (!existing || isNewer(w.updated_at, existing.updated_at)) {
        this.waypoints.set(w.id, JSON.parse(JSON.stringify(w)) as Waypoint)
      }
    }
    for (const p of bundle.photos) {
      const existing = this.photos.get(p.id)
      if (!existing || isNewer(p.updated_at, existing.updated_at)) {
        this.photos.set(p.id, JSON.parse(JSON.stringify(p)) as Photo)
      }
    }

    // Junction rows — additive. Composite-key Set already deduplicates.
    for (const row of bundle.entity_tags) {
      this.entityTags.add(this.tagKey(row.entity_type, row.entity_id, row.tag_id))
    }

    // Blobs — additive (overwrite if present).
    for (const [id, blob] of photos) this.blobs.set(id, blob)
    for (const [id, thumb] of thumbs) this.thumbs.set(id, thumb)
  }
```

You'll need to import the additional types at the top of `src/storage/memory.ts`:

```typescript
import type {
  EntityTagRow,
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import { APP_VERSION } from '../types'
import type { StorageProvider } from './interface'
```

- [ ] **Step 2.4.3: Add tag tests to `src/storage/memory.test.ts`**

Append:

```typescript
import type { Tag, ExportBundle } from '../types'

function buildTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    name: 'Steep',
    color: '#FF8800',
    created_at: '2026-05-06T12:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryStorageProvider — tags', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('saves and reads tags sorted by name', async () => {
    await storage.saveTag(buildTag({ id: 'b', name: 'Mellow' }))
    await storage.saveTag(buildTag({ id: 'a', name: 'Aggressive' }))
    const all = await storage.getTags()
    expect(all.map(t => t.id)).toEqual(['a', 'b'])
  })

  it('overwrites a tag on save with same id', async () => {
    await storage.saveTag(buildTag({ name: 'Old' }))
    await storage.saveTag(buildTag({ name: 'New' }))
    const all = await storage.getTags()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('New')
  })

  it('deletes a tag and removes its junction rows', async () => {
    await storage.saveTag(buildTag())
    await storage.saveRoute(buildRoute({ tags: ['tag-1'] }))
    await storage.deleteTag('tag-1')

    expect(await storage.getTags()).toEqual([])
    const route = await storage.getRoute('route-1')
    expect(route?.tags).toEqual([])
  })

  it('setEntityTags replaces the entity-tag link list', async () => {
    await storage.saveRoute(buildRoute({ tags: ['t1', 't2'] }))
    await storage.setEntityTags('route', 'route-1', ['t3'])
    const fresh = await storage.getRoute('route-1')
    expect(fresh?.tags).toEqual(['t3'])
  })
})

describe('InMemoryStorageProvider — backup', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  it('exports an empty bundle for a fresh store', async () => {
    const { bundle, photos, thumbs } = await storage.exportAll()
    expect(bundle.bundle_version).toBe(1)
    expect(bundle.routes).toEqual([])
    expect(bundle.entity_tags).toEqual([])
    expect(photos.size).toBe(0)
    expect(thumbs.size).toBe(0)
  })

  it('round-trips routes, tags, and entity_tags through export+import', async () => {
    await storage.saveTag(buildTag())
    await storage.saveRoute(buildRoute({ tags: ['tag-1'] }))
    const exported = await storage.exportAll()

    const fresh = new InMemoryStorageProvider()
    await fresh.init()
    await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

    const route = await fresh.getRoute('route-1')
    expect(route?.tags).toEqual(['tag-1'])
    const tags = await fresh.getTags()
    expect(tags.map(t => t.id)).toEqual(['tag-1'])
  })

  it('round-trips photo blobs through export+import', async () => {
    const photo = buildPhoto()
    const fullBlob = new Blob(['full-bytes'], { type: 'image/jpeg' })
    const thumbBlob = new Blob(['thumb-bytes'], { type: 'image/jpeg' })
    await storage.savePhoto(photo, fullBlob, thumbBlob)
    const exported = await storage.exportAll()

    const fresh = new InMemoryStorageProvider()
    await fresh.init()
    await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

    const blob = await fresh.getPhotoBlob(photo.id)
    expect(blob).not.toBeNull()
    const text = await blob!.text()
    expect(text).toBe('full-bytes')
  })

  it('importAll is idempotent — running it twice changes nothing', async () => {
    await storage.saveRoute(buildRoute({ name: 'A' }))
    const exported = await storage.exportAll()

    const fresh = new InMemoryStorageProvider()
    await fresh.init()
    await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)
    await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

    const all = await fresh.getRoutes()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('A')
  })

  it('importAll updates rows when the bundle is newer', async () => {
    await storage.saveRoute(buildRoute({
      name: 'Bundle version',
      updated_at: '2026-05-06T13:00:00.000Z',
    }))
    const exported = await storage.exportAll()

    const fresh = new InMemoryStorageProvider()
    await fresh.init()
    await fresh.saveRoute(buildRoute({
      name: 'Local stale',
      updated_at: '2026-05-06T12:00:00.000Z',
    }))
    await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

    expect((await fresh.getRoute('route-1'))?.name).toBe('Bundle version')
  })

  it('importAll preserves rows when the local copy is newer', async () => {
    await storage.saveRoute(buildRoute({
      name: 'Bundle stale',
      updated_at: '2026-05-06T12:00:00.000Z',
    }))
    const exported = await storage.exportAll()

    const fresh = new InMemoryStorageProvider()
    await fresh.init()
    await fresh.saveRoute(buildRoute({
      name: 'Local newer',
      updated_at: '2026-05-06T13:00:00.000Z',
    }))
    await fresh.importAll(exported.bundle, exported.photos, exported.thumbs)

    expect((await fresh.getRoute('route-1'))?.name).toBe('Local newer')
  })
})
```

- [ ] **Step 2.4.4: Run the test, verify it passes**

Run: `npm test src/storage/memory.test.ts`
Expected: 32 tests passing.

- [ ] **Step 2.4.5: Replace the tag stubs in `src/storage/opfs.ts`**

```typescript
  // --- Tags -----------------------------------------------------------------

  async getTags(): Promise<Tag[]> {
    const rows = await this.client.all(`SELECT * FROM tags ORDER BY name`)
    return rows.map(r => ({
      id:         r.id as string,
      name:       r.name as string,
      color:      r.color as string,
      created_at: r.created_at as string,
    }))
  }

  async saveTag(tag: Tag): Promise<void> {
    await this.client.run(
      `INSERT OR REPLACE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
      [tag.id, tag.name, tag.color, tag.created_at],
    )
  }

  async deleteTag(id: string): Promise<void> {
    // ON DELETE CASCADE on entity_tags(tag_id) cleans up junction rows
    // automatically — no application-level cleanup needed (DATA-MODEL.md).
    await this.client.run(`DELETE FROM tags WHERE id = ?`, [id])
  }

  async setEntityTags(
    entityType: EntityType,
    entityId: string,
    tagIds: string[],
  ): Promise<void> {
    await this.client.tx(this.replaceTagsOps(entityType, entityId, tagIds))
  }
```

- [ ] **Step 2.4.6: Implement `exportAll` in `src/storage/opfs.ts`**

```typescript
  // --- Backup ---------------------------------------------------------------

  async exportAll(): Promise<{
    bundle: ExportBundle
    photos: Map<string, Blob>
    thumbs: Map<string, Blob>
  }> {
    const [routes, tracks, waypoints, photos, tags] = await Promise.all([
      this.getRoutes(),
      this.getTracks(),
      this.getWaypoints(),
      this.getPhotos(),
      this.getTags(),
    ])

    const junctionRows = await this.client.all(
      `SELECT entity_type, entity_id, tag_id FROM entity_tags
       ORDER BY entity_type, entity_id, tag_id`,
    )
    const entity_tags: EntityTagRow[] = junctionRows.map(r => ({
      entity_type: r.entity_type as EntityType,
      entity_id:   r.entity_id as string,
      tag_id:      r.tag_id as string,
    }))

    const bundle: ExportBundle = {
      bundle_version: 1,
      app_version: APP_VERSION,
      exported_at: new Date().toISOString(),
      routes,
      tracks,
      waypoints,
      photos,
      tags,
      entity_tags,
    }

    const photoBlobs = new Map<string, Blob>()
    const thumbBlobs = new Map<string, Blob>()
    for (const p of photos) {
      const full = await this.getPhotoBlob(p.id)
      const thumb = await this.getPhotoThumb(p.id)
      if (full) photoBlobs.set(p.id, full)
      if (thumb) thumbBlobs.set(p.id, thumb)
    }

    return { bundle, photos: photoBlobs, thumbs: thumbBlobs }
  }
```

- [ ] **Step 2.4.7: Implement `importAll` in `src/storage/opfs.ts`**

`importAll` builds one big transaction with conditional `INSERT/UPDATE` per row driven by per-row `updated_at` checks. Photo blobs are written separately because they're file-system writes.

```typescript
  async importAll(
    bundle: ExportBundle,
    photos: Map<string, Blob>,
    thumbs: Map<string, Blob>,
  ): Promise<void> {
    // Pull current updated_at for every entity in the bundle so we can decide
    // insert-vs-update-vs-skip without making N round-trips.
    const currentUpdatedAt = async (
      table: 'routes' | 'tracks' | 'waypoints' | 'photos',
      ids: string[],
    ): Promise<Map<string, string>> => {
      const result = new Map<string, string>()
      if (ids.length === 0) return result
      const placeholders = ids.map(() => '?').join(',')
      const rows = await this.client.all(
        `SELECT id, updated_at FROM ${table} WHERE id IN (${placeholders})`,
        ids,
      )
      for (const row of rows) result.set(row.id as string, row.updated_at as string)
      return result
    }

    const [
      currentRoutes,
      currentTracks,
      currentWaypoints,
      currentPhotos,
      currentTags,
    ] = await Promise.all([
      currentUpdatedAt('routes', bundle.routes.map(r => r.id)),
      currentUpdatedAt('tracks', bundle.tracks.map(t => t.id)),
      currentUpdatedAt('waypoints', bundle.waypoints.map(w => w.id)),
      currentUpdatedAt('photos', bundle.photos.map(p => p.id)),
      this.client.all(
        `SELECT id FROM tags WHERE id IN (${bundle.tags.map(() => '?').join(',') || 'NULL'})`,
        bundle.tags.map(t => t.id),
      ),
    ])
    const existingTagIds = new Set(currentTags.map(r => r.id as string))

    const ops: SqlOp[] = []

    // Tags — additive. Don't overwrite existing tags (no updated_at to compare).
    for (const tag of bundle.tags) {
      if (existingTagIds.has(tag.id)) continue
      ops.push({
        sql: `INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
        params: [tag.id, tag.name, tag.color, tag.created_at],
      })
    }

    // Routes
    for (const r of bundle.routes) {
      const existingTs = currentRoutes.get(r.id)
      if (existingTs !== undefined && r.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO routes (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                ates, technical_difficulty,
                distance_m, elevation_gain_m, elevation_loss_m,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.routeToRow(r),
      })
    }

    // Tracks
    for (const t of bundle.tracks) {
      const existingTs = currentTracks.get(t.id)
      if (existingTs !== undefined && t.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO tracks (
                id, user_id, name, description, geojson,
                source_hash, source_filename, color,
                distance_m, elevation_gain_m, elevation_loss_m,
                duration_s, moving_time_s, recorded_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.trackToRow(t),
      })
    }

    // Waypoints
    for (const w of bundle.waypoints) {
      const existingTs = currentWaypoints.get(w.id)
      if (existingTs !== undefined && w.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO waypoints (
                id, user_id, name, description,
                lat, lng, elevation_m,
                category, color,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.waypointToRow(w),
      })
    }

    // Photos (metadata only — blobs handled below)
    for (const p of bundle.photos) {
      const existingTs = currentPhotos.get(p.id)
      if (existingTs !== undefined && p.updated_at <= existingTs) continue
      ops.push({
        sql: `INSERT OR REPLACE INTO photos (
                id, user_id, name, description,
                lat, lng, elevation_m,
                camera_lat, camera_lng, camera_elevation_m, bearing,
                blob_ref,
                width, height, file_size_bytes,
                taken_at,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: this.photoToRow(p),
      })
    }

    // Junction rows — INSERT OR IGNORE keeps things additive and idempotent.
    for (const row of bundle.entity_tags) {
      ops.push({
        sql: `INSERT OR IGNORE INTO entity_tags (entity_type, entity_id, tag_id) VALUES (?, ?, ?)`,
        params: [row.entity_type, row.entity_id, row.tag_id],
      })
    }

    if (ops.length > 0) await this.client.tx(ops)

    // Blobs — write outside the SQL transaction (file ops aren't transactional).
    for (const [id, blob] of photos) {
      await this.client.writeBlob(this.photoFullPath(id), await blob.arrayBuffer())
    }
    for (const [id, thumb] of thumbs) {
      await this.client.writeBlob(this.photoThumbPath(id), await thumb.arrayBuffer())
    }
  }
```

You'll need additional imports at the top of `src/storage/opfs.ts`:

```typescript
import type {
  EntityTagRow,
  EntityType,
  ExportBundle,
  Photo,
  Route,
  Tag,
  Track,
  Waypoint,
} from '../types'
import { APP_VERSION } from '../types'
```

- [ ] **Step 2.4.8: Add backup helpers to `src/dev/devConsole.ts`**

Append to the `helper` object:

```typescript
    async exportAll() {
      const result = await storage.exportAll()
      // eslint-disable-next-line no-console
      console.log('[couloir] exported',
        result.bundle.routes.length, 'routes,',
        result.bundle.tracks.length, 'tracks,',
        result.bundle.waypoints.length, 'waypoints,',
        result.bundle.photos.length, 'photos,',
        result.bundle.tags.length, 'tags,',
        result.bundle.entity_tags.length, 'entity_tags rows,',
        result.photos.size, 'full blobs,',
        result.thumbs.size, 'thumb blobs',
      )
      return result
    },

    async reimport(exported: Awaited<ReturnType<typeof storage.exportAll>>) {
      await storage.importAll(exported.bundle, exported.photos, exported.thumbs)
      // eslint-disable-next-line no-console
      console.log('[couloir] re-imported (idempotent if same bundle)')
    },
```

- [ ] **Step 2.4.9: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: clean.

- [ ] **Step 2.4.10: Browser verification — tag CRUD and cascade**

Run: `npm run dev`. In console:

```javascript
const r = await __couloir.createDummyRoute('R')
const tag = { id: crypto.randomUUID(), name: 'Steep', color: '#FF0000', created_at: new Date().toISOString() }
await __couloir.storage.saveTag(tag)
await __couloir.storage.setEntityTags('route', r.id, [tag.id])

const fresh = await __couloir.storage.getRoute(r.id)
fresh.tags                                // -> [tag.id]

await __couloir.storage.deleteTag(tag.id)
const after = await __couloir.storage.getRoute(r.id)
after.tags                                // -> [] (cascade worked)
await __couloir.storage.deleteRoute(r.id)
```

Expected: every assertion holds. The tag's deletion automatically removed the junction row (verified by re-reading the route).

- [ ] **Step 2.4.11: Browser verification — export/import round-trip**

```javascript
// Seed some data:
const r = await __couloir.createDummyRoute('Round-trip route')
const w = await __couloir.createDummyWaypoint('Round-trip wp')
const p = await __couloir.createDummyPhoto('Round-trip photo')

// Export:
const exported = await __couloir.exportAll()
exported.bundle.routes.length             // -> 1
exported.bundle.waypoints.length          // -> 1
exported.bundle.photos.length             // -> 1
exported.photos.size                      // -> 1
exported.thumbs.size                      // -> 1

// Re-import (idempotent — should not duplicate):
await __couloir.reimport(exported)
const all = await __couloir.listAll()
all.routes.length                         // -> 1
all.waypoints.length                      // -> 1
all.photos.length                         // -> 1

// Clean up:
await __couloir.storage.deleteRoute(r.id)
await __couloir.storage.deleteWaypoint(w.id)
await __couloir.storage.deletePhoto(p.id)
```

Expected: all assertions hold. A double-import does not produce duplicates.

- [ ] **Step 2.4.12: Commit**

```bash
git add src/storage/memory.ts src/storage/memory.test.ts src/storage/opfs.ts src/dev/devConsole.ts
git commit -m "$(cat <<'EOF'
feat(storage): tags, setEntityTags, and additive export/import

Tag CRUD on both backends, with the OPFS implementation relying on
ON DELETE CASCADE for junction-row cleanup and the in-memory backend
mirroring the cascade explicitly. exportAll() returns the
{ bundle, photos, thumbs } in-memory shape (Phase 6.4 will wrap it in
ZIP packaging). importAll() is additive: insert if missing, update if
the bundle is newer, skip otherwise — re-importing the same bundle is
a no-op.
EOF
)"
```

---

## Task 2.5 — Zustand store wiring

**Files:**
- Create: `src/storage/provider.ts` (`getStorage`/`setStorage` DI seam)
- Create: `src/utils/time.ts`, `src/utils/time.test.ts`
- Create: `src/store/routes.ts`, `src/store/routes.test.ts`
- Create: `src/store/tracks.ts`, `src/store/tracks.test.ts`
- Create: `src/store/waypoints.ts`, `src/store/waypoints.test.ts`
- Create: `src/store/photos.ts`, `src/store/photos.test.ts`
- Create: `src/store/tags.ts`, `src/store/tags.test.ts`
- Modify: `src/store/ui.ts` (extend with panel + placement state machines)
- Modify: `src/store/ui.test.ts` (add coverage)
- Create: `src/hooks/useEscapeKey.ts`, `src/hooks/useEscapeKey.test.tsx`
- Modify: `src/main.tsx` (proper bootstrap: init storage → fire loads → render)
- Modify: `src/App.tsx` (mount the ESC hook)

The five entity slices follow an identical pattern: `load()` populates from storage, `add()` generates id + timestamps then calls through to storage and inserts into local state, `update()` patches with a new `updated_at`, `delete()` removes through storage and from state. The photos slice's `add()` takes blob + thumb arguments alongside the metadata. All five slices read storage via `getStorage()` so tests can swap in `InMemoryStorageProvider` per `beforeEach`.

The UI slice grows two new state machines (`PanelState`, `PlacementState`) implementing the actions catalogued in `ARCHITECTURE.md` "Panel and placement state". The `useEscapeKey()` hook owns ESC with the precedence in the same section.

- [ ] **Step 2.5.1: Write `src/storage/provider.ts`**

```typescript
import type { StorageProvider } from './interface'
import { StorageNotInitializedError } from './errors'

let current: StorageProvider | null = null

export function setStorage(provider: StorageProvider): void {
  current = provider
}

export function getStorage(): StorageProvider {
  if (!current) throw new StorageNotInitializedError()
  return current
}

/** Test helper. Resets the module-level singleton between tests. */
export function clearStorage(): void {
  current = null
}
```

- [ ] **Step 2.5.2: Write `src/utils/time.ts`**

```typescript
// Centralized "now" so tests can mock the clock with vi.useFakeTimers().
// All ISO 8601 timestamps in Couloir flow through this helper.
export function now(): string {
  return new Date().toISOString()
}
```

- [ ] **Step 2.5.3: Write the failing test `src/utils/time.test.ts`**

```typescript
import { now } from './time'

describe('now', () => {
  it('returns an ISO 8601 timestamp ending in Z', () => {
    expect(now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('honors fake timers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    expect(now()).toBe('2026-05-06T12:00:00.000Z')
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2.5.4: Run the test, verify it passes**

Run: `npm test src/utils/time.test.ts`
Expected: 2 tests passing.

- [ ] **Step 2.5.5: Write `src/store/routes.ts`**

```typescript
import { create } from 'zustand'
import type { Route } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewRouteInput = Omit<Route, 'id' | 'created_at' | 'updated_at'>

interface RoutesState {
  routes: Route[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewRouteInput) => Promise<Route>
  update: (id: string, patch: Partial<Omit<Route, 'id' | 'created_at'>>) => Promise<Route>
  remove: (id: string) => Promise<void>
}

export const useRoutesStore = create<RoutesState>((set, get) => ({
  routes: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const routes = await getStorage().getRoutes()
      set({ routes, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const ts = now()
    const route: Route = { ...input, id: newId(), created_at: ts, updated_at: ts }
    await getStorage().saveRoute(route)
    set((s) => ({ routes: [...s.routes, route] }))
    return route
  },

  update: async (id, patch) => {
    const existing = get().routes.find(r => r.id === id)
    if (!existing) throw new Error(`route ${id} not found`)
    const updated: Route = { ...existing, ...patch, updated_at: now() }
    await getStorage().saveRoute(updated)
    set((s) => ({ routes: s.routes.map(r => r.id === id ? updated : r) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteRoute(id)
    set((s) => ({ routes: s.routes.filter(r => r.id !== id) }))
  },
}))
```

- [ ] **Step 2.5.6: Write the failing test `src/store/routes.test.ts`**

```typescript
import { useRoutesStore } from './routes'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Route } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  geojson: {
    type: 'LineString' as const,
    coordinates: [[-116, 49.5, 1500]] as Array<[number, number, number]>,
  },
  source_hash: 'h',
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
} satisfies Omit<Route, 'id' | 'created_at' | 'updated_at'>

describe('routes store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useRoutesStore.setState({ routes: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('loads an empty list initially', async () => {
    await useRoutesStore.getState().load()
    expect(useRoutesStore.getState().routes).toEqual([])
    expect(useRoutesStore.getState().loading).toBe(false)
  })

  it('add() generates id + timestamps and persists through storage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))

    const route = await useRoutesStore.getState().add(baseInput)
    expect(route.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(route.created_at).toBe('2026-05-06T12:00:00.000Z')
    expect(route.updated_at).toBe(route.created_at)

    expect(useRoutesStore.getState().routes).toHaveLength(1)

    vi.useRealTimers()
  })

  it('add() round-trips through storage on a fresh load', async () => {
    await useRoutesStore.getState().add({ ...baseInput, name: 'Persisted' })
    useRoutesStore.setState({ routes: [] })
    await useRoutesStore.getState().load()
    expect(useRoutesStore.getState().routes[0].name).toBe('Persisted')
  })

  it('update() advances updated_at and writes through', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const r = await useRoutesStore.getState().add(baseInput)

    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await useRoutesStore.getState().update(r.id, { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')
    expect(updated.created_at).toBe('2026-05-06T12:00:00.000Z')

    vi.useRealTimers()
  })

  it('remove() drops from storage and state', async () => {
    const r = await useRoutesStore.getState().add(baseInput)
    await useRoutesStore.getState().remove(r.id)
    expect(useRoutesStore.getState().routes).toEqual([])
  })

  it('captures storage errors without throwing from load', async () => {
    const broken = new InMemoryStorageProvider()
    // Override only the read path to fail; everything else is irrelevant for
    // this test.
    broken.getRoutes = async () => { throw new Error('boom') }
    setStorage(broken)

    await useRoutesStore.getState().load()
    expect(useRoutesStore.getState().error).toMatch(/boom/)
    expect(useRoutesStore.getState().loading).toBe(false)
  })
})
```

- [ ] **Step 2.5.7: Run the test, verify it passes**

Run: `npm test src/store/routes.test.ts`
Expected: 6 tests passing.

- [ ] **Step 2.5.8: Write `src/store/tracks.ts`** (same shape as routes.ts)

```typescript
import { create } from 'zustand'
import type { Track } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewTrackInput = Omit<Track, 'id' | 'created_at' | 'updated_at'>

interface TracksState {
  tracks: Track[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewTrackInput) => Promise<Track>
  update: (id: string, patch: Partial<Omit<Track, 'id' | 'created_at'>>) => Promise<Track>
  remove: (id: string) => Promise<void>
}

export const useTracksStore = create<TracksState>((set, get) => ({
  tracks: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const tracks = await getStorage().getTracks()
      set({ tracks, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const ts = now()
    const track: Track = { ...input, id: newId(), created_at: ts, updated_at: ts }
    await getStorage().saveTrack(track)
    set((s) => ({ tracks: [...s.tracks, track] }))
    return track
  },

  update: async (id, patch) => {
    const existing = get().tracks.find(t => t.id === id)
    if (!existing) throw new Error(`track ${id} not found`)
    const updated: Track = { ...existing, ...patch, updated_at: now() }
    await getStorage().saveTrack(updated)
    set((s) => ({ tracks: s.tracks.map(t => t.id === id ? updated : t) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteTrack(id)
    set((s) => ({ tracks: s.tracks.filter(t => t.id !== id) }))
  },
}))
```

- [ ] **Step 2.5.9: Write `src/store/tracks.test.ts`** (mirror of routes.test.ts — covers add+load round-trip and update advancing updated_at)

```typescript
import { useTracksStore } from './tracks'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Track } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  geojson: {
    type: 'LineString' as const,
    coordinates: [[-116, 49.5, 1500]] as Array<[number, number, number]>,
  },
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
} satisfies Omit<Track, 'id' | 'created_at' | 'updated_at'>

describe('tracks store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useTracksStore.setState({ tracks: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() persists and round-trips through reload', async () => {
    const t = await useTracksStore.getState().add({ ...baseInput, name: 'Persisted' })
    useTracksStore.setState({ tracks: [] })
    await useTracksStore.getState().load()
    expect(useTracksStore.getState().tracks[0].id).toBe(t.id)
  })

  it('update() advances updated_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const t = await useTracksStore.getState().add(baseInput)
    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await useTracksStore.getState().update(t.id, { name: 'Renamed' })
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')
    vi.useRealTimers()
  })

  it('remove() drops from state and storage', async () => {
    const t = await useTracksStore.getState().add(baseInput)
    await useTracksStore.getState().remove(t.id)
    expect(useTracksStore.getState().tracks).toEqual([])
  })
})
```

- [ ] **Step 2.5.10: Run the tracks test, verify it passes**

Run: `npm test src/store/tracks.test.ts`
Expected: 3 tests passing.

- [ ] **Step 2.5.11: Write `src/store/waypoints.ts`**

```typescript
import { create } from 'zustand'
import type { Waypoint } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewWaypointInput = Omit<Waypoint, 'id' | 'created_at' | 'updated_at'>

interface WaypointsState {
  waypoints: Waypoint[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewWaypointInput) => Promise<Waypoint>
  update: (id: string, patch: Partial<Omit<Waypoint, 'id' | 'created_at'>>) => Promise<Waypoint>
  remove: (id: string) => Promise<void>
}

export const useWaypointsStore = create<WaypointsState>((set, get) => ({
  waypoints: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const waypoints = await getStorage().getWaypoints()
      set({ waypoints, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const ts = now()
    const wp: Waypoint = { ...input, id: newId(), created_at: ts, updated_at: ts }
    await getStorage().saveWaypoint(wp)
    set((s) => ({ waypoints: [...s.waypoints, wp] }))
    return wp
  },

  update: async (id, patch) => {
    const existing = get().waypoints.find(w => w.id === id)
    if (!existing) throw new Error(`waypoint ${id} not found`)
    const updated: Waypoint = { ...existing, ...patch, updated_at: now() }
    await getStorage().saveWaypoint(updated)
    set((s) => ({ waypoints: s.waypoints.map(w => w.id === id ? updated : w) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteWaypoint(id)
    set((s) => ({ waypoints: s.waypoints.filter(w => w.id !== id) }))
  },
}))
```

- [ ] **Step 2.5.12: Write `src/store/waypoints.test.ts`**

```typescript
import { useWaypointsStore } from './waypoints'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Waypoint } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  lat: 49.5,
  lng: -116.0,
  elevation_m: 1500,
  category: 'summit' as const,
  color: null,
  tags: [],
} satisfies Omit<Waypoint, 'id' | 'created_at' | 'updated_at'>

describe('waypoints store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() persists and round-trips through reload', async () => {
    const w = await useWaypointsStore.getState().add({ ...baseInput, name: 'Persisted' })
    useWaypointsStore.setState({ waypoints: [] })
    await useWaypointsStore.getState().load()
    expect(useWaypointsStore.getState().waypoints[0].id).toBe(w.id)
  })

  it('update() advances updated_at and merges patch', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const w = await useWaypointsStore.getState().add(baseInput)
    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await useWaypointsStore.getState().update(w.id, { lat: 49.6 })
    expect(updated.lat).toBe(49.6)
    expect(updated.lng).toBe(-116.0)
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')
    vi.useRealTimers()
  })

  it('remove() drops from state and storage', async () => {
    const w = await useWaypointsStore.getState().add(baseInput)
    await useWaypointsStore.getState().remove(w.id)
    expect(useWaypointsStore.getState().waypoints).toEqual([])
  })
})
```

- [ ] **Step 2.5.13: Run the waypoints test, verify it passes**

Run: `npm test src/store/waypoints.test.ts`
Expected: 3 tests passing.

- [ ] **Step 2.5.14: Write `src/store/photos.ts`**

The photos store differs from the others: `add()` takes the full blob and thumb in addition to the metadata input. The store sets `blob_ref` based on the generated id.

```typescript
import { create } from 'zustand'
import type { Photo } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewPhotoInput = Omit<
  Photo,
  'id' | 'created_at' | 'updated_at' | 'blob_ref'
>

interface PhotosState {
  photos: Photo[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewPhotoInput, blob: Blob, thumb: Blob) => Promise<Photo>
  update: (id: string, patch: Partial<Omit<Photo, 'id' | 'created_at' | 'blob_ref'>>) => Promise<Photo>
  remove: (id: string) => Promise<void>
}

export const usePhotosStore = create<PhotosState>((set, get) => ({
  photos: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const photos = await getStorage().getPhotos()
      set({ photos, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input, blob, thumb) => {
    const id = newId()
    const ts = now()
    const photo: Photo = {
      ...input,
      id,
      blob_ref: `photos/${id}.jpg`,
      created_at: ts,
      updated_at: ts,
    }
    await getStorage().savePhoto(photo, blob, thumb)
    set((s) => ({ photos: [...s.photos, photo] }))
    return photo
  },

  update: async (id, patch) => {
    const existing = get().photos.find(p => p.id === id)
    if (!existing) throw new Error(`photo ${id} not found`)
    const updated: Photo = { ...existing, ...patch, updated_at: now() }
    // Re-save with the same blob (blob_ref is unchanged). The existing OPFS
    // file is untouched. We re-write the blob to keep savePhoto's contract
    // simple — if this turns out to be a perf issue we'll add an
    // updatePhotoMetadata path, but for the MVP it's fine.
    const blob = await getStorage().getPhotoBlob(id)
    const thumb = await getStorage().getPhotoThumb(id)
    if (!blob || !thumb) throw new Error(`photo blobs missing for ${id}`)
    await getStorage().savePhoto(updated, blob, thumb)
    set((s) => ({ photos: s.photos.map(p => p.id === id ? updated : p) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deletePhoto(id)
    set((s) => ({ photos: s.photos.filter(p => p.id !== id) }))
  },
}))
```

- [ ] **Step 2.5.15: Write `src/store/photos.test.ts`**

```typescript
import { usePhotosStore } from './photos'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Photo } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  lat: 49.5,
  lng: -116.0,
  elevation_m: 1500,
  camera_lat: 49.499,
  camera_lng: -116.001,
  camera_elevation_m: 1495,
  bearing: 90,
  width: 1024,
  height: 768,
  file_size_bytes: 1024,
  taken_at: null,
  tags: [],
} satisfies Omit<Photo, 'id' | 'created_at' | 'updated_at' | 'blob_ref'>

describe('photos store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    usePhotosStore.setState({ photos: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() seeds blob_ref from the generated id', async () => {
    const blob = new Blob(['full'])
    const thumb = new Blob(['thumb'])
    const p = await usePhotosStore.getState().add(baseInput, blob, thumb)
    expect(p.blob_ref).toBe(`photos/${p.id}.jpg`)
  })

  it('update() advances updated_at without changing blob_ref', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const p = await usePhotosStore.getState().add(
      baseInput, new Blob(['x']), new Blob(['y']),
    )

    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await usePhotosStore.getState().update(p.id, { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
    expect(updated.blob_ref).toBe(p.blob_ref)
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')

    vi.useRealTimers()
  })

  it('remove() drops the photo and its blobs', async () => {
    const p = await usePhotosStore.getState().add(
      baseInput, new Blob(['x']), new Blob(['y']),
    )
    await usePhotosStore.getState().remove(p.id)
    expect(usePhotosStore.getState().photos).toEqual([])
  })
})
```

- [ ] **Step 2.5.16: Run the photos test, verify it passes**

Run: `npm test src/store/photos.test.ts`
Expected: 3 tests passing.

- [ ] **Step 2.5.17: Write `src/store/tags.ts`**

```typescript
import { create } from 'zustand'
import type { EntityType, Tag } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewTagInput = Omit<Tag, 'id' | 'created_at'>

interface TagsState {
  tags: Tag[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewTagInput) => Promise<Tag>
  update: (id: string, patch: Partial<Omit<Tag, 'id' | 'created_at'>>) => Promise<Tag>
  remove: (id: string) => Promise<void>
  setEntityTags: (entityType: EntityType, entityId: string, tagIds: string[]) => Promise<void>
}

export const useTagsStore = create<TagsState>((set, get) => ({
  tags: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const tags = await getStorage().getTags()
      set({ tags, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const tag: Tag = { ...input, id: newId(), created_at: now() }
    await getStorage().saveTag(tag)
    set((s) => ({ tags: [...s.tags, tag] }))
    return tag
  },

  update: async (id, patch) => {
    const existing = get().tags.find(t => t.id === id)
    if (!existing) throw new Error(`tag ${id} not found`)
    const updated: Tag = { ...existing, ...patch }
    await getStorage().saveTag(updated)
    set((s) => ({ tags: s.tags.map(t => t.id === id ? updated : t) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteTag(id)
    set((s) => ({ tags: s.tags.filter(t => t.id !== id) }))
  },

  setEntityTags: async (entityType, entityId, tagIds) => {
    await getStorage().setEntityTags(entityType, entityId, tagIds)
  },
}))
```

- [ ] **Step 2.5.18: Write `src/store/tags.test.ts`**

```typescript
import { useTagsStore } from './tags'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'

describe('tags store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useTagsStore.setState({ tags: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() generates id + created_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#FF0000' })
    expect(tag.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(tag.created_at).toBe('2026-05-06T12:00:00.000Z')
    vi.useRealTimers()
  })

  it('round-trips through load', async () => {
    await useTagsStore.getState().add({ name: 'Steep', color: '#FF0000' })
    useTagsStore.setState({ tags: [] })
    await useTagsStore.getState().load()
    expect(useTagsStore.getState().tags).toHaveLength(1)
  })

  it('remove() drops from state', async () => {
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#FF0000' })
    await useTagsStore.getState().remove(tag.id)
    expect(useTagsStore.getState().tags).toEqual([])
  })
})
```

- [ ] **Step 2.5.19: Run the tags test, verify it passes**

Run: `npm test src/store/tags.test.ts`
Expected: 3 tests passing.

- [ ] **Step 2.5.20: Extend `src/store/ui.ts`** with the panel + placement state machines

Replace the file with:

```typescript
import { create } from 'zustand'
import type { Basemap, EntityDraft, EntityType } from '../types'

const TERRAIN_KEY  = 'couloir_terrain_exaggeration'
const BASEMAP_KEY  = 'couloir_basemap'
const VALID_BASEMAPS: ReadonlySet<Basemap> = new Set(['satellite', 'outdoor', 'winter'])
const MIN = 1
const MAX = 3

export type SidebarTab = 'layers' | 'search' | 'settings'
export type LayerKey = 'routes' | 'tracks' | 'waypoints' | 'photos'

// Panel and placement state machines per ARCHITECTURE.md.
export type PanelState =
  | { mode: 'idle' }
  | { mode: 'view';   entityType: EntityType; entityId: string }
  | { mode: 'edit';   entityType: EntityType; entityId: string; draft: EntityDraft }
  | { mode: 'create'; entityType: 'waypoint' | 'photo'; draft: EntityDraft }

export interface PhotoPlacementContext {
  blob: Blob
  preview: string                // object URL for the in-flight thumbnail
  exif: Record<string, unknown>  // shape lands in Phase 5; opaque for now
}

export type PlacementState =
  | { mode: 'idle' }
  | { mode: 'waypoint' }
  | { mode: 'photo'; ctx: PhotoPlacementContext }

interface UiState {
  // Phase 1 surface
  activeTab: SidebarTab
  sidebarCollapsed: boolean
  terrainEnabled: boolean
  terrainExaggeration: number
  activeBasemap: Basemap
  layerVisibility: Record<LayerKey, boolean>
  setActiveTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  toggleTerrain: () => void
  setTerrainExaggeration: (value: number) => void
  setBasemap: (basemap: Basemap) => void
  toggleLayer: (layer: LayerKey) => void
  hydrateFromStorage: () => void

  // Phase 2 surface — panel + placement state machines
  panel: PanelState
  placement: PlacementState
  openEntity: (entityType: EntityType, entityId: string) => void
  editCurrent: (initialDraft?: EntityDraft) => void
  closePanel: () => void
  startWaypointPlacement: () => void
  startPhotoPlacement: (ctx: PhotoPlacementContext) => void
  completePlacement: (lat: number, lng: number) => void
  cancelPlacement: () => void
  updateDraft: (patch: EntityDraft) => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))

export const useUiStore = create<UiState>((set, get) => ({
  // ----- Phase 1 fields (unchanged behavior) -----
  activeTab: 'layers',
  sidebarCollapsed: false,
  terrainEnabled: true,
  terrainExaggeration: 1.5,
  activeBasemap: 'outdoor',
  layerVisibility: { routes: true, tracks: true, waypoints: true, photos: true },
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTerrain: () => set((s) => ({ terrainEnabled: !s.terrainEnabled })),
  setTerrainExaggeration: (value) => {
    const next = clamp(value)
    localStorage.setItem(TERRAIN_KEY, String(next))
    set({ terrainExaggeration: next })
  },
  setBasemap: (basemap) => {
    localStorage.setItem(BASEMAP_KEY, basemap)
    set({ activeBasemap: basemap })
  },
  toggleLayer: (layer) =>
    set((s) => ({
      layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] },
    })),
  hydrateFromStorage: () => {
    const rawTerrain = localStorage.getItem(TERRAIN_KEY)
    if (rawTerrain !== null) {
      const n = Number(rawTerrain)
      if (Number.isFinite(n)) set({ terrainExaggeration: clamp(n) })
    }
    const rawBasemap = localStorage.getItem(BASEMAP_KEY)
    if (rawBasemap && VALID_BASEMAPS.has(rawBasemap as Basemap)) {
      set({ activeBasemap: rawBasemap as Basemap })
    }
  },

  // ----- Phase 2 fields: panel + placement -----
  panel: { mode: 'idle' },
  placement: { mode: 'idle' },

  openEntity: (entityType, entityId) => {
    set({
      panel: { mode: 'view', entityType, entityId },
      // Opening an entity always cancels any in-flight placement.
      placement: { mode: 'idle' },
    })
  },

  editCurrent: (initialDraft = {}) => {
    const cur = get().panel
    if (cur.mode !== 'view') {
      // Defensive: editCurrent is only valid from view mode. Silently no-op
      // rather than throw so a misfired UI event doesn't crash the app.
      return
    }
    set({
      panel: {
        mode: 'edit',
        entityType: cur.entityType,
        entityId: cur.entityId,
        draft: initialDraft,
      },
    })
  },

  closePanel: () => set({ panel: { mode: 'idle' } }),

  startWaypointPlacement: () => set({ placement: { mode: 'waypoint' } }),

  startPhotoPlacement: (ctx) => set({ placement: { mode: 'photo', ctx } }),

  completePlacement: (lat, lng) => {
    const cur = get().placement
    if (cur.mode === 'idle') return
    const draft: EntityDraft =
      cur.mode === 'waypoint'
        ? { lat, lng }
        : { lat, lng, blob_ref: '' /* set on save */ }
    set({
      placement: { mode: 'idle' },
      panel: { mode: 'create', entityType: cur.mode, draft },
    })
  },

  cancelPlacement: () => set({ placement: { mode: 'idle' } }),

  updateDraft: (patch) => {
    const cur = get().panel
    if (cur.mode === 'edit') {
      set({ panel: { ...cur, draft: { ...cur.draft, ...patch } } })
    } else if (cur.mode === 'create') {
      set({ panel: { ...cur, draft: { ...cur.draft, ...patch } } })
    }
  },
}))
```

- [ ] **Step 2.5.21: Extend `src/store/ui.test.ts`** with panel + placement coverage

Append after the existing tests:

```typescript
describe('ui store — panel state machine', () => {
  beforeEach(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })

  it('openEntity moves to view mode', () => {
    useUiStore.getState().openEntity('route', 'r1')
    expect(useUiStore.getState().panel).toEqual({
      mode: 'view',
      entityType: 'route',
      entityId: 'r1',
    })
  })

  it('opening an entity cancels any in-flight placement', () => {
    useUiStore.getState().startWaypointPlacement()
    useUiStore.getState().openEntity('route', 'r1')
    expect(useUiStore.getState().placement).toEqual({ mode: 'idle' })
  })

  it('editCurrent transitions view → edit', () => {
    useUiStore.getState().openEntity('waypoint', 'w1')
    useUiStore.getState().editCurrent({ name: 'Initial draft name' })
    const panel = useUiStore.getState().panel
    expect(panel.mode).toBe('edit')
    if (panel.mode === 'edit') {
      expect(panel.entityType).toBe('waypoint')
      expect(panel.entityId).toBe('w1')
      expect(panel.draft).toEqual({ name: 'Initial draft name' })
    }
  })

  it('editCurrent is a no-op when not in view mode', () => {
    useUiStore.getState().editCurrent({ name: 'x' })
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('closePanel returns to idle from any mode', () => {
    useUiStore.getState().openEntity('route', 'r1')
    useUiStore.getState().closePanel()
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('updateDraft merges into the current edit/create draft', () => {
    useUiStore.getState().openEntity('waypoint', 'w1')
    useUiStore.getState().editCurrent({ name: 'A' })
    useUiStore.getState().updateDraft({ description: 'B' })
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'edit') throw new Error('expected edit mode')
    expect(panel.draft).toEqual({ name: 'A', description: 'B' })
  })
})

describe('ui store — placement state machine', () => {
  beforeEach(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })

  it('startWaypointPlacement enters waypoint mode', () => {
    useUiStore.getState().startWaypointPlacement()
    expect(useUiStore.getState().placement).toEqual({ mode: 'waypoint' })
  })

  it('completePlacement(lat, lng) opens the create panel and clears placement', () => {
    useUiStore.getState().startWaypointPlacement()
    useUiStore.getState().completePlacement(49.5, -116.0)
    const state = useUiStore.getState()
    expect(state.placement).toEqual({ mode: 'idle' })
    expect(state.panel.mode).toBe('create')
    if (state.panel.mode === 'create') {
      expect(state.panel.entityType).toBe('waypoint')
      expect(state.panel.draft).toMatchObject({ lat: 49.5, lng: -116.0 })
    }
  })

  it('completePlacement is a no-op when no placement is active', () => {
    useUiStore.getState().completePlacement(49.5, -116.0)
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('cancelPlacement clears placement without touching the panel', () => {
    useUiStore.getState().openEntity('route', 'r1')
    useUiStore.getState().startWaypointPlacement()
    useUiStore.getState().cancelPlacement()
    const state = useUiStore.getState()
    expect(state.placement).toEqual({ mode: 'idle' })
    expect(state.panel.mode).toBe('view')
  })

  it('startPhotoPlacement carries blob/exif/preview through to create draft', () => {
    const blob = new Blob(['x'])
    useUiStore.getState().startPhotoPlacement({
      blob,
      preview: 'blob:http://localhost/abc',
      exif: { Orientation: 1 },
    })
    expect(useUiStore.getState().placement).toEqual({
      mode: 'photo',
      ctx: { blob, preview: 'blob:http://localhost/abc', exif: { Orientation: 1 } },
    })
    useUiStore.getState().completePlacement(49.5, -116.0)
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'create') throw new Error('expected create mode')
    expect(panel.entityType).toBe('photo')
    expect(panel.draft).toMatchObject({ lat: 49.5, lng: -116.0 })
  })
})
```

- [ ] **Step 2.5.22: Run the full ui store test, verify it passes**

Run: `npm test src/store/ui.test.ts`
Expected: previous Phase 1 tests still pass; the 11 new panel/placement tests pass.

- [ ] **Step 2.5.23: Write `src/hooks/useEscapeKey.ts`**

```typescript
import { useEffect } from 'react'
import { useUiStore } from '../store/ui'

// Global ESC handler implementing the precedence in ARCHITECTURE.md
// "Global ESC key handler":
//   1. If placement is active, cancel placement.
//   2. Else if panel is in edit mode, exit to view.
//   3. Else if panel is open, close it.
//   4. Else no-op.
export function useEscapeKey(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      const { panel, placement, cancelPlacement, closePanel, openEntity } =
        useUiStore.getState()

      if (placement.mode !== 'idle') {
        cancelPlacement()
        event.preventDefault()
        return
      }
      if (panel.mode === 'edit') {
        // Exit edit → view by re-issuing openEntity with the same identity.
        openEntity(panel.entityType, panel.entityId)
        event.preventDefault()
        return
      }
      if (panel.mode !== 'idle') {
        closePanel()
        event.preventDefault()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
```

- [ ] **Step 2.5.24: Write the failing test `src/hooks/useEscapeKey.test.tsx`**

```typescript
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEscapeKey } from './useEscapeKey'
import { useUiStore } from '../store/ui'

function Harness() {
  useEscapeKey()
  return null
}

describe('useEscapeKey precedence', () => {
  beforeEach(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })

  it('cancels placement first when both placement and panel are active', async () => {
    useUiStore.getState().openEntity('waypoint', 'w1')
    useUiStore.getState().editCurrent({ name: 'x' })
    useUiStore.getState().startWaypointPlacement()
    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    const state = useUiStore.getState()
    expect(state.placement).toEqual({ mode: 'idle' })
    // Panel should still be in edit mode — only placement was cancelled.
    expect(state.panel.mode).toBe('edit')
  })

  it('exits edit to view when only the panel is in edit mode', async () => {
    useUiStore.getState().openEntity('route', 'r1')
    useUiStore.getState().editCurrent({})
    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    const panel = useUiStore.getState().panel
    expect(panel.mode).toBe('view')
    if (panel.mode === 'view') {
      expect(panel.entityId).toBe('r1')
    }
  })

  it('closes the panel from view mode', async () => {
    useUiStore.getState().openEntity('route', 'r1')
    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('does nothing when both placement and panel are idle', async () => {
    render(<Harness />)
    await userEvent.keyboard('{Escape}')
    const state = useUiStore.getState()
    expect(state.panel).toEqual({ mode: 'idle' })
    expect(state.placement).toEqual({ mode: 'idle' })
  })

  it('ignores non-Escape keys', async () => {
    useUiStore.getState().openEntity('route', 'r1')
    render(<Harness />)
    await userEvent.keyboard('a')
    expect(useUiStore.getState().panel.mode).toBe('view')
  })
})
```

- [ ] **Step 2.5.25: Run the ESC hook test, verify it passes**

Run: `npm test src/hooks/useEscapeKey.test.tsx`
Expected: 5 tests passing.

- [ ] **Step 2.5.26: Mount the ESC hook in `src/App.tsx`**

```typescript
import styles from './App.module.css'
import { Sidebar } from './panels/Sidebar'
import { MapView } from './map/MapView'
import { SettingsPanel } from './panels/SettingsPanel/SettingsPanel'
import { LayerPanel } from './panels/LayerPanel/LayerPanel'
import { useEscapeKey } from './hooks/useEscapeKey'

export default function App() {
  useEscapeKey()
  return (
    <div className={styles.app}>
      <Sidebar
        panels={{
          layers:   <LayerPanel />,
          settings: <SettingsPanel />,
        }}
      />
      <div data-testid="map-area" className={styles.mapArea}>
        <MapView />
      </div>
    </div>
  )
}
```

- [ ] **Step 2.5.27: Replace `src/main.tsx`** with the production bootstrap

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme.css'
import { OPFSStorageProvider } from './storage/opfs'
import { setStorage } from './storage/provider'
import { useRoutesStore } from './store/routes'
import { useTracksStore } from './store/tracks'
import { useWaypointsStore } from './store/waypoints'
import { usePhotosStore } from './store/photos'
import { useTagsStore } from './store/tags'
import { useUiStore } from './store/ui'
import { useSettingsStore } from './store/settings'
import { installDevConsole } from './dev/devConsole'

async function bootstrap(): Promise<void> {
  const storage = new OPFSStorageProvider()
  // ensureSchema runs inside init(); blocks first render so we never read
  // from a database that's not yet at SCHEMA_VERSION.
  await storage.init()
  setStorage(storage)

  // Hydrate localStorage-backed slices synchronously before first render.
  useSettingsStore.getState().hydrateFromStorage()
  useUiStore.getState().hydrateFromStorage()

  // Fire entity loads in parallel; they update slice state when done.
  // Components show empty/loading state until the relevant slice fills in.
  void useRoutesStore.getState().load()
  void useTracksStore.getState().load()
  void useWaypointsStore.getState().load()
  void usePhotosStore.getState().load()
  void useTagsStore.getState().load()

  if (import.meta.env.DEV) installDevConsole(storage)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[couloir] bootstrap failed:', err)
  document.body.innerHTML =
    '<pre style="color:#e6e8ec;background:#0e1014;padding:24px;font-family:ui-monospace">' +
    'Couloir failed to start.\n\n' + String(err) +
    '</pre>'
})
```

- [ ] **Step 2.5.28: Run typecheck and the full test suite**

Run: `npm run typecheck && npm test`
Expected: clean. The full suite now contains route/track/waypoint/photo/tag store tests (~18 new), ui state-machine tests (11 new), the ESC hook (5 new), `time` (2 new) — plus everything from Phase 1 and Tasks 2.1–2.4.

- [ ] **Step 2.5.29: Browser verification — bootstrap and Zustand hydration**

Run: `npm run dev`. Open http://localhost:5173. Open DevTools console.

```javascript
// The dev console is installed once storage init completes:
__couloir              // -> object with createDummyRoute, createDummyTrack, etc.

// Add a route via the Zustand store (not via the dev helper directly):
const stores = {
  routes:    (await import('/src/store/routes.ts')).useRoutesStore,
  tracks:    (await import('/src/store/tracks.ts')).useTracksStore,
  waypoints: (await import('/src/store/waypoints.ts')).useWaypointsStore,
  photos:    (await import('/src/store/photos.ts')).usePhotosStore,
  tags:      (await import('/src/store/tags.ts')).useTagsStore,
}

const r = await stores.routes.getState().add({
  user_id: 'local',
  name: 'Bootstrap test',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116.01, 49.51, 1600]] },
  source_hash: 'bootstrap-' + crypto.randomUUID(),
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 100,
  elevation_gain_m: 100,
  elevation_loss_m: 0,
  tags: [],
})
stores.routes.getState().routes.length    // -> 1 (in-memory state updated)
```

Reload the page, then:

```javascript
const stores = {
  routes: (await import('/src/store/routes.ts')).useRoutesStore,
}
// Allow load() to complete — it runs in main.tsx after init.
await new Promise(r => setTimeout(r, 200))
stores.routes.getState().routes.length    // -> 1 (loaded from OPFS)
stores.routes.getState().routes[0].name   // -> 'Bootstrap test'

await stores.routes.getState().remove(stores.routes.getState().routes[0].id)
```

Expected: the route persisted across the reload and was loaded from storage into the Zustand slice without manual intervention.

- [ ] **Step 2.5.30: Browser verification — panel + placement state machine and ESC**

```javascript
const ui = (await import('/src/store/ui.ts')).useUiStore

ui.getState().openEntity('route', 'fake-id')
ui.getState().panel.mode                  // -> 'view'

// ESC closes the panel:
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
ui.getState().panel.mode                  // -> 'idle'

ui.getState().startWaypointPlacement()
ui.getState().placement.mode              // -> 'waypoint'

// ESC cancels placement before touching the panel:
ui.getState().openEntity('route', 'fake-id')
ui.getState().startWaypointPlacement()
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
ui.getState().placement.mode              // -> 'idle'
ui.getState().panel.mode                  // -> 'view' (unchanged)

window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
ui.getState().panel.mode                  // -> 'idle' (now closed)
```

Expected: every transition matches.

- [ ] **Step 2.5.31: Commit**

```bash
git add src/storage/provider.ts src/utils/time.ts src/utils/time.test.ts src/store/ src/hooks/ src/main.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(store): Zustand wiring for all entities + panel/placement state machines

Adds per-entity slices (routes, tracks, waypoints, photos, tags) that
generate ids and ISO 8601 timestamps at write time and proxy CRUD through
StorageProvider via a getStorage() / setStorage() DI seam. Extends the UI
slice with the PanelState and PlacementState discriminated unions and
their explicit transition actions per ARCHITECTURE.md. Adds useEscapeKey()
implementing the placement → edit-exit → close-panel precedence. main.tsx
now bootstraps the OPFS provider, hydrates localStorage-backed slices,
fires entity loads in parallel, then renders.
EOF
)"
```

---

## End-of-phase verification

- [ ] **Run typecheck, tests, and a production build**

```
npm run typecheck
npm test
npm run build
```

All three should complete cleanly. The `dist/` folder should contain `assets/wa-sqlite-*.wasm` (Vite copies the wasm with a hash). If the build fails to find the wasm asset, double-check the `?url` import in `src/storage/workerHost.ts` and the `optimizeDeps.exclude` line in `vite.config.ts`.

- [ ] **End-to-end browser smoke test against the Phase 2 acceptance criteria**

`npm run dev`. With the dev console available:

```javascript
// Task 2.1 — schema migration is idempotent.
await __couloir.storage['client'].one('SELECT version FROM schema_version')
// -> { version: 1 }

// Task 2.2 — route + track lifecycle and source_hash lookup.
const r = await __couloir.createDummyRoute('E2E route')
const t = await __couloir.createDummyTrack('E2E track')
const renamed = await __couloir.renameRoute(r.id, 'E2E route renamed')
renamed.updated_at > r.updated_at                                    // -> true
;(await __couloir.storage.getRouteBySourceHash(r.source_hash))?.id   // -> r.id
;(await __couloir.storage.getTrackBySourceHash(t.source_hash))?.id   // -> t.id

// Task 2.3 — waypoint and photo with OPFS blobs.
const w = await __couloir.createDummyWaypoint('E2E wp')
const p = await __couloir.createDummyPhoto('E2E photo')
;(await __couloir.storage.getPhotoBlob(p.id))?.size                  // -> > 0
;(await __couloir.storage.getPhotoThumb(p.id))?.size                 // -> > 0

// Task 2.4 — tags with cascade and additive backup.
const tag = { id: crypto.randomUUID(), name: 'E2E tag', color: '#FF8800', created_at: new Date().toISOString() }
await __couloir.storage.saveTag(tag)
await __couloir.storage.setEntityTags('route', renamed.id, [tag.id])
;(await __couloir.storage.getRoute(renamed.id))?.tags                // -> [tag.id]
await __couloir.storage.deleteTag(tag.id)
;(await __couloir.storage.getRoute(renamed.id))?.tags                // -> [] (cascade)

const exported = await __couloir.exportAll()
exported.bundle.routes.length >= 1                                   // -> true
await __couloir.reimport(exported)                                   // idempotent
const after = await __couloir.listAll()
after.routes.length === exported.bundle.routes.length                // -> true
```

Reload the page and re-run `__couloir.listAll()` — counts should be unchanged. Then clean up:

```javascript
const all = await __couloir.listAll()
for (const r of all.routes)    await __couloir.storage.deleteRoute(r.id)
for (const t of all.tracks)    await __couloir.storage.deleteTrack(t.id)
for (const w of all.waypoints) await __couloir.storage.deleteWaypoint(w.id)
for (const p of all.photos)    await __couloir.storage.deletePhoto(p.id)
```

DevTools → Application → Storage → Origin Private File System → `photos/` should be empty after this.

- [ ] **(Optional) Tag the commit**

```
git tag phase-2-storage
```

This phase is the foundation Phase 3 (GPX import) builds on.

---

## Notes for the implementer

**Why a Worker hosts wa-sqlite.** `OPFSCoopSyncVFS` uses `FileSystemSyncAccessHandle.read` / `.write` to talk to OPFS. In Safari and Firefox those handles can only be obtained inside a `DedicatedWorkerGlobalScope`. Even Chrome's main-thread support is recent (M108+). Putting wa-sqlite in a worker from day one means we don't pay the cost twice when the next browser ships.

**Why two storage implementations exist.** `InMemoryStorageProvider` isn't a "test stub" in the apologetic sense — it's a first-class implementation that satisfies `StorageProvider`. Vitest runs in jsdom which has no OPFS, so we need *some* storage backend to test the Zustand layer; making it a fully-spec'd implementation means contract drift is caught by the same tests that exercise the Zustand slices. When sync arrives (per `ARCHITECTURE.md` "Future Sync Architecture"), a third `SyncStorageProvider` joins the family with no test infrastructure changes.

**Why we hand-roll RPC instead of using Comlink.** The surface is small (8 message types), and adding a dependency for ~40 lines of code crosses the "don't add dependencies without flagging it" line in `CLAUDE.md`. If the surface grows past ~15 message types or if we want streaming results, revisit.

**Why `saveX(entity)` writes both the row and the entity_tags rows.** Otherwise every Zustand `update({ tags })` call would need to be paired with a `setEntityTags()` call from feature code, with the responsibility of putting both inside a transaction falling on the caller. Bundling them keeps the consistency invariant inside the storage layer where it belongs. `setEntityTags` stays on the interface for the rare callers (Phase 6.1 tag management) that want to change tags without re-saving the row.

**Why `importAll()` is additive.** The architecture's import semantics (insert if missing, update if newer, skip otherwise) are designed for the user who restores a backup onto a device that has been used in the meantime — perhaps after exporting from desktop and importing into a freshly cloned workspace. Destructive import would silently destroy work that hasn't been exported yet. If a user really wants "wipe and replace", the recovery path is to delete the OPFS database first, then import.

**Why all timestamps come from `now()`, not SQL `DEFAULT (datetime('now'))`.** Two reasons: (1) we want millisecond precision and the `Z` suffix, which `datetime('now')` doesn't give; (2) when the data syncs to Postgres later, having timestamps generated by client code makes ordering deterministic across devices in a way that server-side defaults don't.

**Why the dev console is the test harness instead of a `__dev__` panel.** TASKS.md offered either a console helper or a hidden panel; the helper is ~200 lines of code and zero pixels. Phase 6 will likely add a real "Storage" debug panel under Settings if the volume of one-off verifications grows.

**OPFS quota and recovery.** Chrome incognito gives ~100 MB of OPFS, regular Chrome gives much more (browser-managed). If `savePhoto` ever throws a `QuotaExceededError` in a real workflow, the user-facing recovery path is the export bundle (Phase 6.4); we do *not* try to grow the quota or fall back to IndexedDB.

**Single-tab limitation.** `OPFSCoopSyncVFS` holds one access handle per page. Opening Couloir in a second tab will fail to acquire the handle. This is documented in `ARCHITECTURE.md` and is acceptable for a single-user app. If multi-tab use becomes a real workflow, the recommended fix is `BroadcastChannel`-based coordination — out of scope for the MVP.

**Worker error surfacing.** The current `WorkerClient.onMessage` rejects pending promises with `new Error(msg.error)` — the original error class is lost across the postMessage boundary (only its `String()` form survives). For `SchemaVersionError` specifically the worker prefixes the message with `"SchemaVersionError: "` so the calling code can string-match if it needs to. If we ever need richer error typing, the next step is to send a `name` alongside `error` and reconstruct the right class on the main thread.










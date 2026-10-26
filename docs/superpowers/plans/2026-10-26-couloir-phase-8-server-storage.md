# Couloir Phase 8 — Server Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leave browser-only and Unraid-only verification steps unticked unless you actually ran them.

**Goal:** Move Couloir's data out of browser OPFS and onto a small self-hosted server: one Docker container on Unraid that serves both the SPA and a JSON/blob API, backed by SQLite and photo files on a volume. The app then works from any computer on the network, and losing a browser profile no longer loses data.

**Decisions taken in planning (2026-10-26):**

1. **Server-authoritative, online-only.** The browser no longer stores entity data. Offline field use is deferred (see "Out of scope"). The schema is already sync-aware (`updated_at`, UUIDs), so a later offline/sync phase stays possible.
2. **OPFS is removed, not kept as a mode.** One storage path to test on every schema change. Existing data moves across with the ZIP export/import from Phase 6.4. The last OPFS commit is tagged `last-opfs` so the old build can always be checked out to recover a backup.
3. **One SQL implementation, two backends.** `OPFSStorageProvider` is already plain SQL over a tiny async client (`all`/`one`/`run`/`tx`/`writeBlob`/`readBlob`/`deleteBlob`). That logic becomes `SqlStorageProvider`, parameterised by a `SqlBackend` interface. The server runs it on a `node:sqlite` + filesystem backend. Same SQL, same row mapping, same `importAll` merge rules, same migration files.
4. **`node:sqlite`, not `better-sqlite3`.** Built into Node (unflagged since 22.13), so there's no native module to compile in Docker and no new dependency. `better-sqlite3` is the fallback if Task 8.0 finds a blocker.
5. **Hono for HTTP.** New runtime deps: `hono` (^4.13) and `@hono/node-server` (^2.1). New dev dep: `@types/node`. **These are the only new dependencies, approved by the user 2026-10-26.** `wa-sqlite` is removed.
6. **The `StorageProvider` interface does not change.** The browser gets an `HttpStorageProvider` that implements it over `fetch`. Feature code, stores and components are untouched.
7. **No users yet, but `user_id` is already there.** Every entity table has had `user_id TEXT NOT NULL DEFAULT 'local'` since migration 1. There are no per-user directories and no auth in this phase. Photos are keyed by UUID, so `photos/{id}.jpg` never collides. Multi-user later means forward-auth (`Remote-User` header) plus filtering by `user_id` in the server's data layer.
8. **Contract tests are the safety net.** `memory.test.ts` becomes a shared `storageContract(makeProvider)` suite that runs against three providers: `InMemoryStorageProvider`; `SqlStorageProvider` on `node:sqlite` in a temp dir; and `HttpStorageProvider` → in-process Hono app → `SqlStorageProvider`. Hono's `app.fetch` is injected as the `fetch` function, so there is no network or port in tests.
9. **One dev process.** In dev, a small Vite plugin mounts the Hono app as middleware (`configureServer` + `server.ssrLoadModule`), so `npm run dev` still serves everything on :5173 with no proxy and no second terminal. In production, `server/main.ts` serves `dist/` plus `/api`.
10. **The server is bundled by Vite** (`vite build --ssr server/main.ts`, `ssr.noExternal: true`). That handles the migrations' `?raw` imports and inlines `hono` into one file, so the runtime image needs no `node_modules`.
11. **Last-write-wins.** `PUT` is an upsert, exactly like `save*` today. Two computers editing the same route at the same moment is rare enough for a personal app. A `409` stale-write check (send the loaded `updated_at`) is a follow-up if it ever bites.
12. **HTTPS is deferred, so the app must work over plain HTTP.** On `http://unraid:8080`, `crypto.randomUUID` is unavailable (it needs a secure context) and the service worker won't register. `newId()` falls back to a v4 UUID built from `crypto.getRandomValues`, which works in insecure contexts. SW registration failure is caught and ignored. `docs/DEPLOY.md` documents both Tailscale (`tailscale serve`) and the reverse-proxy options for when HTTPS is wanted.
13. **The server validates IDs before touching the filesystem.** There's no auth, but path traversal through `/api/photos/:id` must be impossible. IDs must match `^[A-Za-z0-9_-]{1,64}$` (UUIDs plus the test/dummy IDs like `route-1`), or the request gets a 400.
14. **Backups are in-process.** WAL mode. Once a day and on startup, `VACUUM INTO /data/backups/couloir-YYYYMMDD.db`, keeping the newest `BACKUP_KEEP` (default 14). Photos are already plain immutable files on the volume, so Unraid's appdata backup covers them. No cron and no extra container.
15. **Images ship to GHCR.** A GitHub Actions workflow runs typecheck and tests, then builds and pushes `ghcr.io/rprouse/couloir:latest` and `:sha-<short>` on every push to `main`. An Unraid container template lives in the repo.
16. **The Maptiler key can come from the server.** If `MAPTILER_KEY` is set, `GET /api/config` returns it and the client uses it when `localStorage` has no key, so a new computer works without re-entering it. A key typed in Settings still overrides it. The key is exposed to every client either way, so nothing is lost.

**Spec references:** `ARCHITECTURE.md` (Guiding Principles, Storage Interface, VFS Choice and OPFS Caveats), `DATA-MODEL.md` (schema, Schema Versioning, sync-deferred items), `TASKS.md` Tasks 8.0–8.10, Post-MVP Backlog ("Cloud sync", "Photo blob sync", "Multi-user support with auth").

**Out of scope:** offline use or caching of entity data, two-way sync, auth and multi-user, stale-write (409) detection, HTTPS termination inside the container, streaming the ZIP import (the import request is buffered in memory — fine at personal-library scale), paginated or bounding-box queries.

---

## Target layout

```
couloir/
├── server/
│   ├── main.ts               8.5  production entry: env → backend → app → listen; SIGTERM
│   ├── app.ts / app.test.ts  8.3  createApp({ storage, config }) → Hono app; all /api routes
│   ├── nodeBackend.ts / .test.ts  8.2  SqlBackend over node:sqlite + fs (DATA_DIR)
│   ├── backups.ts / .test.ts 8.7  VACUUM INTO + retention
│   ├── devPlugin.ts          8.5  Vite plugin: mount the app as dev middleware
│   └── tsconfig.json         8.0  Node types, includes server/ + shared src/storage, src/types
├── src/storage/
│   ├── interface.ts                unchanged
│   ├── sqlBackend.ts         8.1  SqlBackend interface + SqlValue/SqlRow/SqlOp types
│   ├── sqlProvider.ts        8.1  SqlStorageProvider (lifted from opfs.ts)
│   ├── schema.ts / .test.ts  8.1  ensureSchema(backend) (lifted from workerHost.ts)
│   ├── http.ts               8.4  HttpStorageProvider
│   ├── contract.ts           8.1  storageContract(name, makeProvider) shared suite
│   ├── memory.ts                   unchanged; memory.test.ts → runs the contract
│   ├── migrations/                 unchanged; shared by browser types and server
│   └── opfs.ts, workerHost.ts, workerClient*.ts, workerProtocol.ts, wa-sqlite.d.ts   deleted in 8.6
├── Dockerfile, .dockerignore                     8.8
├── .github/workflows/docker.yml                  8.8
├── deploy/unraid/couloir.xml                     8.8
└── docs/DEPLOY.md                                8.8
```

**Conventions** (carried forward):
- Vitest globals. Server test files start with `// @vitest-environment node`. Plain `npm test` works; fall back to `npx vitest run --pool=forks --poolOptions.forks.singleFork=true` if esbuild hangs on Windows.
- `git` only through the PowerShell tool. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One feature commit per task, with the plan and TASKS.md ticks folded in.

**Branch:** `git switch -c phase-8-server-storage` from an up-to-date `main` before Task 8.0. (Phase 7 still has 7.0 and 7.6 open. They're browser-only and independent of this work, so they can be finished before or after.)

---

## Task 8.0 — Spike: toolchain compatibility

Prove the three risky seams before writing real code. Throwaway code. Record the findings under this task.

- [x] **Step 8.0.1:** `npm i hono@^4.13 @hono/node-server@^2.1` and `npm i -D @types/node@^24`. Add `server/tsconfig.json` (`types: ["node"]`, `lib: ["ES2022"]`, includes `server/**` and the shared `src/storage/**`, `src/types/**`) and extend `npm run typecheck` to `tsc --noEmit && tsc --noEmit -p server`.
- [x] **Step 8.0.2:** A Vitest file with `// @vitest-environment node` that does `import { DatabaseSync } from 'node:sqlite'`, creates a table and round-trips a row. **Watch for:** Vite 5 not recognising `node:sqlite` as a builtin (it's prefix-only, like `node:test`). Fixes, in order: `ssr.external: ['node:sqlite']` / `server.deps.external` in `vitest.config.ts`; load it via `createRequire(import.meta.url)('node:sqlite')`; otherwise switch to `better-sqlite3` (flag to the user first — it's a native dep).
- [x] **Step 8.0.3:** `vite build --ssr` on a stub `server/main.ts` that imports `node:sqlite`, a migration `?raw` file and `hono`, with `ssr.noExternal: true`. Run `node dist-server/main.js` and confirm it starts and answers `GET /api/health`.
- [x] **Step 8.0.4:** Stub `devPlugin.ts`: in `configureServer`, `server.middlewares.use('/api', …)` that adapts `app.fetch` with `getRequestListener` from `@hono/node-server`, loading the app via `server.ssrLoadModule('/server/app.ts')` on each request so edits hot-reload. Confirm `curl localhost:5173/api/health` works under `npm run dev`.
- [x] **Step 8.0.5:** Note the Node version used in the Docker image (`node:24-alpine`, or newer if needed for `node:sqlite`), and whether `node:sqlite` prints an `ExperimentalWarning` at startup (harmless; suppress with `--disable-warning=ExperimentalWarning` in the container `CMD` if so).

> **Findings (2026-10-26, Node 26.12 locally):**
> - **`node:sqlite` can't be statically imported anywhere Vite or Vitest 2 loads code.** vite-node hard-codes `node:test` as its only prefix-only builtin and strips `node:` from everything else, so a resolver plugin can't help. Fix: `server/sqlite.ts` loads it through `createRequire(import.meta.url)('node:sqlite')` and re-exports `DatabaseSync` (value and type). **All server code imports `DatabaseSync` from `./sqlite`, never from `node:sqlite`.** That works the same under Vitest, the dev middleware and the bundle. No `better-sqlite3` needed.
> - The shared migrations run on `node:sqlite`, and `COUNT(*)`/`INTEGER` columns come back as `number`.
> - **The server bundle has its own config, `vite.server.config.ts`** (`build.ssr`, `ssr.noExternal: true`, `publicDir: false`, output `dist-server/main.js`), so the React and PWA plugins never touch it. Build with `vite build -c vite.server.config.ts` (not `--ssr` on the main config). The output is ~103 KB. It ran from a directory with no `node_modules` and answered `/api/health`, with `?raw` migrations and `hono` inlined.
> - The dev middleware works, and edits to `server/app.ts` apply on the next request without a restart.
> - **`server/devPlugin.ts` types the loaded module locally instead of importing `./app`.** `tsconfig.node.json` (which checks `vite.config.ts`) would otherwise pull the whole server graph into its composite project. `tsconfig.node.json` now includes `vite.server.config.ts` and `server/devPlugin.ts`.
> - `npm run typecheck` = `tsc --noEmit && tsc --noEmit -p server`. `server/tsconfig.json` includes `../src/vite-env.d.ts` for the `?raw` types. `.gitignore` gains `dist-server` and `data`.
> - The spike test is kept as `server/toolchain.test.ts`, a regression guard for the `createRequire` workaround.
> - **Node 24 confirmed (8.0.5):** the same bundle runs on `node:24-alpine` (Node 24.22.1) and answers `/api/health`, with no `ExperimentalWarning` printed, so no `--disable-warning` flag is needed. The Dockerfile uses `node:24-alpine`.
> - **Script change for 8.5.7:** the server build step is `vite build -c vite.server.config.ts` instead of `vite build --ssr server/main.ts --outDir dist-server`.

---

## Task 8.1 — Extract `SqlStorageProvider` and the contract suite

Pure refactor: no behaviour change in the running app.

**Files:** create `src/storage/sqlBackend.ts`, `sqlProvider.ts`, `schema.ts`, `schema.test.ts`, `contract.ts`. Modify `opfs.ts`, `workerHost.ts`, `memory.test.ts`.

- [x] **Step 8.1.1: `sqlBackend.ts`.** Move `SqlValue`, `SqlRow` and `SqlOp` out of `workerProtocol.ts` (re-export them there for now) and define:
  ```ts
  export interface SqlBackend {
    init(): Promise<void>
    close(): Promise<void>
    all(sql: string, params?: SqlValue[]): Promise<SqlRow[]>
    one(sql: string, params?: SqlValue[]): Promise<SqlRow | null>
    run(sql: string, params?: SqlValue[]): Promise<void>
    tx(ops: SqlOp[]): Promise<void>
    writeBlob(path: string, data: ArrayBuffer): Promise<void>
    readBlob(path: string): Promise<ArrayBuffer | null>
    deleteBlob(path: string): Promise<void>
  }
  ```
  `WorkerClient` already has exactly this shape; make it `implements SqlBackend`.
- [x] **Step 8.1.2: `sqlProvider.ts`.** Move the body of `OPFSStorageProvider` into `class SqlStorageProvider implements StorageProvider { constructor(private db: SqlBackend) }`, swapping `this.client` for `this.db`. `opfs.ts` shrinks to `class OPFSStorageProvider extends SqlStorageProvider` that constructs the `WorkerClient` and terminates it on close.
- [x] **Step 8.1.3: `schema.ts`.** Move `ensureSchema` out of `workerHost.ts` as `ensureSchema(db: Pick<SqlBackend, 'one' | 'run'>)`, keeping the explicit `BEGIN`/`COMMIT` per migration and the `SchemaVersionError` path. The worker calls it with its local helpers. `schema.test.ts` (in-memory fake that records SQL) covers: fresh DB runs all migrations; up-to-date DB is a no-op; newer DB throws `SchemaVersionError`; a failing migration rolls back.
- [x] **Step 8.1.4: `contract.ts`.** Turn the bodies of `memory.test.ts` into `export function storageContract(name: string, make: () => Promise<StorageProvider>)` (with `afterEach` closing the provider). `memory.test.ts` becomes `storageContract('InMemoryStorageProvider', async () => new InMemoryStorageProvider())`. Any test that pokes memory internals stays in `memory.test.ts`.
- [x] **Step 8.1.5:** `npm test` and `npm run typecheck` green. Quick browser smoke via `npm run dev` + `window.__couloir.listAll()`, to confirm OPFS still works after the refactor.

> **Notes (2026-10-26):**
> - **`ensureSchema` runs from `SqlStorageProvider.init()`, after `db.init()`, not inside the backend.** In the browser it now drives migrations from the main thread through the worker's `one`/`run` RPCs. `SchemaVersionError` is thrown on the main thread directly, so `WorkerClient`'s prefix rehydration is now unused; it goes away with the worker in 8.6. `SqlBackend.init()` only opens the connection.
> - `sqlProvider.ts` was produced from `opfs.ts` by a mechanical `this.client` → `this.db` rename, so the SQL is unchanged. Only comments that named OPFS or the worker were made backend-neutral. `closed` is `protected` so `OPFSStorageProvider.close()` can terminate the worker exactly once.
> - **The contract needs real tags.** The memory tests attached tag IDs that were never saved, which an SQL provider would reject (the `entity_tags.tag_id` foreign key). The contract saves tags first with `seedTags`.
> - **Blobs are compared by content, not identity:** `blob.text()`, via the jsdom polyfill in `src/test/setup.ts`.
> - `create()` must return a fresh, empty, uninitialized provider on every call. The backup tests call it twice per test, for the source and the restore target. The node backend's factory therefore needs a new temp dir per call, cleaned up in `cleanup`.
> - The contract grew from 33 to 39 tests: null for missing entities, tag hydration on list reads, track list/delete, and waypoint/photo list reads.
> - **Browser smoke (8.1.5):** Playwright's MCP server needs Google Chrome, which isn't installed. I ran the check in headless Edge via a dependency-free CDP script in the session scratchpad instead. Results: fresh-profile migration, create → reload → all four entity types present, export + re-import with blobs, and no page errors.

---

## Task 8.2 — Node backend

**Files:** create `server/nodeBackend.ts`, `server/nodeBackend.test.ts`.

- [x] **Step 8.2.1: `NodeSqlBackend implements SqlBackend`**, with `constructor(dataDir: string)`.
  - **`init`:** `mkdir -p {dataDir}/photos`, open `{dataDir}/couloir.db` with `DatabaseSync`, then set `PRAGMA journal_mode = WAL`, `foreign_keys = ON` and `busy_timeout = 5000`. Don't migrate here: `SqlStorageProvider.init()` runs `ensureSchema` (see the 8.1 notes).
  - **`all`/`one`/`run`:** `prepare(sql)` with `.all/.get/.run(...params)`. Multi-statement SQL (only migrations use it) goes through `db.exec(sql)` when `params` is empty and the SQL contains more than one statement. Simplest rule: `run` without params uses `exec`.
  - **`tx`:** wrap in `BEGIN`/`COMMIT`/`ROLLBACK`.
  - **Blobs:** `fs/promises` under `{dataDir}/{path}`. `readBlob` returns `null` on `ENOENT`, and `deleteBlob` ignores `ENOENT`. Write to `{file}.tmp` and then `rename`, so a crash never leaves a half-written photo.
  - **Paths:** resolve the path and assert it stays inside `dataDir` (defence in depth behind Decision 13).
  - **Types:** `node:sqlite` returns `bigint` only when asked, and numbers otherwise. Confirm `INTEGER` columns come back as `number` to match the wa-sqlite rows `SqlStorageProvider` expects.
- [x] **Step 8.2.2: Contract.** In `nodeBackend.test.ts`, run `storageContract('SqlStorageProvider/node', …)`. Each test gets a fresh `mkdtemp` directory, removed in `afterEach`.
- [x] **Step 8.2.3: Backend-specific tests.**
  - Reopening the same dir sees the data.
  - Schema version is recorded.
  - A `../` path is rejected.
  - WAL is on.
  - A DB at a higher version throws `SchemaVersionError`.

> **Notes (2026-10-26):**
> - **All 39 contract tests passed unchanged** against `SqlStorageProvider` on `NodeSqlBackend`. This is the same SQL as the browser, and integer columns come back as `number`, so no `Number()` coercion changes were needed. There are 8 backend tests on top: reopen persistence, schema version and directory layout, WAL plus foreign keys, newer-DB refusal, transaction rollback, atomic blob write (no `.tmp` left behind), missing-blob behaviour, and path escapes (`../`, nested `..`, absolute paths).
> - **`run()` without params uses `exec`, which allows multiple statements (migrations); with params it uses `prepare().run`.** `node:sqlite`'s `exec` can't bind and `prepare` runs a single statement, so no call needs both.
> - **`node:sqlite` turns foreign keys on by default** (`enableForeignKeyConstraints: true`). The explicit PRAGMA documents the requirement. A mutation check with the constructor option set to `false` failed both the PRAGMA test and the contract's tag-delete cascade test, so the suite does guard it.
> - The contract factory makes a fresh `mkdtemp` directory per `create()`. They're all removed in `cleanup`, after the providers close (Windows can't delete an open DB file). No temp dirs are left after a run.

---

## Task 8.3 — HTTP API

**Files:** create `server/app.ts`, `server/app.test.ts`.

`createApp({ storage, config }: { storage: StorageProvider; config: { maptilerKey: string | null; schemaVersion: number } })` returns a Hono app. It takes a `StorageProvider`, not a backend, so routes stay thin and the app tests can use `InMemoryStorageProvider`.

- [ ] **Step 8.3.1: Routes.** They mirror the interface 1:1:

  | Method | Path | Storage call |
  |---|---|---|
  | GET | `/api/health` | `{ ok: true, schemaVersion }` |
  | GET | `/api/config` | `{ maptilerKey }` (null if unset) |
  | GET | `/api/routes` | `getRoutes` |
  | GET | `/api/routes/by-hash/:hash` | `getRouteBySourceHash` → 404 if null |
  | GET/PUT/DELETE | `/api/routes/:id` | `getRoute` (404) / `saveRoute` / `deleteRoute` |
  | … | `/api/tracks…` | same shape as routes |
  | GET | `/api/waypoints` · GET/PUT/DELETE `/api/waypoints/:id` | waypoint CRUD |
  | GET | `/api/photos` · GET `/api/photos/:id` | `getPhotos` / `getPhoto` |
  | PUT | `/api/photos/:id` | multipart `photo` (JSON), `full`, `thumb` → `savePhoto` |
  | PATCH | `/api/photos/:id` | JSON → `updatePhotoMetadata` (404 if missing) |
  | GET | `/api/photos/:id/full`, `/api/photos/:id/thumb` | blob, `image/jpeg`, `Cache-Control: public, max-age=31536000, immutable` |
  | DELETE | `/api/photos/:id` | `deletePhoto` |
  | GET/PUT/DELETE | `/api/tags`, `/api/tags/:id` | tag CRUD |
  | PUT | `/api/entity-tags/:type/:id` | `{ tagIds }` → `setEntityTags` |
  | GET | `/api/export/bundle` | `exportAll().bundle` (blobs are fetched per photo by the client) |
  | POST | `/api/import` | multipart: `bundle` (JSON), `full:{id}` and `thumb:{id}` files → `importAll` |

- [ ] **Step 8.3.2: Guards.**
  - Every `:id` is checked against the Decision 13 regex, else 400.
  - `PUT` rejects a body whose `id` differs from the path (400).
  - `:type` must be one of the `EntityType` values.
  - Malformed JSON gives 400.
  - Storage errors are caught by an `onError` handler and returned as `500 { error }`, logged through a server `debug()`.
  - Photo blobs are immutable per id, so a `PUT` for an id that already has blobs overwrites them. That matches `savePhoto` semantics.
- [ ] **Step 8.3.3: Tests** (`app.request()`, `InMemoryStorageProvider`). One round-trip per resource. Also cover:
  - 404s and 400s, including a traversal id like `..%2F..%2Fetc`
  - the id mismatch case
  - blob content-type and cache headers
  - a multipart photo upload
  - an import with two photos
  - the `/api/config` key passthrough

---

## Task 8.4 — `HttpStorageProvider`

**Files:** create `src/storage/http.ts`, `src/storage/http.test.ts` (`// @vitest-environment node`).

- [ ] **Step 8.4.1:** `class HttpStorageProvider implements StorageProvider`, with `constructor(opts: { baseUrl?: string; fetchFn?: typeof fetch })`. Defaults are `''` (same origin) and the global `fetch`.
  - **`init`:** `GET /api/health`. Throw `SchemaVersionError` if `schemaVersion > SCHEMA_VERSION` (the client is a stale PWA build, so the user should refresh). Throw a clear `Error('Couloir server unreachable: …')` on network failure.
  - **`close`:** no-op.
  - **`get*`:** 404 → `null`.
  - **`updatePhotoMetadata`:** 404 → throw, matching the memory provider.
  - **Errors:** non-2xx → `Error` with status and server message.
  - **`savePhoto`:** `FormData` with `photo` JSON, plus `full`/`thumb` as Blobs.
  - **`getPhotoBlob`/`getPhotoThumb`:** `fetch(...).blob()`. The browser HTTP cache handles repeats, because the server sends `immutable`.
  - **`exportAll`:** bundle from `/api/export/bundle`, then fetch each photo's full and thumb. Concurrency is limited to 4.
  - **`importAll`:** a single multipart `POST /api/import`.
- [ ] **Step 8.4.2: Contract.** Run `storageContract('HttpStorageProvider', …)` with `fetchFn: (input, init) => app.fetch(new Request(new URL(input, 'http://test'), init))`, where `app = createApp({ storage: new SqlStorageProvider(new NodeSqlBackend(tmp)) })`. This is the end-to-end proof: browser provider → HTTP → SQL → disk.
- [ ] **Step 8.4.3:** Http-specific tests: server down → clear error; `schemaVersion` ahead → `SchemaVersionError`; 500 → error carries the server's message.

---

## Task 8.5 — Wire the app to the server

**Files:** create `server/main.ts`, `server/devPlugin.ts`. Modify `src/main.tsx`, `vite.config.ts`, `package.json` (scripts only), `src/utils/id.ts` (+ test), `src/store/settings.ts`.

- [ ] **Step 8.5.1: `server/main.ts`.**
  - Read `PORT` (8080), `DATA_DIR` (`./data`), `MAPTILER_KEY`, `BACKUP_KEEP` (14) and `STATIC_DIR` (the `dist/` next to the bundle).
  - Build `NodeSqlBackend` → `SqlStorageProvider` → `createApp`. Add `serveStatic` for `STATIC_DIR`, with an SPA fallback: non-`/api` GETs that miss a file get `index.html` with `Cache-Control: no-cache`, and hashed `assets/*` get `immutable`.
  - Start with `serve()`.
  - On `SIGTERM`/`SIGINT`, stop accepting connections, close the provider (WAL checkpoint) and exit 0. Docker stop then never leaves a dirty DB.
- [ ] **Step 8.5.2: `server/devPlugin.ts`.** Make Step 8.0.4 real. Dev data lives in `./data` (add it to `.gitignore`). The provider is cached on `globalThis` so hot reloads of `app.ts` don't reopen the DB.
- [ ] **Step 8.5.3: `src/main.tsx`.** Replace `new OPFSStorageProvider()` with `new HttpStorageProvider()`. If `init()` fails, the existing bootstrap error screen shows "Couloir failed to start", which is acceptable for an unreachable server. Make its message suggest checking the server. Wrap `registerSW` so a failure on insecure origins is swallowed.
- [ ] **Step 8.5.4: `newId()` fallback.** If `crypto.randomUUID` is undefined, build an RFC 4122 v4 UUID from `crypto.getRandomValues(new Uint8Array(16))`. Test both branches, and the version and variant bits.
- [ ] **Step 8.5.5: Maptiler key.** In `settings.ts` hydration, if `localStorage` has no key, `GET /api/config` and use `maptilerKey` as an in-memory default. Don't write it to `localStorage`, so a server-side key change takes effect. Test: local key wins; server key used when local is empty; server unreachable → no key (existing onboarding).
- [ ] **Step 8.5.6: PWA.** Set `workbox.navigateFallbackDenylist: [/^\/api\//]` so the service worker never answers API navigations with `index.html`. No runtime caching of `/api`.
- [ ] **Step 8.5.7: Scripts** (changing only `scripts` in `package.json`, which the dependency rule allows):
  - `"build": "tsc && tsc -p server && vite build && vite build --ssr server/main.ts --outDir dist-server"`
  - `"start": "node dist-server/main.js"`
  - Add `dist-server/` and `data/` to `.gitignore`.
- [ ] **Step 8.5.8: Browser smoke** (Playwright, `npm run dev`).
  - Create a route, waypoint and photo, then reload; everything is still there and `./data/couloir.db` exists.
  - Open a second tab, which now works (the old single-tab lock is gone).
  - `npm run build && npm start` serves the same on :8080.

---

## Task 8.6 — Remove OPFS

- [ ] **Step 8.6.1:** Before deleting anything, `git tag last-opfs <commit before 8.5>` and push the tag. That build can always export a ZIP from an old browser profile.
- [ ] **Step 8.6.2:** Delete the OPFS files:
  - `opfs.ts`, `workerHost.ts`, `workerClient.ts`, `workerClient.test.ts`, `workerProtocol.ts`, `wa-sqlite.d.ts`
  - `npm uninstall wa-sqlite`
  - from `vite.config.ts`: `optimizeDeps.exclude` and `worker.format`, plus `wasm` from the workbox `globPatterns`

  Lower `maximumFileSizeToCacheInBytes` if the wasm was the only reason it was raised.
- [ ] **Step 8.6.3:** Settings panel: replace the "Storage requirements" copy (OPFS quotas and incognito caveats) with a short "Data is stored on your Couloir server" note showing the server's health status.
- [ ] **Step 8.6.4:** `npm test`, `npm run typecheck`, `npm run build` all green. `grep -ri "opfs\|wa-sqlite" src` returns only intentional mentions.

---

## Task 8.7 — Server backups

**Files:** create `server/backups.ts`, `server/backups.test.ts`. Modify `server/main.ts`.

- [ ] **Step 8.7.1:**
  - `snapshot(db, dir, now)` runs `VACUUM INTO '{dir}/couloir-{YYYYMMDD}.db'`. If today's file already exists, it overwrites it via a temp file and rename.
  - `prune(dir, keep)` deletes the oldest `couloir-*.db` files beyond `keep`.
  - `scheduleBackups()` runs once at startup, then every 24 h (`setInterval(...).unref()`). Errors are logged, never fatal.
- [ ] **Step 8.7.2:** Tests in a temp dir: the snapshot opens and has the rows; prune keeps the newest N; an existing same-day file is replaced.
- [ ] **Step 8.7.3:** Add `GET /api/backup/db`, which streams a fresh `VACUUM INTO` snapshot as a download. It's an "off-box copy now" button for Settings, alongside the existing ZIP export, which still works and includes photos.

---

## Task 8.8 — Docker, CI and Unraid

**Files:** create `Dockerfile`, `.dockerignore`, `.github/workflows/docker.yml`, `deploy/unraid/couloir.xml`, `docs/DEPLOY.md`.

- [ ] **Step 8.8.1: `Dockerfile`.**
  - **Build stage** (`node:24-alpine`, or the version from 8.0.5): `npm ci` and `npm run build`.
  - **Runtime stage** (same base): copy only `dist/` and `dist-server/`, then `ENV DATA_DIR=/data PORT=8080`, `VOLUME /data`, `EXPOSE 8080`.
  - `HEALTHCHECK` with `wget -qO- localhost:8080/api/health`, and `CMD ["node", "dist-server/main.js"]`.
  - Runs as `USER node` by default. The Unraid template overrides it to `99:100` (nobody:users).
- [ ] **Step 8.8.2: `.dockerignore`:** `node_modules`, `dist*`, `data`, `.git`, `docs`.
- [ ] **Step 8.8.3: `docker.yml`.** On push to `main` (plus `workflow_dispatch`):
  - checkout → setup-node → `npm ci` → `npm run typecheck` → `npm test`
  - `docker/login-action` to GHCR with `GITHUB_TOKEN`
  - `docker/build-push-action` with tags `latest` and `sha-${{ github.sha }}` (short form)
  - `permissions: packages: write`
  - Pin action versions.
- [ ] **Step 8.8.4: `deploy/unraid/couloir.xml`.** Repository `ghcr.io/rprouse/couloir:latest`. Port 8080. Path `/data` → `/mnt/user/appdata/couloir`. Variables `MAPTILER_KEY` (masked) and `BACKUP_KEEP`. `--user 99:100` in ExtraParams. WebUI `http://[IP]:[PORT:8080]`.
- [ ] **Step 8.8.5: `docs/DEPLOY.md`.** Cover:
  - installing the template, making the GHCR package public or adding a registry login
  - first run, and migrating data: export a ZIP from the old build, then import it
  - where the backups live
  - **HTTPS options:** Tailscale (`tailscale serve --https=443 http://localhost:8080`, tailnet = access control) vs reverse proxy with a LAN cert
  - an explicit warning never to port-forward the unauthenticated API to the internet
- [ ] **Step 8.8.6 (Unraid, user):** Deploy, open from two computers, add a photo on one and see it on the other. Restart the container and confirm the data survives. Confirm a backup file appears in `/mnt/user/appdata/couloir/backups`.

---

## Task 8.9 — Data migration and end-to-end QA

- [ ] **Step 8.9.1 (user):** In the browser that holds today's data, run the current production build and use Settings → Export to make a ZIP. Keep it.
- [ ] **Step 8.9.2 (user):** Against the deployed server, use Settings → Import with that ZIP. Spot-check counts against the old build (`window.__couloir.listAll()` in dev, or the layer panel badges), confirm photos open full size, and check tags and filters.
- [ ] **Step 8.9.3:** Browser QA checklist (Playwright against `npm start`):
  - GPX import and duplicate detection (`by-hash`)
  - waypoint create/edit/delete
  - photo add, view and reposition (`PATCH`)
  - tag create/assign/delete (cascade)
  - search
  - ZIP export → import round-trip into a fresh `DATA_DIR`
  - slope overlay still works
  - no console errors
  - a 375 px layout
  - over plain `http://<LAN IP>:8080`: IDs still generate (fallback path) and the app works without a service worker

---

## Task 8.10 — Docs

- [ ] **Step 8.10.1: `ARCHITECTURE.md`.**
  - Rewrite Guiding Principles: "server-authoritative, self-hosted" replaces "local-first". Keep "storage abstraction" and "sync-aware schema".
  - Tech stack rows: Hono, `node:sqlite`, photo files on a volume. Remove wa-sqlite and OPFS.
  - Replace the VFS/OPFS section with "Server" (layout, API table, backups, deployment pointer).
  - Update the project structure tree.
- [ ] **Step 8.10.2: `DATA-MODEL.md`.** Photo blobs live at `{DATA_DIR}/photos/{id}.jpg` and `_thumb.jpg`. Mention WAL and the backup snapshots.
- [ ] **Step 8.10.3: `AGENTS.md`.**
  - Update the photo storage convention and the "OPFS implementation" wording in Never Do (now "SQL provider and HTTP provider").
  - Add `npm start` and the `./data` dev directory to Commands.
  - Note that server tests use `// @vitest-environment node`.
- [ ] **Step 8.10.4: `SPEC.md` and the `TASKS.md` backlog.**
  - Strike "Cloud sync via PowerSync or ElectricSQL" and "Photo blob sync to S3 / MinIO" (superseded by Phase 8).
  - Add "Offline read cache for field use", "Stale-write (409) detection" and "Forward-auth + per-user filtering".

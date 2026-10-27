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

`createApp({ storage, config }: { storage: StorageProvider; config: { maptilerKey: string | null } })` (the schema version comes from `SCHEMA_VERSION` directly) returns a Hono app. It takes a `StorageProvider`, not a backend, so routes stay thin and the app tests can use `InMemoryStorageProvider`.

- [x] **Step 8.3.1: Routes.** They mirror the interface 1:1:

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
  | POST | `/api/import` | multipart: `bundle` (JSON), `full:{id}` and `thumb:{id}` files → `importAll` |

- [x] **Step 8.3.2: Guards.**
  - Every `:id` is checked against the Decision 13 regex, else 400.
  - `PUT` rejects a body whose `id` differs from the path (400).
  - `:type` must be one of the `EntityType` values.
  - Malformed JSON gives 400.
  - Storage errors are caught by an `onError` handler and returned as `500 { error }`, logged through a server `debug()`.
  - Photo blobs are immutable per id, so a `PUT` for an id that already has blobs overwrites them. That matches `savePhoto` semantics.
- [x] **Step 8.3.3: Tests** (`app.request()`, `InMemoryStorageProvider`). One round-trip per resource. Also cover:
  - 404s and 400s, including a traversal id like `..%2F..%2Fetc`
  - the id mismatch case
  - blob content-type and cache headers
  - a multipart photo upload
  - an import with two photos
  - the `/api/config` key passthrough

> **Notes (2026-10-26):**
> - **No export endpoint (plan change).** `GET /api/export/bundle` was dropped. On the server it would call `exportAll()`, which loads every photo blob into memory just to return JSON. `HttpStorageProvider.exportAll` builds the identical bundle from the list endpoints instead. `entity_tags` is fully derivable from each entity's hydrated `tags`, because deletes clear junction rows and the foreign key stops dangling tag ids. The API table and Step 8.4.1 are updated to match.
> - **Status codes:** writes return `204`. Missing entities and blobs return `404 { error }`. Guard failures return `400 { error }`. Unknown `/api` paths return a JSON 404. Other errors return `500 { error }`, logged to stderr through `server/log.ts` (the container log; the browser's `debug()` is localStorage-gated and can't run on the server).
> - **`PATCH /api/photos/:id` checks existence first and returns 404,** rather than matching the provider's `not found` error message.
> - **Hono decodes path params before the ID check,** so `..%2Fx` arrives as `../x` and is refused. Import blob field names (`full:{id}`, `thumb:{id}`) go through the same check. A mutation check (pattern loosened to `/^.+$/`) failed all 5 guard tests.
> - **Step 8.5.2 was done here,** to avoid breaking dev `/api`, because `createApp` now needs a provider. `server/devApp.ts` caches one `SqlStorageProvider` on `globalThis` (`./data`, or `DATA_DIR`) and rebuilds the Hono app per request, so route edits hot-reload without reopening the DB. `server/main.ts` is a minimal API-only entry until 8.5.1.
> - Verified live over real HTTP through the dev middleware with `curl` (JSON PUT/GET, multipart photo upload, blob GET, traversal refusal); the files landed in the data dir with WAL.

---

## Task 8.4 — `HttpStorageProvider`

**Files:** create `src/storage/http.ts`, `src/storage/http.test.ts` (client-only, scripted fetch), `server/httpProvider.test.ts` (end-to-end contract).

- [x] **Step 8.4.1:** `class HttpStorageProvider implements StorageProvider`, with `constructor(opts: { baseUrl?: string; fetchFn?: typeof fetch })`. Defaults are `''` (same origin) and the global `fetch`.
  - **`init`:** `GET /api/health`. Throw `SchemaVersionError` if `schemaVersion > SCHEMA_VERSION` (the client is a stale PWA build, so the user should refresh). Throw a clear `Error('Couloir server unreachable: …')` on network failure.
  - **`close`:** no-op.
  - **`get*`:** 404 → `null`.
  - **`updatePhotoMetadata`:** 404 → throw, matching the memory provider.
  - **Errors:** non-2xx → `Error` with status and server message.
  - **`savePhoto`:** `FormData` with `photo` JSON, plus `full`/`thumb` as Blobs.
  - **`getPhotoBlob`/`getPhotoThumb`:** `fetch(...).blob()`. The browser HTTP cache handles repeats, because the server sends `immutable`.
  - **`exportAll`:** build the bundle client-side from the list endpoints (`/api/routes`, `/tracks`, `/waypoints`, `/photos`, `/tags`). `entity_tags` is derived from each entity's hydrated `tags`, sorted like the SQL export (type, entity id, tag id). Then fetch each photo's full and thumb, with concurrency limited to 4. There's no export endpoint; see the 8.3 notes.
  - **`importAll`:** a single multipart `POST /api/import`.
- [x] **Step 8.4.2: Contract.** Run `storageContract('HttpStorageProvider', …)` with `fetchFn: (input, init) => app.fetch(new Request(new URL(input, 'http://test'), init))`, where `app = createApp({ storage: new SqlStorageProvider(new NodeSqlBackend(tmp)) })`. This is the end-to-end proof: browser provider → HTTP → SQL → disk.
- [x] **Step 8.4.3:** Http-specific tests: server down → clear error; `schemaVersion` ahead → `SchemaVersionError`; 500 → error carries the server's message.

> **Notes (2026-10-26):**
> - **The end-to-end contract lives in `server/httpProvider.test.ts`, not `src/storage/http.test.ts`.** It needs `server/app`, and importing that from `src/` would pull server code (and Node types) into the browser tsconfig. `src/storage/http.test.ts` holds the client-only tests: init and schema skew, unreachable server, base URL, encoding, 404 → null, error messages (JSON and non-JSON bodies), a 404 on a write still throws, `updatePhotoMetadata` 404, and the global-fetch default.
> - **All 39 contract tests passed** through `HttpStorageProvider` → Hono (in-process via `app.fetch`) → `SqlStorageProvider` → `node:sqlite` and files. An extra test checks that the client-assembled export equals the server-side SQL `exportAll()` bundle field for field (except `exported_at`). A mutation check (sort disabled) showed this test guards the `entity_tags` ordering.
> - **Errors are `HttpStorageError`,** which carries `status` and the server's `{ error }` text, falling back to the status text for non-JSON bodies such as a proxy error page. Network failures become `Couloir server unreachable (<path>): <reason>`, which 8.5.3's bootstrap message can rely on.
> - **The default fetch is wrapped (`(i, init) => fetch(i, init)`)** to avoid "Illegal invocation" from a detached `window.fetch`. That also lets tests stub the global.

---

## Task 8.5 — Wire the app to the server

**Files:** create `server/main.ts`, `server/devPlugin.ts`. Modify `src/main.tsx`, `vite.config.ts`, `package.json` (scripts only), `src/utils/id.ts` (+ test), `src/store/settings.ts`.

- [x] **Step 8.5.1: `server/main.ts`.**
  - Read `PORT` (8080), `DATA_DIR` (`./data`), `MAPTILER_KEY`, `BACKUP_KEEP` (14) and `STATIC_DIR` (the `dist/` next to the bundle).
  - Build `NodeSqlBackend` → `SqlStorageProvider` → `createApp`. Add `serveStatic` for `STATIC_DIR`, with an SPA fallback: non-`/api` GETs that miss a file get `index.html` with `Cache-Control: no-cache`, and hashed `assets/*` get `immutable`.
  - Start with `serve()`.
  - On `SIGTERM`/`SIGINT`, stop accepting connections, close the provider (WAL checkpoint) and exit 0. Docker stop then never leaves a dirty DB.
- [x] **Step 8.5.2: `server/devPlugin.ts`.** *(Done early in 8.3; see the 8.3 notes.)* Make Step 8.0.4 real. Dev data lives in `./data` (add it to `.gitignore`). The provider is cached on `globalThis` so hot reloads of `app.ts` don't reopen the DB.
- [x] **Step 8.5.3: `src/main.tsx`.** Replace `new OPFSStorageProvider()` with `new HttpStorageProvider()`. If `init()` fails, the existing bootstrap error screen shows "Couloir failed to start", which is acceptable for an unreachable server. Make its message suggest checking the server. Wrap `registerSW` so a failure on insecure origins is swallowed.
- [x] **Step 8.5.4: `newId()` fallback.** If `crypto.randomUUID` is undefined, build an RFC 4122 v4 UUID from `crypto.getRandomValues(new Uint8Array(16))`. Test both branches, and the version and variant bits.
- [x] **Step 8.5.5: Maptiler key.** In `settings.ts` hydration, if `localStorage` has no key, `GET /api/config` and use `maptilerKey` as an in-memory default. Don't write it to `localStorage`, so a server-side key change takes effect. Test: local key wins; server key used when local is empty; server unreachable → no key (existing onboarding).
- [x] **Step 8.5.6: PWA.** Set `workbox.navigateFallbackDenylist: [/^\/api\//]` so the service worker never answers API navigations with `index.html`. No runtime caching of `/api`.
- [x] **Step 8.5.7: Scripts** (changing only `scripts` in `package.json`, which the dependency rule allows):
  - `"build": "tsc && tsc -p server && vite build && vite build -c vite.server.config.ts"`
  - `"start": "node dist-server/main.js"`
  - Add `dist-server/` and `data/` to `.gitignore`.
- [x] **Step 8.5.8: Browser smoke** (Playwright, `npm run dev`).
  - Create a route, waypoint and photo, then reload; everything is still there and `./data/couloir.db` exists.
  - Open a second tab, which now works (the old single-tab lock is gone).
  - `npm run build && npm start` serves the same on :8080.

> **Notes (2026-10-26):**
> - **Static serving lives in `createApp({ staticDir })`, not only in `main.ts`,** so it's unit-tested (`server/app.test.ts` → "static site"). Hashed `/assets/*` files are `immutable`. Everything else (`index.html`, `sw.js`, manifest) is `no-cache`. Extension-less paths fall back to `index.html`. A missing file with an extension is a 404, never the shell. `/api` keeps its JSON 404. `serveStatic` refuses `..`, `%` and `//` itself; the tests check three traversal spellings get a 404.
> - **Gotcha: `serveStatic`'s `onFound` runs after the response is built,** so headers set there are lost. `Cache-Control` is set on the returned `Response` instead. On a miss, the middleware returns whatever `next()` resolved to, which is Hono's context, not `undefined`. Hence the `instanceof Response` guard.
> - **Maptiler key:** the store keeps `maptilerKey` as the effective key (local, else server), so `MapView` and the slope protocol are unchanged. `maptilerKeySource` and `serverMaptilerKey` were added. Settings shows "Key from server (abcd…)" and, when a local key overrides a server key, a "Use server key" button that clears the local one. `loadServerKey()` runs in bootstrap before first render.
> - **`newId()` fallback:** builds a v4 UUID from `getRandomValues` (`uuidV4FromRandomBytes`, exported for the bit-twiddling tests).
> - **Missed here, fixed 2026-10-27 after the first Unraid run:** GPX import hashes the file with `crypto.subtle.digest`, which is also undefined on plain HTTP. Import failed with "1 error." and nothing reached the network. `sha256Hex` now falls back to a pure-JS SHA-256 (FIPS 180-4) that produces identical digests. It's tested against the NIST vectors, every length from 0 to 200 and random data versus Node's `crypto`. The fix was reproduced and verified in a browser over the LAN IP. `crypto.subtle` was the only other secure-context API in use; the backup save picker already feature-detects.
> - **The browser bundle no longer includes wa-sqlite.** `main.tsx` stopped importing OPFS, so tree-shaking dropped the worker and wasm. The PWA precache went from 2,214 KiB (17 entries) to 1,595 KiB (15). The OPFS sources are still in the tree until 8.6.
> - **Browser smoke** (headless Edge via the CDP script, since Playwright's MCP needs Chrome):
>   - **Dev mode, tab A:** creates a route, track, waypoint and photo. Tab B in the *same profile* sees them and adds a waypoint, and tab A sees it after a reload. The photo thumb is served as `image/jpeg`.
>   - **Dev mode over the LAN IP** (`http://10.10.0.72:5199`): `isSecureContext` is false and `crypto.randomUUID` is undefined, yet the created route gets a valid v4 id.
>   - **Production (`npm start`) with `MAPTILER_KEY` set:** boots straight to the map using the server key (no welcome screen), registers the service worker on localhost, and deep links boot. Over the LAN IP there's no service-worker API, and the app still boots to the map.
>   - No page errors or warnings in any run.
> - **Not verified here: SIGTERM shutdown.** Windows can't deliver a catchable SIGTERM to Node, and `TaskStop` kills hard. Check it in the container in 8.8 (`docker stop` → "shutting down" in the log, exit 0, no `-wal` left mid-transaction).
> - **Your existing browser data is not visible in this build.** It's still in OPFS, untouched, until the ZIP export/import in 8.9 (export from the `last-opfs` tag or the current `main` build).

---

## Task 8.6 — Remove OPFS

- [x] **Step 8.6.1:** Before deleting anything, `git tag last-opfs <commit before 8.5>` and push the tag. That build can always export a ZIP from an old browser profile.
- [x] **Step 8.6.2:** Delete the OPFS files:
  - `opfs.ts`, `workerHost.ts`, `workerClient.ts`, `workerClient.test.ts`, `workerProtocol.ts`, `wa-sqlite.d.ts`
  - `npm uninstall wa-sqlite`
  - from `vite.config.ts`: `optimizeDeps.exclude` and `worker.format`, plus `wasm` from the workbox `globPatterns`

  Lower `maximumFileSizeToCacheInBytes` if the wasm was the only reason it was raised.
- [x] **Step 8.6.3:** Settings panel: replace the "Storage requirements" copy (OPFS quotas and incognito caveats) with a short "Data is stored on your Couloir server" note showing the server's health status.
- [x] **Step 8.6.4:** `npm test`, `npm run typecheck`, `npm run build` all green. `grep -ri "opfs\|wa-sqlite" src` returns only intentional mentions.

> **Notes (2026-10-26):**
> - **`last-opfs` → `2f6f076` (Task 8.4),** the last commit whose `main.tsx` uses `OPFSStorageProvider`. The annotated tag is pushed to `origin`. To export from an old browser profile: `git switch --detach last-opfs`, run `npm i && npm run dev`, open the same origin the data was created on (`http://localhost:5173`, because OPFS is per-origin), then use Settings → Export.
> - **Removed:** `opfs.ts`, `workerHost.ts`, `workerClient.ts` (+ test), `workerProtocol.ts`, `wa-sqlite.d.ts`, the `wa-sqlite` dependency, and from `vite.config.ts`: `worker.format`, `optimizeDeps.exclude`, and `wasm` in `globPatterns`. `SqlStorageProvider.closed` is now `private`.
> - **The precache limit is 4 MB, not removed.** The main chunk is ~1.5 MB of mostly MapLibre, close to Workbox's 2 MB default, which drops oversized files from the precache silently. The precache stays at 1,595 KiB / 15 entries; wa-sqlite had already left the bundle in 8.5.
> - **Settings (plan change): a plain note instead of a health indicator.** The note says "Your library is stored on your Couloir server. Export a backup to keep a copy somewhere else." A health indicator would always read "connected", because the app can't get past bootstrap without a reachable server.
> - Comments that described OPFS now describe the server or SQL (`memory.ts`, `PhotosLayer.tsx`, `types/index.ts`, `sqlBackend.ts`, `nodeBackend.ts`). The docs (`ARCHITECTURE.md` etc.) are 8.10.
> - Checks: typecheck (all three tsconfigs), 77 files / 621 tests, and the production build all pass. A dev-server boot in headless Edge creates and lists entities with no page errors.

---

## Task 8.7 — Server backups

**Files:** create `server/backups.ts`, `server/backups.test.ts`. Modify `server/main.ts`.

- [x] **Step 8.7.1:**
  - `snapshot(db, dir, now)` runs `VACUUM INTO '{dir}/couloir-{YYYYMMDD}.db'`. If today's file already exists, it overwrites it via a temp file and rename.
  - `prune(dir, keep)` deletes the oldest `couloir-*.db` files beyond `keep`.
  - `scheduleBackups()` runs once at startup, then every 24 h (`setInterval(...).unref()`). Errors are logged, never fatal.
- [x] **Step 8.7.2:** Tests in a temp dir: the snapshot opens and has the rows; prune keeps the newest N; an existing same-day file is replaced.
- [x] **Step 8.7.3:** Add `GET /api/backup/db`, which streams a fresh `VACUUM INTO` snapshot as a download. It's an "off-box copy now" button for Settings, alongside the existing ZIP export, which still works and includes photos.

> **Notes (2026-10-26):**
> - **Bug fixed in `NodeSqlBackend.tx` (from 8.2).** It awaited `run()` between statements. Every request shares one connection, so another request's queued continuation could run in that gap, landing its writes inside this transaction and rolling them back if it failed. `VACUUM INTO` could also hit "cannot VACUUM from within a transaction". `tx` is now synchronous from `BEGIN` to `COMMIT`. A new test (a failing tx, with an unrelated write issued mid-flight) reproduced the bug before the fix and passes after it.
> - **`NodeSqlBackend.snapshotTo(path)` is `VACUUM INTO ?`,** with the path bound as a parameter. The file must not exist, so `snapshot()` writes `*.tmp` and renames it, replacing the day's file without ever clobbering it with a failed copy.
> - **Snapshot names use the UTC date:** `couloir-YYYYMMDD.db`, so the name doesn't depend on the container's time zone. `prune` keeps at least 1 whatever `BACKUP_KEEP` says, and ignores other files in the directory.
> - **Runs never overlap, and `stop()` waits for an in-flight snapshot.** `scheduleBackups` chains its runs, and the stop function it returns resolves once the current run finishes. Shutdown awaits it before closing the DB. (The first test run showed an in-flight snapshot hitting a closed DB.)
> - **`GET /api/backup/db`** returns a fresh snapshot (`application/vnd.sqlite3`, attachment `couloir-YYYYMMDD-HHMM.db`, `no-store`). It's wired through an optional `createApp({ databaseSnapshot })`, so it returns 404 where there's no database file. The dev server provides it too. Settings links to it as "Download the database only (no photos)", and the note mentions the server's daily snapshots.
> - **Live check (`npm start`, `BACKUP_KEEP=3`):** the startup log reports the setting, and today's snapshot is written at startup. The download opened in `node:sqlite` and held the route PUT just before it.
> - **Photos aren't in the snapshots.** They're immutable files on the volume. `docs/DEPLOY.md` (8.8) must say the volume itself needs backing up, and that the ZIP export is the all-in-one copy.

---

## Task 8.8 — Docker, CI and Unraid

**Files:** create `Dockerfile`, `.dockerignore`, `.github/workflows/docker.yml`, `deploy/unraid/couloir.xml`, `docs/DEPLOY.md`.

- [x] **Step 8.8.1: `Dockerfile`.**
  - **Build stage** (`node:24-alpine`, or the version from 8.0.5): `npm ci` and `npm run build`.
  - **Runtime stage** (same base): copy only `dist/` and `dist-server/`, then `ENV DATA_DIR=/data PORT=8080`, `VOLUME /data`, `EXPOSE 8080`.
  - `HEALTHCHECK` with `wget -qO- localhost:8080/api/health`, and `CMD ["node", "dist-server/main.js"]`.
  - Runs as `USER node` by default. The Unraid template overrides it to `99:100` (nobody:users).
- [x] **Step 8.8.2: `.dockerignore`:** `node_modules`, `dist*`, `data`, `.git`, `docs`.
- [x] **Step 8.8.3: `docker.yml`.** On push to `main` (plus `workflow_dispatch`):
  - checkout → setup-node → `npm ci` → `npm run typecheck` → `npm test`
  - `docker/login-action` to GHCR with `GITHUB_TOKEN`
  - `docker/build-push-action` with tags `latest` and `sha-${{ github.sha }}` (short form)
  - `permissions: packages: write`
  - Pin action versions.
- [x] **Step 8.8.4: `deploy/unraid/couloir.xml`.** Repository `ghcr.io/rprouse/couloir:latest`. Port 8080. Path `/data` → `/mnt/user/appdata/couloir`. Variables `MAPTILER_KEY` (masked) and `BACKUP_KEEP`. `--user 99:100` in ExtraParams. WebUI `http://[IP]:[PORT:8080]`.
- [x] **Step 8.8.5: `docs/DEPLOY.md`.** Cover:
  - installing the template, making the GHCR package public or adding a registry login
  - first run, and migrating data: export a ZIP from the old build, then import it
  - where the backups live
  - **HTTPS options:** Tailscale (`tailscale serve --https=443 http://localhost:8080`, tailnet = access control) vs reverse proxy with a LAN cert
  - an explicit warning never to port-forward the unauthenticated API to the internet
- [x] **Step 8.8.6 (Unraid, user):** Deploy, open from two computers, add a photo on one and see it on the other. Restart the container and confirm the data survives. Confirm a backup file appears in `/mnt/user/appdata/couloir/backups`.

> **Notes (2026-10-27):**
> - **Image:** multi-stage `node:24-alpine`. The runtime stage holds only `dist/` and `dist-server/`, 246 MB in total (most of it the Node base). It runs as `node` by default; the Unraid template passes `--user 99:100`. The healthcheck uses `wget` on `/api/health`. The exec-form `CMD` makes node PID 1, so it receives SIGTERM directly.
> - **Workflow:** `test` (npm ci, typecheck, test on Node 24) then `publish` (buildx, GHCR login with `GITHUB_TOKEN`, metadata tags `latest` on the default branch + `sha-<short>`, gha layer cache, linux/amd64). Actions are pinned to the latest exact releases as of 2026-10-27: checkout v7.0.1, setup-node v7.1.0, setup-buildx v4.4.1, login v4.7.0, metadata v6.2.0, build-push v7.4.0. These are tags, not SHAs; switch to SHA pins if supply-chain hardening becomes a goal.
> - **Verified locally in Docker:**
>   - Running as `--user 99:100` on a volume owned by 99:100 reports *healthy*. The startup backup is written, and a route and a multipart photo survive `docker restart`. Every file under `/data` is owned by `99:100`.
>   - **`docker stop`** logs `SIGTERM, shutting down` and exits 0 in ~0.7 s, and the `-wal`/`-shm` files are gone afterwards (a clean close). This closes the 8.5 gap.
>   - Running as the default user on a plain named volume is also healthy.
> - **Gotcha (documented in DEPLOY.md):** a *new named volume* gets the image's `/data` ownership (`node`, uid 1000) copied in, so `--user 99:100` fails with `EACCES mkdir /data/photos`. Unraid bind-mounts a host path, which doesn't do this. The tests used `--mount ...,volume-nocopy` to match Unraid.
> - **The CI test job, run in a `node:24` Linux container, found a real bug:** `scheduleBackups` queued every tick behind a slow run, building an unbounded backlog, and the interval test failed 3 times out of 3 on Linux. A tick that arrives during a run is now skipped. A new test holds a snapshot open across many ticks and asserts one call and no overlap. The interval tests now `stop()` in `finally`, count files after stopping, and use a 10 s `waitFor`. The whole CI job (npm ci, typecheck, 78 files / 635 tests) then passed in that container, and on Windows.
> - **Step 8.8.6 done (2026-10-27):** after merging PR #12 the workflow published the image, which was pulled to Unraid and runs there. The first run exposed the plain-HTTP GPX hashing bug, fixed in PR #13 (see the 8.5 notes).
---

## Task 8.9 — Data migration and end-to-end QA

- [x] **Step 8.9.1 (user):** *N/A (2026-10-27): no pre-server data to move; the app was still in development.* In the browser that holds today's data, run the current production build and use Settings → Export to make a ZIP. Keep it.
- [x] **Step 8.9.2 (user):** *N/A (2026-10-27): no pre-server data to move; the app was still in development.* Against the deployed server, use Settings → Import with that ZIP. Spot-check counts against the old build (`window.__couloir.listAll()` in dev, or the layer panel badges), confirm photos open full size, and check tags and filters.
- [x] **Step 8.9.3:** *Done by the user against the Unraid deployment (2026-10-27).* Browser QA checklist (Playwright against `npm start`):
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

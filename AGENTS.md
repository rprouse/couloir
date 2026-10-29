# Couloir - Claude Code Context

This file is read automatically by Claude Code at the start of every session.

## What This Project Is

Couloir is a personal backcountry ski route library. A map-centric web application for managing GPX routes, recorded tracks, terrain waypoints, and geolocated recon photographs. Built with React + Vite + TypeScript + MapLibre GL JS + Maptiler, backed by a small self-hosted Node server (Hono + SQLite via `node:sqlite`, photos as files) that runs as one Docker container on Unraid. See `docs/DEPLOY.md` for deployment.

## Always Read First

Before writing any code in a new session, read these documents in order:

1. `SPEC.md` - what we are building and why
2. `ARCHITECTURE.md` - tech stack, folder structure, storage interface, conventions
3. `DATA-MODEL.md` - TypeScript types, SQLite schema, constants

## Commands

```bash
npm run dev        # Vite dev server with the API mounted in it; data in ./data (or DATA_DIR)
npm test           # Vitest run (jsdom by default; server tests opt into the node env)
npm run typecheck  # tsc for the browser (tsconfig.json) and the server (server/tsconfig.json)
npm run build      # Typecheck + SPA build (dist/) + server bundle (dist-server/main.js)
npm start          # Run the production server on :8080 (PORT, DATA_DIR, MAPTILER_KEY, BACKUP_KEEP)
docker build -t couloir:local .   # The image CI publishes to ghcr.io/rprouse/couloir
```

Pushes to `main` run `.github/workflows/docker.yml`: typecheck + tests, then publish `:latest` and `:sha-<short>` to GHCR.

If `npm test` hangs or errors with a Vitest "esbuild service" issue on Windows, run with `npx vitest run --pool=forks --poolOptions.forks.singleFork=true`. Do not change `package.json` — the workaround is per-invocation.

On Node 25+, Node's built-in `localStorage` shadows jsdom's and breaks every test that touches it. `vitest.config.ts` passes `--no-experimental-webstorage` to the test workers (only when the running Node knows the flag), so no `NODE_OPTIONS` is needed. Don't remove it.

## Key Conventions

- All data access goes through the `StorageProvider` interface in `src/storage/interface.ts`. Never call SQLite directly from feature code.
- The browser uses `HttpStorageProvider` (`src/storage/http.ts`), which calls the server's `/api` (`server/app.ts`). On the server, `SqlStorageProvider` (`src/storage/sqlProvider.ts`) holds all of the SQL and runs on `NodeSqlBackend` (`server/nodeBackend.ts`). Every provider must pass `storageContract()` (`src/storage/contract.ts`). See ARCHITECTURE.md, "Storage Interface" and "Server".
- All entity IDs are UUIDs generated client-side with `newId()` (`src/utils/id.ts`), never `crypto.randomUUID()` directly.
- Tags are stored in the `entity_tags` junction table; each entity's `tags: string[]` is hydrated from that table by the storage layer on read.
- GeoJSON LineStrings include Z coordinate (elevation) for routes and tracks.
- Photo blobs are files on the server at `DATA_DIR/photos/{id}.jpg`, thumbnails at `DATA_DIR/photos/{id}_thumb.jpg`.
- Waypoint icons are vendored Material Symbols in `src/icons/`. To add one, add it to `WAYPOINT_ICONS` (`src/icons/waypointIcons.ts`) and `NAMES` in `scripts/fetch-material-symbols.mjs`, then run `node scripts/fetch-material-symbols.mjs`. Never hand-edit `symbolPaths.ts` or add an icon package.
- Photo metadata edits go through `StorageProvider.updatePhotoMetadata` (row + tags only); `savePhoto` is for new photos and writes the blobs.
- Maptiler API key: the browser's own key in `localStorage` under `couloir_maptiler_key`, else the server's `MAPTILER_KEY` from `/api/config` (in memory only). Read the effective key from the settings store's `maptilerKey`.
- The app must work on plain-HTTP LAN addresses (`http://unraid:8080`), where browsers withhold secure-context APIs (`crypto.randomUUID`, `crypto.subtle`, service workers, …). Use the existing wrappers (`newId()`, `sha256Hex()`) and give any new secure-context API a fallback or feature detection.

### Server conventions

- Server code lives in `server/` and is type-checked with `server/tsconfig.json`. Server test files start with `// @vitest-environment node`.
- Import `DatabaseSync` from `server/sqlite.ts`, never from `node:sqlite` directly: Vitest 2 can't resolve the `node:sqlite` import.
- One SQLite connection serves every request. Keep `NodeSqlBackend.tx()` synchronous from `BEGIN` to `COMMIT`; an `await` inside it lets another request's statements into the transaction.
- Validate any id before it reaches a file path (`server/app.ts` does this for every route).
- Schema changes are new numbered files in `src/storage/migrations/`, plus a bump to `SCHEMA_VERSION`. Never edit an applied migration.
- Log server errors with `logError()` (`server/log.ts`, stderr = container log).
- Dark theme throughout. CSS custom properties for all colors.
- CSS Modules for component styles.

## Current Phase

Always check the `## Progress` section near the top of `TASKS.md` first — the first unchecked task is the current one. Update it with `- [x]` immediately after each task is completed.

The detailed implementation plan for the phase in flight lives in `docs/superpowers/plans/` (the Progress section links to the active plan). Each plan has bite-sized checkbox steps — tick those as you work through them.

If no plan exists yet for the current phase, write one (`superpowers:writing-plans`) before starting implementation. Plans are written just-in-time, one phase at a time.

## Tooling

- All `git` commands must be run via the PowerShell tool, not Bash. The 1Password agent that signs commits is wired into the PowerShell session; Bash invocations of `git commit` fail with "Could not connect to socket".
- Browser-side smoke testing: in dev mode `window.__couloir` exposes the live `StorageProvider` plus dummy-entity helpers (`createDummyRoute`, `createDummyTrack`, `createDummyWaypoint`, `createDummyPhoto`, `exportAll`, `reimport`, `listAll`). Defined in `src/dev/devConsole.ts`.

## Coding Style

- TypeScript strict mode. No `any` types without a comment explaining why.
- Functional React components only. No class components.
- Zustand for all state. No prop drilling beyond one level.
- Prefer explicit over implicit. Name things clearly.
- No console.log left in committed code. Use a `debug()` utility if needed.
- Error states must be handled. No unhandled promise rejections.

## Never Do

- Do not write SQL directly in component or store files. Storage goes through the interface.
- Do not store sensitive data in localStorage beyond the API key.
- Do not use `any` in TypeScript types for entity data.
- Do not add dependencies without flagging it for review first.
- Do not modify the StorageProvider interface without updating every implementation (`SqlStorageProvider`, `HttpStorageProvider` plus its `/api` route in `server/app.ts`, `InMemoryStorageProvider`), the contract suite, ARCHITECTURE.md, and this document.
- Do not expose the server to the internet: it has no authentication.

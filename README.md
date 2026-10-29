# Couloir

A personal backcountry ski route library. Couloir is a map-first web app for building a private atlas of known terrain: planned routes, recorded tracks, terrain waypoints and geolocated recon photos, overlaid on 3D terrain.

The intended workflow: scout terrain from across the valley, pin those photos to the map with the direction you were looking, draw on GPX routes and recorded tracks, and mark the entry gates, cliff bands and rollovers that matter.

Couloir is **self-hosted and single-user**. A small server, one Docker container on a home server such as Unraid, keeps everything in SQLite plus photo files, and serves the app. Open it from any computer on your network or tailnet and you see the same library. Nothing leaves your network except map tile requests to Maptiler. There is no login, so keep it off the public internet.

## Features

- **3D map:** MapLibre GL with Maptiler terrain and adjustable exaggeration. Satellite, Outdoor and Winter basemaps.
- **Routes and tracks:** import GPX files (batch or drag-and-drop). Duplicate files are detected by content hash, with a replace / skip / keep-both choice. Each one gets an elevation profile, distance, gain/loss, ATES rating and technical difficulty (routes), and elapsed vs. moving time (tracks).
- **Waypoints:** click to place, pick a category (entry gate, cliff band, rollover, hazard, skin track, cache, summit, …), elevation filled in from terrain, drag to reposition.
- **Recon photos:** add a JPEG or PNG. EXIF GPS pins it where it was taken; without GPS, you click the map. Bearing, altitude and capture time are prefilled from EXIF. Photos are re-encoded (max 4096 px) with all EXIF stripped before storage. They show as clustered thumbnails, with a full-window viewer. HEIC is rejected with instructions for switching an iPhone to JPEG.
- **Tags:** colour-coded tags shared across all entity types, a tag picker in every form, management in Settings, and per-layer tag filters.
- **Search:** across names and descriptions of everything, grouped by type. Clicking a result flies the map there.
- **Slope angle and aspect overlays:** avalanche-band or compass-direction shading computed in the browser from Maptiler's terrain tiles.
- **Backup:** the server snapshots its database daily and keeps two weeks of snapshots. You can also export everything (metadata, photos, thumbnails) to a single ZIP; Chrome and Edge stream it straight to disk. Restore is additive and idempotent, and missing thumbnails are regenerated.
- **Installable PWA** when served over HTTPS (for example with Tailscale). Over plain HTTP on the LAN everything else still works.
- **Mobile layout:** below 640 px the sidebar and detail panel become bottom sheets.
- **Dark theme** throughout, because planning happens in dim rooms.

## Getting started

### Run it on a server

Couloir is published as a Docker image, `ghcr.io/rprouse/couloir:latest`. [`docs/DEPLOY.md`](docs/DEPLOY.md) covers installing it on Unraid (a template is included), settings, backups, HTTPS with Tailscale or a reverse proxy, and updates. In short:

```bash
docker run -d --name couloir -p 8080:8080 \
  -v /path/to/couloir-data:/data \
  -e MAPTILER_KEY=your-key \
  ghcr.io/rprouse/couloir:latest
```

You'll want a free [Maptiler API key](https://cloud.maptiler.com/account/keys/). Set it once on the server (`MAPTILER_KEY`), or enter one per browser in Settings.

### Develop

You'll need **Node.js 22.13 or newer** (24 recommended), for the built-in `node:sqlite`.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server also serves the API, with data in `./data`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with the API mounted; data in `./data` (no service worker in dev) |
| `npm test` | Vitest tests (jsdom for the app, Node for the server) |
| `npm run typecheck` | `tsc` for the app and the server |
| `npm run build` | Typecheck + production build of the app (`dist/`) and the server (`dist-server/`) |
| `npm start` | Run the production server on port 8080 (`PORT`, `DATA_DIR`, `MAPTILER_KEY`, `BACKUP_KEEP`) |

If Vitest hangs on Windows with an esbuild service error, run `npx vitest run --pool=forks --poolOptions.forks.singleFork=true`.

## Tech stack

| Concern | Choice |
|---|---|
| UI | React 18, TypeScript (strict), CSS Modules with theme custom properties |
| State | Zustand |
| Map | MapLibre GL JS + Maptiler (tiles, terrain-RGB) |
| Server | Node 24, [Hono](https://hono.dev), SQLite via the built-in `node:sqlite`; photos as files |
| Deployment | Docker image on GHCR (GitHub Actions), Unraid template |
| Charts | Recharts (elevation profiles) |
| GPX | Custom `DOMParser` parser |
| EXIF | `exifr` |
| Backup | `fflate` (ZIP) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Build / test | Vite, Vitest, Testing Library |

All data access goes through a single `StorageProvider` interface (`src/storage/interface.ts`). In the browser it's implemented over HTTP; on the server, one SQL implementation is the only code that touches the database. Schema changes are versioned migrations in `src/storage/migrations/`.

## Project layout

```
server/           Hono API + static serving, node:sqlite backend, daily backups, dev middleware
src/
├── storage/      StorageProvider interface; HTTP, SQL and in-memory implementations; migrations
├── store/        Zustand slices (routes, tracks, waypoints, photos, tags, settings, ui)
├── map/          MapView, one component per layer, placement + controls
├── panels/       Sidebar, Layer/Search/Settings panels, Detail panel (view/edit/create)
├── features/     GPX import, photo import, tags, search, backup
├── components/   Shared UI (TagPicker, CompassRose, ElevationProfile, …)
├── hooks/, utils/, types/
└── dev/          window.__couloir console helpers (dev builds only)
```

## Documentation

- [`SPEC.md`](SPEC.md): what Couloir is and why
- [`ARCHITECTURE.md`](ARCHITECTURE.md): stack, storage design, state machines, photo pipeline, backup format, PWA
- [`DATA-MODEL.md`](DATA-MODEL.md): TypeScript types, SQLite schema, constants
- [`docs/DEPLOY.md`](docs/DEPLOY.md): running the server (Docker, Unraid), backups, HTTPS, updates
- [`TASKS.md`](TASKS.md): the task list by phase and the post-MVP backlog
- [`docs/superpowers/plans/`](docs/superpowers/plans/): the step-by-step implementation plan for each phase
- [`AGENTS.md`](AGENTS.md): conventions for AI coding agents working in this repo

## Development notes

- In dev builds, `window.__couloir` exposes the live storage provider and helpers: `createDummyRoute`, `createDummyTrack`, `createDummyWaypoint`, `createDummyPhoto`, `createDummyPhotos(n)`, `listAll`, `exportAll`, `reimport`, `inspectPhotoExif(id)`.
- Debug logging: `localStorage.setItem('couloir_debug', '1')`, then reload.
- No `console.log` in committed code; use `debug()` from `src/utils/debug.ts`.

## Status and roadmap

The MVP (Phases 1–6) is complete, along with the slope angle overlay (Phase 7) and the move to a self-hosted server (Phase 8). Next up, tracked as issues:

- [#7](https://github.com/rprouse/couloir/issues/7) Upgrade `maplibre-gl` 4.7 → 6.x (clears a critical `npm audit` advisory)
- [#8](https://github.com/rprouse/couloir/issues/8) Photo bearing arrows on the map
- [#9](https://github.com/rprouse/couloir/issues/9) Offline map tile caching for field use
- [#10](https://github.com/rprouse/couloir/issues/10) Export routes and tracks to GPX

The rest of the backlog (aspect shading, offline use in the field, multi-user, Capacitor apps, …) is in [`TASKS.md`](TASKS.md#post-mvp-backlog).

## License

[MIT](LICENSE) © 2026 Rob Prouse

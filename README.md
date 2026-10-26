# Couloir

A personal backcountry ski route library. Couloir is a map-first web app for building a private atlas of known terrain: planned routes, recorded tracks, terrain waypoints and geolocated recon photos, overlaid on 3D terrain.

The intended workflow: scout terrain from across the valley, pin those photos to the map with the direction you were looking, draw on GPX routes and recorded tracks, and mark the entry gates, cliff bands and rollovers that matter.

Couloir is **local-first and single-user**. All data lives in your browser (SQLite on the Origin Private File System). There is no server or account, and nothing leaves your machine except map tile requests to Maptiler.

## Features

- **3D map:** MapLibre GL with Maptiler terrain and adjustable exaggeration. Satellite, Outdoor and Winter basemaps.
- **Routes and tracks:** import GPX files (batch or drag-and-drop). Duplicate files are detected by content hash, with a replace / skip / keep-both choice. Each one gets an elevation profile, distance, gain/loss, ATES rating and technical difficulty (routes), and elapsed vs. moving time (tracks).
- **Waypoints:** click to place, pick a category (entry gate, cliff band, rollover, hazard, skin track, cache, summit, …), elevation filled in from terrain, drag to reposition.
- **Recon photos:** add a JPEG or PNG. EXIF GPS pins it where it was taken; without GPS, you click the map. Bearing, altitude and capture time are prefilled from EXIF. Photos are re-encoded (max 4096 px) with all EXIF stripped before storage. They show as clustered thumbnails, with a full-window viewer. HEIC is rejected with instructions for switching an iPhone to JPEG.
- **Tags:** colour-coded tags shared across all entity types, a tag picker in every form, management in Settings, and per-layer tag filters.
- **Search:** across names and descriptions of everything, grouped by type. Clicking a result flies the map there.
- **Backup:** export everything (metadata, photos, thumbnails) to a single ZIP. Chrome and Edge stream it straight to disk. Restore is additive and idempotent, and missing thumbnails are regenerated.
- **Installable PWA:** add it to your home screen or desktop. The app shell works offline with all your data (map tiles aren't cached yet, see [#9](https://github.com/rprouse/couloir/issues/9)).
- **Mobile layout:** below 640 px the sidebar and detail panel become bottom sheets.
- **Dark theme** throughout, because planning happens in dim rooms.

## Getting started

You'll need **Node.js 20.19 or newer** and a free [Maptiler API key](https://cloud.maptiler.com/account/keys/).

```bash
npm install
npm run dev
```

Open http://localhost:5173. On first launch a welcome screen asks for your Maptiler key. It's stored in `localStorage` under `couloir_maptiler_key`, and you can change it later in Settings.

### Browser requirements

Couloir needs the Origin Private File System, available in current Chrome, Edge, Firefox and Safari.

- **Safari private browsing** has no OPFS, so the app can't run there.
- **Chrome incognito** caps OPFS at about 100 MB.
- **One tab at a time.** The database file is locked by the first tab that opens it.
- Browsers can evict site storage under disk pressure. **Export a backup regularly** (Settings › Backup); it's your only protection.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (no service worker in dev) |
| `npm test` | Vitest unit tests (jsdom) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck + production build, including the service worker |
| `npm run preview` | Serve the production build (use this to test install/offline) |

If Vitest hangs on Windows with an esbuild service error, run `npx vitest run --pool=forks --poolOptions.forks.singleFork=true`.

## Tech stack

| Concern | Choice |
|---|---|
| UI | React 18, TypeScript (strict), CSS Modules with theme custom properties |
| State | Zustand |
| Map | MapLibre GL JS + Maptiler (tiles, terrain-RGB) |
| Storage | [wa-sqlite](https://github.com/rhashimoto/wa-sqlite) in a Web Worker on OPFS; photo blobs as OPFS files |
| Charts | Recharts (elevation profiles) |
| GPX | Custom `DOMParser` parser |
| EXIF | `exifr` |
| Backup | `fflate` (ZIP) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Build / test | Vite, Vitest, Testing Library |

All data access goes through a single `StorageProvider` interface (`src/storage/interface.ts`). The OPFS/SQLite implementation is the only code that touches SQL, so a future sync backend (PowerSync/ElectricSQL + S3) can be swapped in without touching feature code. Schema changes are versioned migrations in `src/storage/migrations/`.

## Project layout

```
src/
├── storage/      StorageProvider interface, OPFS + in-memory implementations, worker, migrations
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
- [`TASKS.md`](TASKS.md): the MVP task list (all six phases complete) and the post-MVP backlog
- [`docs/superpowers/plans/`](docs/superpowers/plans/): the step-by-step implementation plan for each phase
- [`AGENTS.md`](AGENTS.md): conventions for AI coding agents working in this repo

## Development notes

- In dev builds, `window.__couloir` exposes the live storage provider and helpers: `createDummyRoute`, `createDummyTrack`, `createDummyWaypoint`, `createDummyPhoto`, `createDummyPhotos(n)`, `listAll`, `exportAll`, `reimport`, `inspectPhotoExif(id)`.
- Debug logging: `localStorage.setItem('couloir_debug', '1')`, then reload.
- No `console.log` in committed code; use `debug()` from `src/utils/debug.ts`.

## Status and roadmap

The MVP (Phases 1–6) is complete. Next up, tracked as issues:

- [#7](https://github.com/rprouse/couloir/issues/7) Upgrade `maplibre-gl` 4.7 → 6.x (clears a critical `npm audit` advisory)
- [#8](https://github.com/rprouse/couloir/issues/8) Photo bearing arrows on the map
- [#9](https://github.com/rprouse/couloir/issues/9) Offline map tile caching for field use
- [#10](https://github.com/rprouse/couloir/issues/10) Export routes and tracks to GPX

The rest of the backlog (slope-angle and aspect shading, cloud sync, Capacitor apps, …) is in [`TASKS.md`](TASKS.md#post-mvp-backlog).

## License

[MIT](LICENSE) © 2026 Rob Prouse

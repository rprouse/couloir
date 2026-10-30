# Couloir

A personal backcountry ski route library. Couloir is a map-first web app for building a private atlas of known terrain: planned routes, recorded tracks, terrain waypoints and geolocated recon photos, overlaid on 3D terrain.

The intended workflow: scout terrain from across the valley, pin those photos to the map with the direction you were looking, draw on GPX routes and recorded tracks, and mark the entry gates, cliff bands and rollovers that matter.

Couloir is **self-hosted and single-user**. A small server, one Docker container on a home server such as Unraid, keeps everything in SQLite plus photo files, and serves the app. Open it from any computer on your network or tailnet and you see the same library. Nothing leaves your network except map tile requests to Maptiler. There is no login, so keep it off the public internet.

## Features

### The map

- **3D terrain** from Maptiler, with adjustable exaggeration and a default you set in Settings.
- **Four basemaps:** Satellite, Satellite Hybrid (imagery with place names and roads), Outdoor topo and Winter. The basemap switcher folds down to just the active basemap.
- **Slope angle overlay** in avalanche bands (12–24°, 25–29°, 30–34°, 35–39°, 40–44°, 45°+), or an **aspect overlay** shading slopes of 12° and steeper by compass direction. Both are computed in the browser from Maptiler's terrain tiles, with legends and adjustable opacity.
- **ATES terrain ratings** from the Avalanche Canada KMZ files you download from its Trip Planner and import (or drop on the map). ATES can sit on top of slope or aspect shading; click a zone to see its class and definition. Couloir never fetches Avalanche Canada data itself.
- **Navigation aid:** a centre crosshair with a live latitude/longitude, elevation and bearing readout. Click the readout to copy the coordinates.
- **Locate:** centre on your GPS position once, then follow it as a moving dot.
- Compass, zoom, scale bar and pitch/bearing reset. The terrain box and basemap switcher collapse to stay out of the way, and start collapsed on phones.

### Routes and tracks

- **Routes** are planned lines; **tracks** are what you actually skied. Routes draw as solid blue lines, tracks as thinner orange dotted lines, and each one can have its own colour.
- **GPX import**, one file or a batch, from a file picker or by dropping files on the map. Re-importing a file is caught by content hash, with a replace / skip / keep-both choice.
- **Stats:** distance, elevation gain and loss. Tracks add recorded date, elapsed time and moving time; routes add an ATES rating and technical difficulty.
- **Elevation profile** for every line. Hover the chart to see the distance and elevation, with a red dot marking that spot on the map.
- **Convert** a route into a track or back, keeping its geometry, stats, tags and history.
- **Download as GPX** to take a line into Gaia, CalTopo, a Garmin or a phone.

### Waypoints

- Click the map to place one, or type its coordinates (decimal degrees, comma or space separated, with or without N/S/E/W). Drag it to move it later.
- Categories for the features that matter on a tour: entry gate, cliff band, rollover, hazard, skin track, cache, summit, point of interest and other. Each has its own icon and colour, and any waypoint can override them with a different icon (parking, skier, camp, cabin, …) or colour.
- Elevation fills in from the terrain.
- Download a waypoint as GPX.

### Recon photos

- Add JPEG or PNG photos taken from across the valley. A photo with EXIF GPS is pinned where it was taken; otherwise you click the map to place it.
- Bearing (the way the camera faced), altitude and capture time are prefilled from EXIF when present.
- Photos are re-encoded (longest side up to 4096 px) with **all EXIF stripped**, so stored photos carry no stray metadata.
- On the map each photo is a small blue dot; from zoom 14, an arrow shows which way the camera was pointing. Click a dot for a full-window viewer.
- HEIC is rejected with instructions for switching an iPhone to JPEG.

### Organising

- **Tags** with colours, shared across routes, tracks, waypoints and photos. Rename or delete a tag in Settings and every entity follows.
- **Layers** toggle independently, show item counts, and filter by tag.
- **Search** across names and descriptions of everything, grouped by type. Clicking a result flies the map there.

### Your data

- **Self-hosted:** everything lives in one SQLite database and a folder of photo files on your server.
- **Daily snapshots** of the database, kept for two weeks.
- **ZIP export** of the whole library (metadata, photos, thumbnails, ATES areas). Chrome and Edge stream it straight to disk. Import is additive and safe to repeat, and regenerates missing thumbnails.

### Everywhere else

- **Works on a plain-HTTP LAN address** like `http://unraid:8080`. Served over HTTPS (for example with Tailscale), it's also an **installable PWA**.
- **Mobile layout:** below 640 px the sidebar and detail panel become bottom sheets.
- **Dark theme** throughout, because planning happens in dim rooms.

## A typical session

1. **Scout.** Photograph a line from across the valley. Add the photos; they land where you stood, with arrows pointing at the terrain you were looking at.
2. **Plan.** Draw the route in CalTopo or Gaia and import the GPX. Turn on slope shading and ATES, check the elevation profile, and mark the entry gate, the cliff band to avoid and the rollover where it steepens.
3. **Ski it.** Import the recorded track from your watch or phone and compare it with the plan. Tag both with the zone and season.
4. **Remember.** Next year, search for the zone and everything you learned is back on the map.

Couloir is a planning aid. It doesn't know about current avalanche conditions; check the forecast and use your own judgement in the field.

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
| GPX | Custom `DOMParser` parser and writer |
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
├── features/     GPX import, photo import, ATES import, route ↔ track conversion, tags, search, backup
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

The MVP (Phases 1–6) is complete, along with the slope angle overlay (Phase 7), the move to a self-hosted server (Phase 8), the aspect overlay (Phase 9), waypoint icons and colours (Phase 10), photo markers with bearing arrows (Phase 11) and ATES terrain ratings (Phase 12). Next up, tracked as issues:

- [#7](https://github.com/rprouse/couloir/issues/7) Upgrade `maplibre-gl` 4.7 → 6.x (clears a critical `npm audit` advisory)
- [#9](https://github.com/rprouse/couloir/issues/9) Offline map tile caching for field use

The rest of the backlog (offline use in the field, multi-user, Capacitor apps, …) is in [`TASKS.md`](TASKS.md#post-mvp-backlog).

## License

[MIT](LICENSE) © 2026 Rob Prouse

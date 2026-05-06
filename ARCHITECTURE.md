# Couloir - Architecture

## Guiding Principles

- **Local-first**: All data lives in the browser. No network dependency for core functionality.
- **Storage abstraction**: All data access goes through a storage interface. The implementation is swappable without touching application code.
- **Sync-ready schema**: The local SQLite schema is designed to be a valid Postgres schema when the time comes to add a sync backend.
- **One codebase**: The same React app runs as a desktop web app, a PWA, and (eventually) a Capacitor mobile app.

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite | Component model suits a panel-heavy map app; Vite is fast; good PWA support |
| Language | TypeScript | Type safety is worth it for a data-model-heavy app |
| Map renderer | MapLibre GL JS | Open source, Maptiler-compatible, excellent 3D terrain support |
| Terrain & tiles | Maptiler | RGB terrain tiles, satellite, topo, and winter basemaps; origin-locked API key |
| Local database | SQLite via OPFS (wa-sqlite) | True SQLite in the browser via Origin Private File System; fast; sync-compatible schema |
| Photo storage | OPFS blobs alongside SQLite | Simple, self-contained, no server required |
| State management | Zustand | Lightweight, no boilerplate, works well with async storage layer |
| Styling | CSS Modules + CSS custom properties | Scoped styles, no runtime cost, easy theming |
| Charts | Recharts | Elevation profiles; React-native, lightweight |
| GPX parsing | Custom parser (DOMParser) | GPX is simple XML; no need for a library dependency |
| Build | Vite | Fast HMR, good PWA plugin support |

---

## Project Structure

```
couloir/
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App icons
├── src/
│   ├── main.tsx               # App entry point
│   ├── App.tsx                # Root component, layout shell
│   ├── storage/
│   │   ├── interface.ts       # StorageProvider interface (the abstraction)
│   │   ├── opfs.ts            # OPFS + wa-sqlite implementation
│   │   └── schema.sql         # SQLite schema (source of truth)
│   ├── store/
│   │   ├── index.ts           # Zustand store root
│   │   ├── routes.ts          # Route slice
│   │   ├── tracks.ts          # Track slice
│   │   ├── waypoints.ts       # Waypoint slice
│   │   ├── photos.ts          # Photo slice
│   │   └── ui.ts              # UI state (panels, active layer, etc.)
│   ├── map/
│   │   ├── MapView.tsx        # MapLibre GL JS wrapper
│   │   ├── layers/
│   │   │   ├── RoutesLayer.tsx
│   │   │   ├── TracksLayer.tsx
│   │   │   ├── WaypointsLayer.tsx
│   │   │   └── PhotosLayer.tsx
│   │   ├── controls/
│   │   │   ├── TerrainControl.tsx
│   │   │   └── BasemapControl.tsx
│   │   └── mapConfig.ts       # Maptiler styles, source definitions
│   ├── panels/
│   │   ├── LayerPanel/        # Layer toggles, item counts, filter by tag
│   │   ├── DetailPanel/       # Route/track/waypoint/photo detail view
│   │   ├── SettingsPanel/     # API key, map defaults, export/import
│   │   └── SearchPanel/       # Global search
│   ├── features/
│   │   ├── routes/            # Route import, form, list
│   │   ├── tracks/            # Track import, form, list
│   │   ├── waypoints/         # Waypoint creation, form
│   │   └── photos/            # Photo upload, placement, viewer
│   ├── components/
│   │   ├── ElevationProfile/  # Recharts elevation chart
│   │   ├── TagPicker/
│   │   ├── IconPicker/
│   │   └── FileDropzone/
│   ├── hooks/
│   │   ├── useStorage.ts      # Storage provider hook
│   │   ├── useMap.ts          # MapLibre map instance access
│   │   └── useGpx.ts          # GPX parsing hook
│   ├── utils/
│   │   ├── gpx.ts             # GPX parser
│   │   ├── geo.ts             # Coordinate utilities, distance, elevation
│   │   └── format.ts          # Distance, elevation, duration formatting
│   └── types/
│       └── index.ts           # Shared TypeScript types
```

---

## Storage Interface

All data access in application code must go through the `StorageProvider` interface, never directly to the SQLite implementation. This is the key abstraction that makes the backend swappable.

```typescript
// src/storage/interface.ts

export interface StorageProvider {
  // Routes
  getRoutes(): Promise<Route[]>
  getRoute(id: string): Promise<Route | null>
  saveRoute(route: Route): Promise<void>
  deleteRoute(id: string): Promise<void>

  // Tracks
  getTracks(): Promise<Track[]>
  getTrack(id: string): Promise<Track | null>
  saveTrack(track: Track): Promise<void>
  deleteTrack(id: string): Promise<void>

  // Waypoints
  getWaypoints(): Promise<Waypoint[]>
  getWaypoint(id: string): Promise<Waypoint | null>
  saveWaypoint(waypoint: Waypoint): Promise<void>
  deleteWaypoint(id: string): Promise<void>

  // Photos
  getPhotos(): Promise<Photo[]>
  getPhoto(id: string): Promise<Photo | null>
  savePhoto(photo: Photo, blob: Blob): Promise<void>
  getPhotoBlob(id: string): Promise<Blob | null>
  deletePhoto(id: string): Promise<void>

  // Tags
  getTags(): Promise<Tag[]>
  saveTag(tag: Tag): Promise<void>
  deleteTag(id: string): Promise<void>

  // Associations
  linkPhotoToRoute(photoId: string, routeId: string): Promise<void>
  linkPhotoToTrack(photoId: string, trackId: string): Promise<void>
  unlinkPhoto(photoId: string, targetId: string): Promise<void>

  // Backup
  exportAll(): Promise<ExportBundle>
  importAll(bundle: ExportBundle): Promise<void>
}
```

The OPFS implementation (`src/storage/opfs.ts`) is the only file that contains SQLite calls. When a sync backend is added, a new implementation file is created and injected at the app root - zero changes to feature code.

---

## Maptiler Integration

The Maptiler API key is stored in `localStorage` under the key `couloir_maptiler_key`. It is read at app startup and injected into all map style URLs and terrain source URLs.

### Style URLs

```
Satellite:  https://api.maptiler.com/maps/satellite/style.json?key={KEY}
Outdoor:    https://api.maptiler.com/maps/outdoor-v2/style.json?key={KEY}
Winter:     https://api.maptiler.com/maps/winter-v2/style.json?key={KEY}
```

### Terrain Source

```javascript
map.addSource('maptiler-dem', {
  type: 'raster-dem',
  url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${KEY}`,
  tileSize: 256
})

map.setTerrain({
  source: 'maptiler-dem',
  exaggeration: 1.5  // user-adjustable, stored in settings
})
```

The map will not initialize if no API key is set. The app will show the settings panel with a prompt to enter the key.

---

## State Management

Zustand is used for all application state. The store is divided into slices:

- **routes, tracks, waypoints, photos**: mirror the storage layer with loaded entity arrays plus loading/error state. Mutations call through to the storage provider then update local state.
- **ui**: active panel, selected entity, layer visibility toggles, active basemap, terrain exaggeration, map placement mode (used when dropping a waypoint or photo pin).

```typescript
// Map placement mode - used for waypoint and photo pin creation
type PlacementMode = 
  | { type: 'idle' }
  | { type: 'waypoint' }
  | { type: 'photo'; blob: Blob }
```

When placement mode is active, the map cursor changes and the next map click creates the entity at that coordinate.

---

## GPX Parsing

GPX files are parsed client-side using the browser's `DOMParser`. No external library is needed.

- `<rte>` / `<rtept>` elements → Route geometry
- `<trk>` / `<trkpt>` elements → Track geometry
- `<wpt>` elements → imported as Waypoints (optional - user can choose to import waypoints from GPX)
- Elevation from `<ele>` child elements
- Timestamps from `<time>` child elements (tracks)
- Name from `<name>`, description from `<desc>`

Parsed geometry is stored as a GeoJSON LineString in the database for efficient MapLibre rendering. The raw GPX XML is also stored as a backup.

---

## Map Layer Architecture

Each data type is a self-contained MapLibre layer component that subscribes to its Zustand slice. Layers add their own sources and layers to the map on mount and remove them on unmount.

```
RoutesLayer    → source: 'routes-source'    → layer: 'routes-line'
TracksLayer    → source: 'tracks-source'    → layer: 'tracks-line'
WaypointsLayer → source: 'waypoints-source' → layer: 'waypoints-symbols'
PhotosLayer    → source: 'photos-source'    → layer: 'photos-symbols'
```

Each layer uses a GeoJSON source. When data changes in the Zustand store, the layer updates the source data via `map.getSource(id).setData(geojson)`.

Click handlers on layers trigger the detail panel to open with the selected entity.

---

## Photo Storage Detail

Photos are stored as blobs in OPFS alongside the SQLite database file. The SQLite `photos` table stores metadata and a filename reference. The OPFS implementation stores the blob at a predictable path: `photos/{id}.jpg`.

When the app moves to cloud sync:
- The `photos` table syncs via PowerSync/ElectricSQL to Postgres
- The blob is uploaded to S3 on save, the `blob_url` column is populated
- The OPFS blob implementation is swapped for an S3 presigned URL fetcher
- The storage interface does not change

---

## Future Sync Architecture

When cloud sync is added, the recommended path is:

1. **PowerSync** or **ElectricSQL** for SQLite → Postgres sync with offline-first conflict resolution
2. **MinIO on Unraid** (S3-compatible) or **AWS S3** for photo blob storage
3. **Hono** on a Docker container (Unraid) as the lightweight API/auth layer
4. A new `StorageProvider` implementation (`src/storage/sync.ts`) is injected at app root
5. Auth is added (simple JWT or Clerk for multi-user)

No feature code changes are required for the sync migration - only the storage implementation and app root provider injection change.

---

## PWA Configuration

- Vite PWA plugin (`vite-plugin-pwa`) with Workbox
- App shell cached for offline use
- Maptiler tiles cached with a network-first strategy (tiles are cached as visited)
- OPFS data is inherently offline-capable
- `manifest.json` configured with name "Couloir", dark theme color, appropriate icons

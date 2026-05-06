# Couloir - Product Specification

## Vision

Couloir is a personal backcountry ski route library. It is a map-centric web application for a single expert user to build and maintain a private, structured collection of backcountry ski routes, recorded tracks, terrain waypoints, and geolocated recon photographs.

The core workflow it supports: scout terrain from across the valley with binoculars and a camera, tag photos to exact map locations, overlay planned routes and recorded tracks on 3D terrain, and annotate key features with waypoints. Over time Couloir becomes an intimate, personal atlas of known terrain.

The application is initially local-first and single-user. The architecture explicitly supports a future migration to cloud sync and multi-user access without requiring a rewrite.

---

## User

A single expert backcountry skier based in Fernie, BC. Comfortable with technical tools. Uses the app for pre-trip planning, post-trip logging, and long-term terrain knowledge accumulation. Accesses the app on desktop in the planning phase and potentially on mobile in the field.

---

## Core Concepts

### Route
A planned line through terrain, imported from a GPX route file. Represents intention - where you plan to ski. May be created in an external tool (Gaia GPS, CalTopo, Garmin) and imported. Has a name, description, color, ATES (Avalanche Terrain Exposure Scale) rating, technical difficulty rating, and tags. ATES and technical difficulty are independent and both optional.

### Track
A recorded GPS track, imported from a GPX track file. Represents reality - where you actually skied. Captures the ground truth of a descent or tour. Has a name, date, description, color, and tags. Elevation profile is derived from the GPX data. Stores both total elapsed time and moving time (time spent above a movement-speed threshold), so a tour with rest stops can be understood as effort versus wall clock.

### Waypoint
A named point feature pinned to a map location. Used to mark terrain features: entry gates, cliff bands, rollover points, hazard zones, skin track junctions, cache locations, summit points, etc. Has a name, description, category, icon, elevation, and tags.

### Photo
A geolocated photograph for recon photography: photos taken from across the valley looking at potential ski lines, used for navigation and route assessment. A photo has two map positions: the **subject** (the terrain depicted, placed by the user — defaults to the EXIF GPS coordinate when present, draggable to refine) and the **camera position** (preserved from EXIF when available, rarely edited). Has name, description, bearing (camera direction, prefilled from EXIF when available), elevations of camera and subject, and tags. Photos are visually related to nearby routes, tracks, and waypoints by spatial proximity on the map; there are no explicit links between photos and other entities.

---

## Feature Set

### Map

- MapLibre GL JS as the map renderer
- Maptiler as the tile and terrain provider (API key stored in settings)
- 3D terrain with adjustable exaggeration
- Basemap switcher: Satellite, Outdoor/Topo, Winter
- Compass and zoom controls
- Current location indicator (when available)
- Pitch and bearing reset controls

### Layer System

All four data types are rendered as distinct map layers. Each layer can be toggled on or off independently. Layers can be filtered by tag. The layer panel shows item counts per layer.

- Routes - rendered as colored polylines with direction indicators
- Tracks - rendered as colored polylines, visually distinct from routes
- Waypoints - rendered as categorized icons/markers
- Photos - rendered as small thumbnail pins on the map

### Routes

- Import GPX route files (single or batch). Re-importing a file the user has already imported is detected by content hash and prompts: replace, skip, or import as a new copy.
- Parse and store route geometry and metadata
- Display on map as styled polyline
- Click route on map to open detail panel
- Detail panel: name, description, distance, elevation gain/loss, ATES rating, technical difficulty, tags
- Elevation profile chart in detail panel
- Edit metadata (name, description, color, tags, ATES, technical difficulty)
- Delete route

### Tracks

- Import GPX track files (single or batch). Re-importing is detected by content hash, with the same replace/skip/new-copy prompt as routes.
- Parse and store track geometry, timestamps, and metadata
- Display on map as styled polyline (visually distinct from routes)
- Click track on map to open detail panel
- Detail panel: name, description, date recorded, distance, total elapsed time, moving time, elevation gain/loss, tags
- Elevation profile chart in detail panel
- Edit metadata
- Delete track

### Waypoints

- Create by clicking on the map
- Category picker: Entry Gate, Cliff Band, Rollover, Hazard, Skin Track, Cache, Summit, Point of Interest, Other
- Each category has a distinct icon and default color
- Name, description, elevation (auto-filled from terrain if available), tags
- Click waypoint on map to open detail panel
- Edit all fields
- Delete waypoint
- Drag to reposition

### Photos

- Upload photo file. JPEG and PNG are supported; HEIC is rejected with a guidance message (on iPhone: Settings → Camera → Formats → Most Compatible).
- EXIF data is read at import for orientation, GPS coordinates, camera direction (`GPSImgDirection`), altitude, and capture date. Orientation is applied to the stored JPEG; remaining EXIF is stripped from storage.
- Subject pin placement: if the photo has EXIF GPS, the map flies to that coordinate and a subject pin is dropped there for the user to drag to the actual subject location. If the photo has no EXIF GPS, the user clicks the map to place the subject pin.
- The camera position is preserved separately from the subject position, defaulted from EXIF GPS, and editable in the photo detail panel.
- Add name, description, bearing (0-359°, direction camera was pointing — prefilled from EXIF when available), tags. The capture date is also prefilled from EXIF.
- Thumbnail visible as a map pin at the subject location. At low zoom levels, photo pins are clustered (count badges); thumbnails appear when zoomed in.
- Click photo pin to open photo viewer with full image and metadata.
- Edit metadata and reposition pin (drag subject pin on the map, or edit camera position fields directly).
- Delete photo and blob.

### Settings

- Maptiler API key input and persistence (localStorage). Invalid or revoked keys are surfaced explicitly: a non-2xx style fetch on startup opens the Settings panel with the key field focused, and runtime tile errors above a threshold show a non-modal banner.
- Map defaults: starting center coordinates, zoom level, default basemap
- Default terrain exaggeration value
- Export all data as a single ZIP bundle: metadata, photo blobs, and a manifest. The pre-export size is shown before download.
- Import data from a ZIP bundle. Import is additive — existing entities are updated when the bundle's `updated_at` is newer; new entities are inserted.
- Tag management: create, rename, and delete tags. Deleting a tag automatically removes its references from every entity.

### Search and Filter

- Global search across names and descriptions of all entity types
- Filter any layer by one or more tags
- Tags are user-defined, color-coded, and shared across entity types

---

## Non-Goals for MVP

The following are explicitly out of scope for the MVP but should not be architecturally prevented:

- Cloud sync or remote storage
- Multi-user access or sharing
- Collaborative editing
- Avalanche forecast integration
- Slope angle or aspect shading overlays
- Weather integration
- Real-time GPS tracking in the app
- Turn-by-turn navigation
- Social features

---

## Design Principles

- Map is always the primary surface. Panels and UI chrome are secondary and collapsible.
- Dark theme by default. Backcountry planning happens in dim environments; light bleed from a white UI is unwelcome.
- Fast. Data loads from local storage; there should be no perceptible lag when switching layers or opening panels.
- Mobile-aware from the start. Layout adapts to narrow screens even in the local-only MVP.
- No unnecessary UI. Every element earns its place.

---

## Future Considerations

- PowerSync or ElectricSQL for local SQLite → Postgres cloud sync
- S3-compatible object storage (MinIO on Unraid, or AWS S3) for photo blobs
- Multi-user with per-user route libraries and optional sharing
- Slope angle shading derived from Maptiler terrain tiles
- Aspect shading layer
- Bearing cone visualization on photo pins (FOV footprint on map)
- PWA with offline tile caching for field use
- Capacitor wrapper for native iOS/Android

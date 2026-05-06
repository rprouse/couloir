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
A planned line through terrain, imported from a GPX route file. Represents intention - where you plan to ski. May be created in an external tool (Gaia GPS, CalTopo, Garmin) and imported. Has a name, description, color, difficulty rating, and tags. May be associated with waypoints and photos.

### Track
A recorded GPS track, imported from a GPX track file. Represents reality - where you actually skied. Captures the ground truth of a descent or tour. Has a name, date, description, color, and tags. Elevation profile is derived from the GPX data.

### Waypoint
A named point feature pinned to a map location. Used to mark terrain features: entry gates, cliff bands, rollover points, hazard zones, skin track junctions, cache locations, summit points, etc. Has a name, description, category, icon, elevation, and tags.

### Photo
A geolocated photograph pinned to an explicit map coordinate set by the user - not from EXIF data. The primary use case is recon photography: photos taken from across the valley looking at potential ski lines, used for navigation and route assessment. Has a name, description, coordinates, bearing (direction the camera was pointing), elevation of the camera position, and tags. May be associated with one or more routes or tracks.

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

- Import GPX route files (single or batch)
- Parse and store route geometry and metadata
- Display on map as styled polyline
- Click route on map to open detail panel
- Detail panel: name, description, distance, elevation gain/loss, difficulty, tags
- Elevation profile chart in detail panel
- Edit metadata (name, description, color, tags, difficulty)
- Delete route
- Associate photos and waypoints with a route

### Tracks

- Import GPX track files (single or batch)
- Parse and store track geometry, timestamps, and metadata
- Display on map as styled polyline (visually distinct from routes)
- Click track on map to open detail panel
- Detail panel: name, description, date recorded, distance, duration, elevation gain/loss, max speed (if available), tags
- Elevation profile chart in detail panel
- Edit metadata
- Delete track
- Associate photos with a track

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

- Upload photo file (JPEG, PNG, HEIC)
- Place pin on map by clicking - coordinates set explicitly by user, not from EXIF
- Add name, description, bearing (0-359°, direction camera was pointing), tags
- Thumbnail visible as map pin
- Click photo pin to open photo viewer with full image and metadata
- Associate photo with one or more routes or tracks
- Edit metadata and reposition pin
- Delete photo and blob

### Settings

- Maptiler API key input and persistence (localStorage)
- Map defaults: starting center coordinates, zoom level, default basemap
- Default terrain exaggeration value
- Export all data as JSON bundle (for backup)
- Import data from JSON bundle

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

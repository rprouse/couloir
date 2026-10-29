// ============================================================================
// Domain types — canonical shapes for every Couloir entity.
// SQLite schema in src/storage/migrations/1.sql is derived from these types.
// ============================================================================

import type { WaypointIcon } from '../icons/waypointIcons'

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
  color: string | null       // overrides the category colour if set
  icon: WaypointIcon | null  // overrides the category icon if set
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  user_id: string
  name: string
  description: string

  // Where the photo was taken. Seeded from EXIF GPS when present, otherwise
  // placed by the user; draggable while the photo is being created or edited.
  lat: number
  lng: number
  elevation_m: number | null            // EXIF GPSAltitude, else terrain lookup
  bearing: number | null                // 0-359, compass direction the camera faced

  blob_ref: string                      // 'photos/{id}.jpg'
  width: number
  height: number
  file_size_bytes: number
  taken_at: string | null

  tags: string[]
  created_at: string
  updated_at: string
}

// Fields a photo edit may change. File metadata (blob_ref, dimensions, size)
// is fixed at import.
export type PhotoMetadataPatch = Partial<Pick<
  Photo,
  'name' | 'description' | 'lat' | 'lng' | 'elevation_m' | 'bearing' | 'taken_at' | 'tags'
>>

// EXIF fields Couloir reads at import (src/utils/exif.ts). Any of them can be
// absent from a file, so every field is nullable.
export interface PhotoExif {
  lat: number | null
  lng: number | null
  altitude_m: number | null
  bearing: number | null     // GPSImgDirection, normalised to 0-359
  taken_at: string | null    // DateTimeOriginal as ISO 8601
}

// A photo that has been read and re-encoded but not yet saved. Lives in the
// UI store from startPhotoPlacement until the create form saves or cancels.
export interface PendingPhoto {
  blob: Blob            // full-size JPEG, EXIF stripped
  thumb: Blob           // thumbnail JPEG
  preview: string       // object URL of `thumb`; owned and revoked by the UI store
  width: number
  height: number
  filename: string      // original file name, seeds the Name field
  exif: PhotoExif
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

// Default colours offered for new tags, cycled in order.
export const TAG_PALETTE = [
  '#E05C2A', '#2A7BE0', '#22C55E', '#F59E0B',
  '#A78BFA', '#EF4444', '#14B8A6', '#F472B6',
] as const

export const WAYPOINT_CATEGORIES: Record<WaypointCategory, {
  label: string
  color: string
  icon: WaypointIcon
}> = {
  entry_gate:  { label: 'Entry Gate',        color: '#22C55E', icon: 'fence' },
  cliff_band:  { label: 'Cliff Band',        color: '#EF4444', icon: 'landslide' },
  rollover:    { label: 'Rollover',          color: '#F59E0B', icon: 'arrow_downward' },
  hazard:      { label: 'Hazard',            color: '#EF4444', icon: 'warning' },
  skin_track:  { label: 'Skin Track',        color: '#A78BFA', icon: 'route' },
  cache:       { label: 'Cache',             color: '#60A5FA', icon: 'backpack' },
  summit:      { label: 'Summit',            color: '#FBBF24', icon: 'landscape' },
  poi:         { label: 'Point of Interest', color: '#94A3B8', icon: 'star' },
  other:       { label: 'Other',             color: '#94A3B8', icon: 'location_on' },
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

// Photo re-encoding (src/utils/image.ts). The full-size cap keeps a 24 MP
// phone photo around 2-3 MB on the server while leaving plenty of zoom detail.
export const PHOTO_MAX_EDGE_PX = 4096
export const PHOTO_THUMB_EDGE_PX = 128
export const PHOTO_JPEG_QUALITY = 0.9

// ============================================================================
// Map types/constants — preserved from Phase 1
// ============================================================================

export type Basemap = 'satellite' | 'outdoor' | 'winter'

// Terrain shading computed from the DEM. At most one is shown at a time.
export type TerrainOverlay = 'slope' | 'aspect'
export const TERRAIN_OVERLAYS: readonly TerrainOverlay[] = ['slope', 'aspect']

export const MAP_DEFAULTS = {
  center: [-115.063, 49.504] as [number, number],  // Fernie, BC
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  // Default basemap lives in the UI store's initial state — see notes in
  // src/store/ui.ts. Don't reintroduce it here.
} as const

export const APP_VERSION = '0.0.1'

// Backup ZIP format (src/features/backup). Bump BUNDLE_VERSION only for
// breaking changes to metadata.json; readers reject newer versions.
export const BUNDLE_VERSION = 1
export const BACKUP_MANIFEST_FILE = 'manifest.json'
export const BACKUP_METADATA_FILE = 'metadata.json'

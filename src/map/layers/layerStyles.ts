import type { AtesClass, TerrainOverlay } from '../../types'

export const ROUTE_LINE_WIDTH = 3
export const ROUTE_LINE_GLOW_WIDTH = 7
export const ROUTE_LINE_GLOW_OPACITY = 0.25

export const TRACK_LINE_WIDTH = 3
export const TRACK_LINE_DASH: [number, number] = [2, 1.5]

export const ROUTES_SOURCE_ID = 'routes-source'
export const ROUTES_GLOW_LAYER_ID = 'routes-glow'
export const ROUTES_LINE_LAYER_ID = 'routes-line'

export const TRACKS_SOURCE_ID = 'tracks-source'
export const TRACKS_LINE_LAYER_ID = 'tracks-line'

export const WAYPOINTS_SOURCE_ID = 'waypoints-source'
export const WAYPOINTS_SYMBOLS_LAYER_ID = 'waypoints-symbols'

// CSS pixel size of the generated waypoint marker images (square). Tuned so
// that icons remain readable over satellite/topo basemaps without dominating
// the viewport. They are drawn at WAYPOINT_ICON_PIXEL_RATIO× and registered
// with that pixelRatio, so they render at this size and stay crisp on
// high-DPI screens.
export const WAYPOINT_ICON_PX = 32
export const WAYPOINT_ICON_PIXEL_RATIO = 2

// Draggable pin shown while a photo is created or edited. A literal hex
// because maplibregl.Marker paints it into an SVG fill attribute.
export const PHOTO_PIN_COLOR = '#F472B6'

export const PHOTOS_SOURCE_ID = 'photos-source'
// Bearing arrows sit beneath the dots so the dot covers the arrow's base.
export const PHOTOS_ARROWS_LAYER_ID = 'photos-arrows'
export const PHOTOS_DOTS_LAYER_ID = 'photos-dots'
export const PHOTOS_LAYER_IDS = [PHOTOS_ARROWS_LAYER_ID, PHOTOS_DOTS_LAYER_ID] as const

// Every photo is a small blue dot that grows slightly as you zoom in. From
// PHOTO_ARROW_MIN_ZOOM, photos with a bearing also show an arrow pointing the
// way the camera faced. Literal hex: map paint can't read CSS properties.
export const PHOTO_DOT_COLOR = '#3B82F6'
export const PHOTO_ARROW_MIN_ZOOM = 14
export const PHOTO_DOT_RADIUS = { minZoom: 10, min: 3.5, max: 6 } as const
export const PHOTO_DOT_STROKE = { min: 1.5, max: 2 } as const

// The arrow image is centred on the dot and rotated by the photo's bearing.
// Drawn at PHOTO_ARROW_PIXEL_RATIO× and registered with that pixelRatio.
export const PHOTO_ARROW_ICON = 'photo-arrow'
export const PHOTO_ARROW_PX = 32
export const PHOTO_ARROW_PIXEL_RATIO = 2

// Terrain overlays (slope angle, aspect): one raster source + layer each.
export const OVERLAY_SOURCE_IDS: Record<TerrainOverlay, string> = {
  slope: 'slope-source',
  aspect: 'aspect-source',
}
export const OVERLAY_LAYER_IDS: Record<TerrainOverlay, string> = {
  slope: 'slope-raster',
  aspect: 'aspect-raster',
}
// Below this a DEM pixel covers ≥ ~50 m and slope values are meaningless.
export const OVERLAY_MIN_ZOOM = 10
// Maptiler terrain-rgb-v2: pixel size of one tile and deepest zoom served.
export const DEM_TILE_SIZE = 512
export const DEM_MAX_ZOOM = 14

// ATES zones (Phase 12): one GeoJSON source holding every imported area,
// drawn above the slope/aspect raster and below routes, tracks, waypoints and
// photos. Listed bottom to top.
export const ATES_SOURCE_ID = 'ates-source'
export const ATES_FILL_LAYER_ID = 'ates-fill'
export const ATES_OUTLINE_LAYER_ID = 'ates-outline'
export const ATES_AREA_LAYER_ID = 'ates-area'
export const ATES_PATHS_LAYER_ID = 'ates-paths'
export const ATES_LINES_LAYER_ID = 'ates-lines'
export const ATES_DECISION_LAYER_ID = 'ates-decision-points'
export const ATES_LAYER_IDS = [
  ATES_FILL_LAYER_ID,
  ATES_OUTLINE_LAYER_ID,
  ATES_AREA_LAYER_ID,
  ATES_PATHS_LAYER_ID,
  ATES_LINES_LAYER_ID,
  ATES_DECISION_LAYER_ID,
] as const
export const ATES_ATTRIBUTION = 'ATES ratings © Avalanche Canada'

// Fixed colour per class (the conventional ATES green/blue/black), not the
// KML's own ABGR styles. Literal hex: map paint can't read CSS properties.
// Complex and extreme get ATES_OUTLINE_COLOR so they read on dark satellite.
export const ATES_CLASS_COLORS: Record<AtesClass, string> = {
  non_avalanche: '#F8FAFC',
  simple: '#22C55E',
  challenging: '#2563EB',
  complex: '#111827',
  extreme: '#7F1D1D',
}
export const ATES_OUTLINE_COLOR = '#F8FAFC'
export const ATES_AREA_COLOR = '#FFFFFF'
export const ATES_PATH_COLOR = '#EF4444'
export const ATES_DECISION_COLOR = '#F59E0B'
export const ATES_LINE_WIDTH = 5

// Every layer Couloir draws on top of the basemap. The terrain
// overlays are inserted beneath all of these.
export const COULOIR_OVERLAY_LAYER_IDS: readonly string[] = [
  ...ATES_LAYER_IDS,
  ROUTES_GLOW_LAYER_ID,
  ROUTES_LINE_LAYER_ID,
  TRACKS_LINE_LAYER_ID,
  WAYPOINTS_SYMBOLS_LAYER_ID,
  ...PHOTOS_LAYER_IDS,
]

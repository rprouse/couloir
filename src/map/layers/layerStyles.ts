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

// Pixel size of the generated category icon images (square). Tuned so that
// icons remain readable over satellite/topo basemaps without dominating the
// viewport. The MapLibre symbol layer renders them at this nominal size with
// icon-size: 1.0.
export const WAYPOINT_ICON_PX = 32

// Draggable pin shown while a photo is created or edited. A literal hex
// because maplibregl.Marker paints it into an SVG fill attribute.
export const PHOTO_PIN_COLOR = '#F472B6'

export const PHOTOS_SOURCE_ID = 'photos-source'
export const PHOTOS_CLUSTERS_LAYER_ID = 'photos-clusters'
export const PHOTOS_CLUSTER_COUNT_LAYER_ID = 'photos-cluster-count'
export const PHOTOS_THUMBNAILS_LAYER_ID = 'photos-thumbnails'
export const PHOTOS_LAYER_IDS = [
  PHOTOS_CLUSTERS_LAYER_ID,
  PHOTOS_CLUSTER_COUNT_LAYER_ID,
  PHOTOS_THUMBNAILS_LAYER_ID,
] as const

// Thumbnail icons are drawn at PHOTO_ICON_PIXEL_RATIO× and registered with
// that pixelRatio, so they render at PHOTO_ICON_PX CSS pixels and stay crisp
// on high-DPI screens.
export const PHOTO_ICON_PX = 48
export const PHOTO_ICON_PIXEL_RATIO = 2
export const PHOTO_PLACEHOLDER_ICON = 'photo-placeholder'

// Cluster circles step from light to deep blue as the count grows.
export const PHOTO_CLUSTER_STEPS = {
  colors: ['#60A5FA', '#3B82F6', '#1D4ED8'] as const,
  radii: [16, 20, 26] as const,
  thresholds: [10, 50] as const,
}
// Maptiler styles serve this glyph stack; the count label needs a font.
export const PHOTO_CLUSTER_FONT = ['Noto Sans Bold']

export const SLOPE_SOURCE_ID = 'slope-source'
export const SLOPE_LAYER_ID = 'slope-raster'
// Below this a DEM pixel covers ≥ ~50 m and slope values are meaningless.
export const SLOPE_MIN_ZOOM = 10
// Maptiler terrain-rgb-v2: pixel size of one tile and deepest zoom served.
export const DEM_TILE_SIZE = 512
export const DEM_MAX_ZOOM = 14

// Every layer Couloir draws on top of the basemap. The slope overlay is
// inserted beneath all of these.
export const COULOIR_OVERLAY_LAYER_IDS: readonly string[] = [
  ROUTES_GLOW_LAYER_ID,
  ROUTES_LINE_LAYER_ID,
  TRACKS_LINE_LAYER_ID,
  WAYPOINTS_SYMBOLS_LAYER_ID,
  ...PHOTOS_LAYER_IDS,
]

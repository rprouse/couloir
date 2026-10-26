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

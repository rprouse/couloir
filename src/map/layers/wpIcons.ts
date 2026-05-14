import { WAYPOINT_CATEGORIES, type WaypointCategory } from '../../types'
import { WAYPOINT_ICON_PX } from './layerStyles'

// Single-character glyph per category. We use Unicode block characters that
// MapLibre's default text rendering would not necessarily support, but here
// the glyph is rendered into a canvas before being handed to addImage as an
// ImageData blob — so any character the platform's 2D context can draw works.
const GLYPHS: Record<WaypointCategory, string> = {
  entry_gate: 'G',
  cliff_band: 'C',
  rollover:   'R',
  hazard:     '!',
  skin_track: 'S',
  cache:      '◇',
  summit:     '▲',
  poi:        '•',
  other:      '·',
}

export function categoryGlyph(category: WaypointCategory): string {
  return GLYPHS[category]
}

// Fallback ImageData factory for environments where the global isn't available
// (e.g. jsdom without the canvas npm package). Returns an object that satisfies
// the { width, height, data } structural shape that MapLibre's addImage accepts.
function makeEmptyImageData(size: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(size, size)
  }
  // Structural substitute — width, height, data as Uint8ClampedArray of zeros.
  // `as ImageData` is intentional: we only need the shape for addImage.
  return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) } as ImageData
}

// Renders a colored disc with a white outline and a single centered glyph
// onto a 2D canvas and returns the resulting ImageData for `map.addImage`.
// If the platform lacks a 2D canvas (e.g. very old browsers, or a stripped
// jsdom config), returns a transparent ImageData of the right size so the
// caller doesn't crash; in that case the symbol layer will render empty
// icons — visually broken but not fatal.
export function buildCategoryIcon(category: WaypointCategory): ImageData {
  const size = WAYPOINT_ICON_PX
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : null
  if (!canvas) {
    return makeEmptyImageData(size)
  }
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return makeEmptyImageData(size)

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 2

  // Filled disc — category color
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = WAYPOINT_CATEGORIES[category].color
  ctx.fill()

  // White outline (halo for contrast over basemap tiles)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  // Glyph
  ctx.fillStyle = '#FFFFFF'
  ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(GLYPHS[category], cx, cy + 1)

  return ctx.getImageData(0, 0, size, size)
}

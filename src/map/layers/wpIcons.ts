import { iconPath, type WaypointIcon } from '../../icons/waypointIcons'
import { WAYPOINT_ICON_PIXEL_RATIO, WAYPOINT_ICON_PX } from './layerStyles'

// Material Symbols are drawn on a 960-unit square whose viewBox starts at
// y = -960 (see SYMBOL_VIEWBOX).
const SYMBOL_UNITS = 960

// Fallback ImageData factory for environments where the global isn't available
// (e.g. jsdom without the canvas npm package). Returns an object that satisfies
// the { width, height, data } structural shape that MapLibre's addImage accepts.
export function makeEmptyImageData(size: number): ImageData {
  if (typeof ImageData !== 'undefined') {
    return new ImageData(size, size)
  }
  // Structural substitute — width, height, data as Uint8ClampedArray of zeros.
  // `as ImageData` is intentional: we only need the shape for addImage.
  return { width: size, height: size, data: new Uint8ClampedArray(size * size * 4) } as ImageData
}

// Renders a disc in `color` with a white halo and a white Material Symbol
// glyph, at WAYPOINT_ICON_PIXEL_RATIO× so it stays crisp on high-DPI screens;
// register it with that pixelRatio. If the platform lacks a 2D canvas, returns
// a transparent ImageData of the right size; without Path2D (jsdom) it draws
// the disc only — visually incomplete but not fatal.
export function buildWaypointIcon(
  icon: WaypointIcon,
  color: string,
): { data: ImageData; pixelRatio: number } {
  const pixelRatio = WAYPOINT_ICON_PIXEL_RATIO
  const size = WAYPOINT_ICON_PX * pixelRatio
  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : null
  if (!canvas) return { data: makeEmptyImageData(size), pixelRatio }
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return { data: makeEmptyImageData(size), pixelRatio }

  const cx = size / 2
  const cy = size / 2
  const halo = 2 * pixelRatio
  const radius = size / 2 - halo

  // Filled disc
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // White outline (halo for contrast over basemap tiles)
  ctx.lineWidth = halo
  ctx.strokeStyle = '#FFFFFF'
  ctx.stroke()

  // Glyph, scaled from the symbol's 960-unit square into the disc
  if (typeof Path2D !== 'undefined') {
    const glyph = size * 0.6
    ctx.save()
    ctx.translate(cx - glyph / 2, cy - glyph / 2)
    ctx.scale(glyph / SYMBOL_UNITS, glyph / SYMBOL_UNITS)
    ctx.translate(0, SYMBOL_UNITS)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill(new Path2D(iconPath(icon)))
    ctx.restore()
  }

  return { data: ctx.getImageData(0, 0, size, size), pixelRatio }
}

import {
  ATES_PATH_ARROW_PIXEL_RATIO,
  ATES_PATH_ARROW_PX,
  ATES_PATH_COLOR,
} from './layerStyles'
import { makeEmptyImageData } from './wpIcons'

const OUTLINE_PX = 1.5  // white outline, CSS px

// Draws an arrowhead pointing right (east) in a square image. A symbol layer
// with line placement turns the image's x-axis along the line, so the arrow
// points the way the path's coordinates run. Register with pixelRatio
// ATES_PATH_ARROW_PIXEL_RATIO. Canvas colours are literals: canvas can't read
// CSS custom properties.
export function buildAtesPathArrowIcon(): ImageData {
  const px = ATES_PATH_ARROW_PX * ATES_PATH_ARROW_PIXEL_RATIO
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return makeEmptyImageData(px)
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return makeEmptyImageData(px)

  ctx.scale(ATES_PATH_ARROW_PIXEL_RATIO, ATES_PATH_ARROW_PIXEL_RATIO)
  const size = ATES_PATH_ARROW_PX
  const inset = OUTLINE_PX + 1
  ctx.beginPath()
  ctx.moveTo(size - inset, size / 2)
  ctx.lineTo(inset, inset)
  ctx.lineTo(size * 0.3, size / 2)
  ctx.lineTo(inset, size - inset)
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = OUTLINE_PX
  ctx.strokeStyle = '#FFFFFF'
  ctx.fillStyle = ATES_PATH_COLOR
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, px, px)
}

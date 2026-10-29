import {
  PHOTO_ARROW_PIXEL_RATIO,
  PHOTO_ARROW_PX,
  PHOTO_DOT_COLOR,
  PHOTO_DOT_RADIUS,
  PHOTO_DOT_STROKE,
} from './layerStyles'
import { makeEmptyImageData } from './wpIcons'

const TIP_GAP_PX = 1.5   // room above the tip for its outline, CSS px
const HALF_WIDTH_PX = 5  // half the arrow's base, CSS px
const OUTLINE_PX = 1.5   // white outline, CSS px

export function photoArrowSizePx(): number {
  return PHOTO_ARROW_PX * PHOTO_ARROW_PIXEL_RATIO
}

// Draws an arrowhead pointing up (north) from the edge of a zoomed-in photo
// dot, in a square image centred on the dot. The symbol layer rotates it by
// the photo's bearing; register with pixelRatio PHOTO_ARROW_PIXEL_RATIO.
// Canvas colours are literals: canvas can't read CSS custom properties.
export function buildPhotoArrowIcon(): ImageData {
  const px = photoArrowSizePx()
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return makeEmptyImageData(px)
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return makeEmptyImageData(px)

  ctx.scale(PHOTO_ARROW_PIXEL_RATIO, PHOTO_ARROW_PIXEL_RATIO)
  const centre = PHOTO_ARROW_PX / 2
  // The base tucks under the dot's white ring.
  const base = centre - PHOTO_DOT_RADIUS.max - PHOTO_DOT_STROKE.max / 2

  ctx.beginPath()
  ctx.moveTo(centre, TIP_GAP_PX)
  ctx.lineTo(centre + HALF_WIDTH_PX, base)
  ctx.lineTo(centre - HALF_WIDTH_PX, base)
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = OUTLINE_PX
  ctx.strokeStyle = '#FFFFFF'
  ctx.fillStyle = PHOTO_DOT_COLOR
  ctx.fill()
  ctx.stroke()
  return ctx.getImageData(0, 0, px, px)
}

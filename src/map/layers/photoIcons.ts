import { PHOTO_ICON_PIXEL_RATIO, PHOTO_ICON_PX } from './layerStyles'
import { makeEmptyImageData } from './wpIcons'

const FRAME_PX = 2   // white border, CSS px
const SHADOW_PX = 3  // room around the tile for the drop shadow, CSS px

export function photoIconSizePx(): number {
  return (PHOTO_ICON_PX + SHADOW_PX * 2) * PHOTO_ICON_PIXEL_RATIO
}

// Centre-crops a width×height image to its largest square.
export function coverCrop(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.min(width, height)
  return { sx: Math.round((width - size) / 2), sy: Math.round((height - size) / 2), size }
}

interface IconSource {
  image: CanvasImageSource
  width: number
  height: number
}

// Draws the thumbnail as a square tile with a white frame and drop shadow and
// returns pixels for map.addImage (register with pixelRatio
// PHOTO_ICON_PIXEL_RATIO). A null source draws the placeholder tile shown
// while a thumbnail is still loading. Canvas colours are literals: canvas
// can't read CSS custom properties.
export function buildPhotoIcon(source: IconSource | null): ImageData {
  const px = photoIconSizePx()
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return makeEmptyImageData(px)
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return makeEmptyImageData(px)

  ctx.scale(PHOTO_ICON_PIXEL_RATIO, PHOTO_ICON_PIXEL_RATIO)
  const o = SHADOW_PX
  const box = PHOTO_ICON_PX
  const inner = box - FRAME_PX * 2

  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = SHADOW_PX
  ctx.shadowOffsetY = 1
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(o, o, box, box)
  ctx.shadowColor = 'transparent'

  if (source) {
    const { sx, sy, size } = coverCrop(source.width, source.height)
    ctx.drawImage(source.image, sx, sy, size, size, o + FRAME_PX, o + FRAME_PX, inner, inner)
  } else {
    ctx.fillStyle = '#475569'
    ctx.fillRect(o + FRAME_PX, o + FRAME_PX, inner, inner)
  }
  return ctx.getImageData(0, 0, px, px)
}

// Decodes a stored thumbnail JPEG into a framed map icon.
export async function loadPhotoIcon(thumb: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(thumb)
  try {
    return buildPhotoIcon({ image: bitmap, width: bitmap.width, height: bitmap.height })
  } finally {
    bitmap.close()
  }
}

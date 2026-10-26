import { PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE_PX, PHOTO_THUMB_EDGE_PX } from '../types'

export interface Size {
  width: number
  height: number
}

// Scales (width, height) so the longest edge is at most maxEdge, preserving
// aspect ratio. Never upscales.
export function fitWithin(width: number, height: number, maxEdge: number): Size {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export interface EncodedPhoto {
  blob: Blob
  thumb: Blob
  width: number
  height: number
}

// Decodes with EXIF orientation applied by the browser, then re-encodes as
// JPEG. Drawing through a canvas drops every metadata segment, so the output
// carries no EXIF (GPS, device serials, etc.). Do not also rotate by the EXIF
// Orientation tag — 'from-image' has already done it.
export async function encodePhoto(file: Blob): Promise<EncodedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const full = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE_PX)
    const thumbSize = fitWithin(bitmap.width, bitmap.height, PHOTO_THUMB_EDGE_PX)
    const blob = await drawToJpeg(bitmap, full)
    const thumb = await drawToJpeg(bitmap, thumbSize)
    return { blob, thumb, width: full.width, height: full.height }
  } finally {
    bitmap.close()
  }
}

// Regenerates a thumbnail from a stored full-size JPEG (backup restore).
export async function makeThumbnail(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    return await drawToJpeg(bitmap, fitWithin(bitmap.width, bitmap.height, PHOTO_THUMB_EDGE_PX))
  } finally {
    bitmap.close()
  }
}

async function drawToJpeg(source: CanvasImageSource, size: Size): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  // JPEG has no alpha channel; flatten transparent PNG pixels onto white.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size.width, size.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size.width, size.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))),
      'image/jpeg',
      PHOTO_JPEG_QUALITY,
    )
  })
}

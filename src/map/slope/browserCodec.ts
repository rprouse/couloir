import type { TileCodec } from './slopeProtocol'

// Real-browser codec. colorSpaceConversion/premultiplyAlpha 'none' are
// required: any colour management would corrupt the encoded elevations.
export const browserCodec: TileCodec = {
  async decode(blob) {
    const bitmap = await createImageBitmap(blob, {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return { rgba: data, width: canvas.width, height: canvas.height }
  },
  async encodePng(rgba, width, height) {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas unavailable')
    ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return blob.arrayBuffer()
  },
}

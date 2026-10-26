// Avalanche slope-angle bands. Literal hex (not CSS variables) because the
// colours are painted into raster pixels; the legend reads the same table.
export interface SlopeBand {
  minDeg: number
  maxDeg: number // exclusive
  color: string
  label: string
}

export const SLOPE_BANDS: readonly SlopeBand[] = [
  { minDeg: 27, maxDeg: 30, color: '#F5E400', label: '27–29°' },
  { minDeg: 30, maxDeg: 35, color: '#F59E0B', label: '30–34°' },
  { minDeg: 35, maxDeg: 40, color: '#EF4444', label: '35–39°' },
  { minDeg: 40, maxDeg: 45, color: '#A855F7', label: '40–44°' },
  { minDeg: 45, maxDeg: Infinity, color: '#111111', label: '45°+' },
]

const BAND_RGB = SLOPE_BANDS.map((b) => [
  parseInt(b.color.slice(1, 3), 16),
  parseInt(b.color.slice(3, 5), 16),
  parseInt(b.color.slice(5, 7), 16),
])

function bandIndex(deg: number): number {
  return SLOPE_BANDS.findIndex((b) => deg >= b.minDeg && deg < b.maxDeg)
}

export function bandForSlope(deg: number): SlopeBand | null {
  const idx = bandIndex(deg)
  return idx === -1 ? null : SLOPE_BANDS[idx]
}

// RGBA image: band colour at full alpha, transparent below the first band.
// Overall translucency comes from the layer's raster-opacity.
export function colorizeSlope(slope: Float32Array): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(slope.length * 4)
  for (let i = 0; i < slope.length; i++) {
    const idx = bandIndex(slope[i])
    if (idx === -1) continue
    out.set(BAND_RGB[idx], i * 4)
    out[i * 4 + 3] = 255
  }
  return out
}

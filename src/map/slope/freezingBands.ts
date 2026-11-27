// Freezing-level overlay: terrain above the freezing level (below 0 °C) and
// below it (above 0 °C). Literal hex for the same reason as SLOPE_BANDS: the
// colours are painted into raster pixels; the legend reads the same table.
export const FREEZING_BANDS = {
  above: { color: '#5AA9F2', label: 'Above freezing level (below 0 °C)' },
  below: { color: '#F08A3C', label: 'Below freezing level (above 0 °C)' },
} as const

const rgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]
const ABOVE_RGB = rgb(FREEZING_BANDS.above.color)
const BELOW_RGB = rgb(FREEZING_BANDS.below.color)

// RGBA image split at `levelM`: pixels at or above it in the "above" colour,
// the rest in the "below" colour, unknown (NaN) elevations transparent.
// Overall translucency comes from raster-opacity.
export function colorizeFreezing(
  elevations: Float32Array,
  levelM: number,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(elevations.length * 4)
  for (let i = 0; i < elevations.length; i++) {
    const e = elevations[i]
    if (Number.isNaN(e)) continue
    out.set(e >= levelM ? ABOVE_RGB : BELOW_RGB, i * 4)
    out[i * 4 + 3] = 255
  }
  return out
}

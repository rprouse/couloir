import { SLOPE_BANDS } from './slopeBands'

// Aspect sectors: the eight compass directions a slope can face, each 45°
// wide and centred on its bearing. Literal hex for the same reason as
// SLOPE_BANDS: the colours are painted into raster pixels.
export interface AspectSector {
  centerDeg: number
  color: string
  label: string
}

export const ASPECT_SECTORS: readonly AspectSector[] = [
  { centerDeg: 0, color: '#E5483D', label: 'N' },
  { centerDeg: 45, color: '#F29A38', label: 'NE' },
  { centerDeg: 90, color: '#F3DD4E', label: 'E' },
  { centerDeg: 135, color: '#83C95A', label: 'SE' },
  { centerDeg: 180, color: '#3DBFC4', label: 'S' },
  { centerDeg: 225, color: '#4A82E0', label: 'SW' },
  { centerDeg: 270, color: '#7C55D8', label: 'W' },
  { centerDeg: 315, color: '#CF4FB6', label: 'NW' },
]

// Ground flatter than the first slope band isn't avalanche terrain, and its
// aspect is mostly DEM noise, so it stays transparent.
export const ASPECT_MIN_SLOPE_DEG = SLOPE_BANDS[0].minDeg

const SECTOR_RGB = ASPECT_SECTORS.map((s) => [
  parseInt(s.color.slice(1, 3), 16),
  parseInt(s.color.slice(3, 5), 16),
  parseInt(s.color.slice(5, 7), 16),
])

function sectorIndex(aspectDeg: number): number {
  return Math.round(aspectDeg / 45) % ASPECT_SECTORS.length
}

export function sectorForAspect(aspectDeg: number): AspectSector {
  return ASPECT_SECTORS[sectorIndex(aspectDeg)]
}

// RGBA image: sector colour at full alpha where the slope is steep enough,
// transparent elsewhere. Overall translucency comes from raster-opacity.
export function colorizeAspect(
  aspect: Float32Array,
  slope: Float32Array,
): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(aspect.length * 4)
  for (let i = 0; i < aspect.length; i++) {
    // NaN fails both comparisons, so flat or unknown pixels are skipped.
    if (!(slope[i] >= ASPECT_MIN_SLOPE_DEG) || !(aspect[i] >= 0)) continue
    out.set(SECTOR_RGB[sectorIndex(aspect[i])], i * 4)
    out[i * 4 + 3] = 255
  }
  return out
}

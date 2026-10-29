// Slope maths for the slope-angle overlay. Pure functions over row-major
// grids; no DOM or MapLibre types so everything is unit-testable.

const EARTH_CIRCUMFERENCE_M = 40_075_016.686
const DEG = 180 / Math.PI

// Mapbox/Maptiler terrain-rgb: elevation = -10000 + (R·65536 + G·256 + B) · 0.1
export function decodeTerrainRgb(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i++) {
    const o = i * 4
    out[i] = -10000 + (rgba[o] * 65536 + rgba[o + 1] * 256 + rgba[o + 2]) * 0.1
  }
  return out
}

// Latitude (degrees) at the vertical centre of Web Mercator tile row y.
export function tileCenterLat(z: number, y: number): number {
  const n = Math.PI - (2 * Math.PI * (y + 0.5)) / 2 ** z
  return DEG * Math.atan(Math.sinh(n))
}

// Ground metres per pixel at the tile's centre latitude. Using one value per
// tile is < 1% off at z ≥ 10, which is below DEM noise.
export function metersPerPixel(z: number, y: number, tileSizePx: number): number {
  const lat = tileCenterLat(z, y) / DEG
  return (EARTH_CIRCUMFERENCE_M * Math.cos(lat)) / (tileSizePx * 2 ** z)
}

// Elevation gradient per pixel using Horn's 3×3 kernel: dzdx rises to the
// east, dzdy rises to the south (down the image). Pixels past the tile edge
// are linearly extrapolated (2·edge − inner) so a plane yields the exact
// gradient at the borders, avoiding a neighbour-tile fetch.
export interface Gradient {
  dzdx: Float32Array
  dzdy: Float32Array
}

export function hornGradient(
  elev: Float32Array,
  width: number,
  height: number,
  cellSizeM: number,
): Gradient {
  const at = (x: number, y: number): number => {
    if (x < 0) return 2 * at(0, y) - at(1, y)
    if (x >= width) return 2 * at(width - 1, y) - at(width - 2, y)
    if (y < 0) return 2 * at(x, 0) - at(x, 1)
    if (y >= height) return 2 * at(x, height - 1) - at(x, height - 2)
    return elev[y * width + x]
  }
  const dzdx = new Float32Array(width * height)
  const dzdy = new Float32Array(width * height)
  const denom = 8 * cellSizeM
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1)
      const d = at(x - 1, y), f = at(x + 1, y)
      const g = at(x - 1, y + 1), h = at(x, y + 1), i = at(x + 1, y + 1)
      dzdx[y * width + x] = (c + 2 * f + i - (a + 2 * d + g)) / denom
      dzdy[y * width + x] = (g + 2 * h + i - (a + 2 * b + c)) / denom
    }
  }
  return { dzdx, dzdy }
}

// Slope angle in degrees per pixel.
export function slopeFromGradient({ dzdx, dzdy }: Gradient): Float32Array {
  const out = new Float32Array(dzdx.length)
  for (let p = 0; p < out.length; p++) out[p] = DEG * Math.atan(Math.hypot(dzdx[p], dzdy[p]))
  return out
}

// Aspect: compass bearing (0 = N, clockwise, [0, 360)) the slope faces, i.e.
// the downhill direction. NaN on perfectly flat pixels, which face nowhere.
export function aspectFromGradient({ dzdx, dzdy }: Gradient): Float32Array {
  const out = new Float32Array(dzdx.length)
  for (let p = 0; p < out.length; p++) {
    if (dzdx[p] === 0 && dzdy[p] === 0) {
      out[p] = NaN
      continue
    }
    // Downhill is (−dzdx east, +dzdy north), since dzdy rises to the south.
    const bearing = DEG * Math.atan2(-dzdx[p], dzdy[p])
    out[p] = bearing < 0 ? bearing + 360 : bearing
  }
  return out
}

export function slopeDegrees(
  elev: Float32Array,
  width: number,
  height: number,
  cellSizeM: number,
): Float32Array {
  return slopeFromGradient(hornGradient(elev, width, height, cellSizeM))
}

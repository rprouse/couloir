import {
  aspectFromGradient,
  decodeTerrainRgb,
  hornGradient,
  metersPerPixel,
  slopeDegrees,
  tileCenterLat,
} from './slopeMath'

// Encodes an elevation (m) as terrain-rgb, the inverse of decodeTerrainRgb.
function encode(elevM: number): [number, number, number] {
  const v = Math.round((elevM + 10000) * 10)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function plane(w: number, h: number, f: (x: number, y: number) => number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = f(x, y)
  return out
}

describe('decodeTerrainRgb', () => {
  it('round-trips elevations at 0.1 m precision', () => {
    const elevs = [0, 1234.5, 3618.9, -50]
    const rgba = new Uint8ClampedArray(elevs.length * 4)
    elevs.forEach((e, i) => {
      rgba.set([...encode(e), 255], i * 4)
    })
    const out = decodeTerrainRgb(rgba, elevs.length, 1)
    elevs.forEach((e, i) => expect(out[i]).toBeCloseTo(e, 1))
  })
})

describe('tileCenterLat / metersPerPixel', () => {
  it('is 0° at the centre of the z0 tile', () => {
    expect(tileCenterLat(0, 0)).toBeCloseTo(0, 6)
  })

  it('puts Fernie (49.5°N) in z12 row 1397', () => {
    const lat = tileCenterLat(12, 1397)
    expect(lat).toBeGreaterThan(49.4)
    expect(lat).toBeLessThan(49.6)
  })

  it('matches the Web Mercator ground resolution at Fernie (z12, 512 px)', () => {
    const mpp = metersPerPixel(12, 1397, 512)
    const expected =
      (40_075_016.686 * Math.cos((tileCenterLat(12, 1397) * Math.PI) / 180)) / (512 * 4096)
    expect(mpp).toBeCloseTo(expected, 6)
    expect(mpp).toBeGreaterThan(12)
    expect(mpp).toBeLessThan(13)
  })
})

describe('slopeDegrees', () => {
  const W = 6
  const H = 5
  const CELL = 10
  const tanDeg = (deg: number) => Math.tan((deg * Math.PI) / 180)
  // Elevations are Float32, so expect agreement to ~0.01°, not exactly.

  it('is 0 everywhere on flat ground', () => {
    const s = slopeDegrees(plane(W, H, () => 1500), W, H, CELL)
    s.forEach((v) => expect(v).toBeCloseTo(0, 6))
  })

  it.each([0, 27, 30, 35, 45, 60])(
    'is %i° at every pixel, edges and corners included, on a tilted plane',
    (deg) => {
      const rise = CELL * tanDeg(deg)
      const s = slopeDegrees(plane(W, H, (x) => 1000 + x * rise), W, H, CELL)
      s.forEach((v) => expect(v).toBeCloseTo(deg, 2))
    },
  )

  it('handles a plane tilted along y and on the diagonal', () => {
    const rise = CELL * tanDeg(35)
    const sy = slopeDegrees(plane(W, H, (_x, y) => 1000 - y * rise), W, H, CELL)
    sy.forEach((v) => expect(v).toBeCloseTo(35, 2))
    const sd = slopeDegrees(plane(W, H, (x, y) => x * rise + y * rise), W, H, CELL)
    const expected = (Math.atan(Math.SQRT2 * tanDeg(35)) * 180) / Math.PI
    sd.forEach((v) => expect(v).toBeCloseTo(expected, 2))
  })
})

describe('aspectFromGradient', () => {
  const W = 6
  const H = 5
  const aspect = (f: (x: number, y: number) => number) =>
    aspectFromGradient(hornGradient(plane(W, H, f), W, H, 10))

  // Image x runs east and y runs south; each plane falls towards `facing`.
  it.each([
    ['N', 0, (_x: number, y: number) => y * 5],
    ['E', 90, (x: number) => -x * 5],
    ['S', 180, (_x: number, y: number) => -y * 5],
    ['W', 270, (x: number) => x * 5],
    ['NE', 45, (x: number, y: number) => y * 5 - x * 5],
    ['SW', 225, (x: number, y: number) => x * 5 - y * 5],
  ])('a plane falling to the %s faces %i° at every pixel', (_name, deg, f) => {
    aspect(f).forEach((v) => expect(v).toBeCloseTo(deg, 2))
  })

  it('is NaN on flat ground', () => {
    aspect(() => 1500).forEach((v) => expect(v).toBeNaN())
  })
})

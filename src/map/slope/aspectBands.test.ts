import { ASPECT_MIN_SLOPE_DEG, ASPECT_SECTORS, colorizeAspect, sectorForAspect } from './aspectBands'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('sectorForAspect', () => {
  it.each([
    [0, 'N'],
    [22.4, 'N'],
    [22.5, 'NE'],
    [90, 'E'],
    [179, 'S'],
    [250, 'W'],
    [315, 'NW'],
    [337.4, 'NW'],
    [337.5, 'N'],
    [359.9, 'N'],
  ])('%f° → %s', (deg, label) => {
    expect(sectorForAspect(deg).label).toBe(label)
  })
})

describe('colorizeAspect', () => {
  it('colours steep pixels by sector and leaves gentle ones transparent', () => {
    const rgba = colorizeAspect(
      new Float32Array([180, 180]),
      new Float32Array([ASPECT_MIN_SLOPE_DEG - 0.1, ASPECT_MIN_SLOPE_DEG]),
    )
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    const south = ASPECT_SECTORS.find((s) => s.label === 'S')!
    expect(Array.from(rgba.slice(4, 8))).toEqual([...rgb(south.color), 255])
  })

  it('treats NaN aspect or slope as transparent', () => {
    const rgba = colorizeAspect(new Float32Array([NaN, 90]), new Float32Array([30, NaN]))
    expect(Array.from(rgba)).toEqual(new Array(8).fill(0))
  })
})

import { SLOPE_BANDS, bandForSlope, colorizeSlope } from './slopeBands'

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

describe('bandForSlope', () => {
  it.each([
    [0, null],
    [11.9, null],
    [12, '12–24°'],
    [24.99, '12–24°'],
    [25, '25–29°'],
    [29.99, '25–29°'],
    [30, '30–34°'],
    [35, '35–39°'],
    [40, '40–44°'],
    [45, '45°+'],
    [70, '45°+'],
  ])('%f° → %s', (deg, label) => {
    expect(bandForSlope(deg)?.label ?? null).toBe(label)
  })
})

describe('colorizeSlope', () => {
  it('writes band colours opaque and below-threshold pixels fully transparent', () => {
    const rgba = colorizeSlope(new Float32Array([10, 32]))
    expect(Array.from(rgba.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(rgba.slice(4, 8))).toEqual([...rgb(SLOPE_BANDS[2].color), 255])
  })

  it('treats NaN as no band', () => {
    expect(Array.from(colorizeSlope(new Float32Array([NaN])))).toEqual([0, 0, 0, 0])
  })
})

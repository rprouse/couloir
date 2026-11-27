import { FREEZING_BANDS, colorizeFreezing } from './freezingBands'

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))

describe('colorizeFreezing', () => {
  it('colours pixels at or above the level as above, the rest as below, NaN transparent', () => {
    const out = colorizeFreezing(new Float32Array([1499, 1500, 2500, NaN]), 1500)
    const px = (i: number) => Array.from(out.slice(i * 4, i * 4 + 4))
    expect(px(0)).toEqual([...hex(FREEZING_BANDS.below.color), 255])
    expect(px(1)).toEqual([...hex(FREEZING_BANDS.above.color), 255])
    expect(px(2)).toEqual([...hex(FREEZING_BANDS.above.color), 255])
    expect(px(3)).toEqual([0, 0, 0, 0])
  })
})

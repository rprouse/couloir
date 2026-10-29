import { buildPhotoArrowIcon, photoArrowSizePx } from './photoIcons'

describe('buildPhotoArrowIcon', () => {
  it('returns square ImageData at the arrow pixel ratio', () => {
    const img = buildPhotoArrowIcon()
    expect(img.width).toBe(photoArrowSizePx())
    expect(img.height).toBe(photoArrowSizePx())
  })
})

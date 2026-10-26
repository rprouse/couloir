import { buildPhotoIcon, coverCrop, photoIconSizePx } from './photoIcons'

describe('coverCrop', () => {
  it('centre-crops landscape images to a square', () => {
    expect(coverCrop(128, 96)).toEqual({ sx: 16, sy: 0, size: 96 })
  })
  it('centre-crops portrait images to a square', () => {
    expect(coverCrop(96, 128)).toEqual({ sx: 0, sy: 16, size: 96 })
  })
})

describe('buildPhotoIcon', () => {
  it('returns ImageData sized for the frame + shadow at the icon pixel ratio', () => {
    const img = buildPhotoIcon(null)
    expect(img.width).toBe(photoIconSizePx())
    expect(img.height).toBe(photoIconSizePx())
  })
})

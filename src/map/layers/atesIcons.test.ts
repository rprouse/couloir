import { buildAtesPathArrowIcon } from './atesIcons'
import { ATES_PATH_ARROW_PIXEL_RATIO, ATES_PATH_ARROW_PX } from './layerStyles'

describe('buildAtesPathArrowIcon', () => {
  it('returns square ImageData at the arrow pixel ratio', () => {
    const img = buildAtesPathArrowIcon()
    expect(img.width).toBe(ATES_PATH_ARROW_PX * ATES_PATH_ARROW_PIXEL_RATIO)
    expect(img.height).toBe(ATES_PATH_ARROW_PX * ATES_PATH_ARROW_PIXEL_RATIO)
  })
})

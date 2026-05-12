import { categoryGlyph, buildCategoryIcon } from './wpIcons'
import { WAYPOINT_ICON_PX } from './layerStyles'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { WaypointCategory } from '../../types'

describe('categoryGlyph', () => {
  it('returns a single-character glyph for each category', () => {
    for (const k of Object.keys(WAYPOINT_CATEGORIES) as WaypointCategory[]) {
      const g = categoryGlyph(k)
      expect(g.length).toBeGreaterThan(0)
      expect(g.length).toBeLessThanOrEqual(2)
    }
  })

  it('is deterministic — same input, same output', () => {
    expect(categoryGlyph('summit')).toBe(categoryGlyph('summit'))
  })
})

describe('buildCategoryIcon', () => {
  it('returns ImageData sized to WAYPOINT_ICON_PX', () => {
    // jsdom provides a working OffscreenCanvas/HTMLCanvasElement 2d context
    // sufficient for shape/pixel checks. If the platform doesn't support it,
    // the helper falls back to an all-transparent ImageData of the right size.
    const img = buildCategoryIcon('summit')
    expect(img.width).toBe(WAYPOINT_ICON_PX)
    expect(img.height).toBe(WAYPOINT_ICON_PX)
    expect(img.data.byteLength).toBe(WAYPOINT_ICON_PX * WAYPOINT_ICON_PX * 4)
  })
})

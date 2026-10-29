import { buildWaypointIcon } from './wpIcons'
import { WAYPOINT_ICON_PIXEL_RATIO, WAYPOINT_ICON_PX } from './layerStyles'
import { iconPath } from '../../icons/waypointIcons'

const size = WAYPOINT_ICON_PX * WAYPOINT_ICON_PIXEL_RATIO

// jsdom has no 2D canvas; a recording fake stands in for one so the drawing
// itself can be checked. The real pixels are checked in the browser.
function fakeContext() {
  const fills: { style: string; path: unknown }[] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn((path?: unknown) => fills.push({ style: ctx.fillStyle, path })),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    })),
  }
  return { ctx, fills }
}

class FakePath2D {
  constructor(readonly d: string) {}
}

describe('buildWaypointIcon', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('draws a disc in the colour and the icon glyph in white at 2×', () => {
    const { ctx, fills } = fakeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    vi.stubGlobal('Path2D', FakePath2D)

    const { data, pixelRatio } = buildWaypointIcon('cabin', '#22C55E')

    expect(pixelRatio).toBe(WAYPOINT_ICON_PIXEL_RATIO)
    expect(data.width).toBe(size)
    expect(data.height).toBe(size)
    expect(fills).toEqual([
      { style: '#22C55E', path: undefined },
      { style: '#FFFFFF', path: new FakePath2D(iconPath('cabin')) },
    ])
  })

  it('draws the disc alone when Path2D is unavailable', () => {
    const { ctx, fills } = fakeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    vi.stubGlobal('Path2D', undefined)

    buildWaypointIcon('cabin', '#22C55E')
    expect(fills).toHaveLength(1)
  })

  it('returns a transparent image of the right size without a 2D context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const { data } = buildWaypointIcon('cabin', '#22C55E')
    expect(data.width).toBe(size)
    expect(data.data.every((v) => v === 0)).toBe(true)
  })
})

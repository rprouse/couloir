import type { RequestParameters } from 'maplibre-gl'
import {
  createOverlayLoader,
  parseOverlayUrl,
  registerOverlayProtocols,
  type TileCodec,
} from './overlayProtocol'
import { SLOPE_BANDS } from './slopeBands'
import { ASPECT_SECTORS } from './aspectBands'
import { metersPerPixel } from './slopeMath'

const TEMPLATE = 'https://dem.test/{z}/{x}/{y}.webp?key=K'
const W = 4
const Z = 12
const X = 738
const Y = 1397

// Terrain-rgb pixels for a plane tilted `deg` degrees along x, at the real
// ground resolution of the requested tile so the loader sees that slope.
function planeRgba(deg: number): Uint8ClampedArray {
  const cell = metersPerPixel(Z, Y, W)
  const rise = cell * Math.tan((deg * Math.PI) / 180)
  const rgba = new Uint8ClampedArray(W * W * 4)
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const v = Math.round((1500 + x * rise + 10000) * 10)
      rgba.set([(v >> 16) & 255, (v >> 8) & 255, v & 255, 255], (y * W + x) * 4)
    }
  }
  return rgba
}

function fakeCodec(rgba: Uint8ClampedArray) {
  const encodePng = vi.fn(async (_rgba: Uint8ClampedArray<ArrayBuffer>, _w: number, _h: number) => new ArrayBuffer(8))
  const codec: TileCodec = {
    decode: vi.fn(async () => ({ rgba, width: W, height: W })),
    encodePng,
  }
  return { codec, encodePng }
}

function response(status: number, body: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    blob: async () => new Blob(),
  } as unknown as Response
}

// Serves tiles.json for any key and a DEM tile with the given status.
function fakeFetch(opts: { tileStatus?: number; tilesJsonStatus?: number[] } = {}) {
  const tilesJsonStatuses = [...(opts.tilesJsonStatus ?? [])]
  return vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes('tiles.json')) {
      const status = tilesJsonStatuses.shift() ?? 200
      return response(status, { tiles: [TEMPLATE] })
    }
    return response(opts.tileStatus ?? 200)
  })
}

const params = (url = `slope://${Z}/${X}/${Y}`) => ({ url }) as RequestParameters

describe('parseOverlayUrl', () => {
  it('parses the overlay and z/x/y', () => {
    expect(parseOverlayUrl('slope://12/738/1397')).toEqual({ overlay: 'slope', z: 12, x: 738, y: 1397 })
    expect(parseOverlayUrl('aspect://12/738/1397')).toEqual({ overlay: 'aspect', z: 12, x: 738, y: 1397 })
  })
  it.each([
    'slope://12/738',
    'https://12/738/1397',
    'hillshade://12/738/1397',
    'slope://a/b/c',
    'slope://12/738/1397.png',
  ])('rejects %s', (url) => {
    expect(parseOverlayUrl(url)).toBeNull()
  })
})

describe('registerOverlayProtocols', () => {
  it('registers one shared loader under every overlay name', () => {
    const addProtocol = vi.fn()
    const { codec } = fakeCodec(planeRgba(10))
    registerOverlayProtocols(addProtocol, { fetchFn: fakeFetch() as unknown as typeof fetch, codec, getKey: () => 'K' })
    expect(addProtocol.mock.calls.map(([name]) => name)).toEqual(['slope', 'aspect'])
    expect(addProtocol.mock.calls[0][1]).toBe(addProtocol.mock.calls[1][1])
  })
})

describe('createOverlayLoader', () => {
  it('fetches the DEM tile from the tiles.json template, passing the abort signal', async () => {
    const fetchFn = fakeFetch()
    const { codec } = fakeCodec(planeRgba(32))
    const load = createOverlayLoader({ fetchFn: fetchFn as unknown as typeof fetch, codec, getKey: () => 'K' })
    const abort = new AbortController()
    const res = await load(params(), abort)
    expect(res.data).toBeInstanceOf(ArrayBuffer)
    const tileCall = fetchFn.mock.calls.find(([u]) => !u.includes('tiles.json'))!
    expect(tileCall[0]).toBe(`https://dem.test/${Z}/${X}/${Y}.webp?key=K`)
    expect(tileCall[1]?.signal).toBe(abort.signal)
  })

  it('colours the computed slope with the matching band', async () => {
    const { codec, encodePng } = fakeCodec(planeRgba(32))
    const load = createOverlayLoader({ fetchFn: fakeFetch() as unknown as typeof fetch, codec, getKey: () => 'K' })
    await load(params(), new AbortController())
    const [rgba, w, h] = encodePng.mock.calls[0]
    expect([w, h]).toEqual([W, W])
    const orange = [1, 3, 5].map((i) => parseInt(SLOPE_BANDS[2].color.slice(i, i + 2), 16))
    for (let p = 0; p < W * W; p++) {
      expect(Array.from(rgba.slice(p * 4, p * 4 + 4))).toEqual([...orange, 255])
    }
  })

  it('colours aspect tiles by the direction the slope faces', async () => {
    // planeRgba rises to the east, so the slope faces west.
    const { codec, encodePng } = fakeCodec(planeRgba(32))
    const load = createOverlayLoader({ fetchFn: fakeFetch() as unknown as typeof fetch, codec, getKey: () => 'K' })
    await load(params(`aspect://${Z}/${X}/${Y}`), new AbortController())
    const [rgba] = encodePng.mock.calls[0]
    const west = ASPECT_SECTORS.find((s) => s.label === 'W')!
    const expected = [1, 3, 5].map((i) => parseInt(west.color.slice(i, i + 2), 16))
    for (let p = 0; p < W * W; p++) {
      expect(Array.from(rgba.slice(p * 4, p * 4 + 4))).toEqual([...expected, 255])
    }
  })

  it('shares the tiles.json lookup across overlays', async () => {
    const fetchFn = fakeFetch()
    const { codec } = fakeCodec(planeRgba(10))
    const load = createOverlayLoader({ fetchFn: fetchFn as unknown as typeof fetch, codec, getKey: () => 'K' })
    await load(params(), new AbortController())
    await load(params(`aspect://${Z}/${X}/${Y}`), new AbortController())
    expect(fetchFn.mock.calls.filter(([u]) => u.includes('tiles.json'))).toHaveLength(1)
  })

  it('fetches tiles.json once per key and again when the key changes', async () => {
    const fetchFn = fakeFetch()
    let key = 'K1'
    const { codec } = fakeCodec(planeRgba(10))
    const load = createOverlayLoader({ fetchFn: fetchFn as unknown as typeof fetch, codec, getKey: () => key })
    await load(params(), new AbortController())
    await load(params(), new AbortController())
    key = 'K2'
    await load(params(), new AbortController())
    const tilesJsonCalls = fetchFn.mock.calls.filter(([u]) => u.includes('tiles.json'))
    expect(tilesJsonCalls).toHaveLength(2)
    expect(tilesJsonCalls[0][0]).toContain('key=K1')
    expect(tilesJsonCalls[1][0]).toContain('key=K2')
  })

  it('retries tiles.json after a failed lookup', async () => {
    const fetchFn = fakeFetch({ tilesJsonStatus: [500] })
    const { codec } = fakeCodec(planeRgba(10))
    const load = createOverlayLoader({ fetchFn: fetchFn as unknown as typeof fetch, codec, getKey: () => 'K' })
    await expect(load(params(), new AbortController())).rejects.toThrow(/tiles\.json returned 500/)
    await expect(load(params(), new AbortController())).resolves.toHaveProperty('data')
  })

  it.each([404, 204])('returns a transparent 1×1 tile when the DEM tile is %i', async (status) => {
    const { codec, encodePng } = fakeCodec(planeRgba(10))
    const load = createOverlayLoader({
      fetchFn: fakeFetch({ tileStatus: status }) as unknown as typeof fetch,
      codec,
      getKey: () => 'K',
    })
    await expect(load(params(), new AbortController())).resolves.toHaveProperty('data')
    expect(encodePng).toHaveBeenCalledWith(new Uint8ClampedArray(4), 1, 1)
    expect(codec.decode).not.toHaveBeenCalled()
  })

  it('rejects on other DEM errors', async () => {
    const { codec } = fakeCodec(planeRgba(10))
    const load = createOverlayLoader({
      fetchFn: fakeFetch({ tileStatus: 500 }) as unknown as typeof fetch,
      codec,
      getKey: () => 'K',
    })
    await expect(load(params(), new AbortController())).rejects.toThrow(/500/)
  })

  it('rejects without a key or with a malformed URL', async () => {
    const { codec } = fakeCodec(planeRgba(10))
    const fetchFn = fakeFetch() as unknown as typeof fetch
    const noKey = createOverlayLoader({ fetchFn, codec, getKey: () => null })
    await expect(noKey(params(), new AbortController())).rejects.toThrow(/key/i)
    const load = createOverlayLoader({ fetchFn, codec, getKey: () => 'K' })
    await expect(load(params('slope://nope'), new AbortController())).rejects.toThrow(/Malformed/)
  })
})

import type { GetResourceResponse, RequestParameters } from 'maplibre-gl'
import { decodeTerrainRgb, metersPerPixel, slopeDegrees } from './slopeMath'
import { colorizeSlope } from './slopeBands'
import { terrainSourceUrl } from '../mapConfig'
import { debug } from '../../utils/debug'

// Custom MapLibre protocol: slope://{z}/{x}/{y} → PNG tile shaded by slope
// angle, computed from the matching Maptiler terrain-rgb tile.
export const SLOPE_PROTOCOL = 'slope'
export const SLOPE_TILE_URL = `${SLOPE_PROTOCOL}://{z}/{x}/{y}`

export interface DecodedImage {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

// Image decode/encode lives behind this seam so the loader is testable
// without OffscreenCanvas (see browserCodec.ts for the real one).
export interface TileCodec {
  decode(blob: Blob): Promise<DecodedImage>
  encodePng(rgba: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): Promise<ArrayBuffer>
}

export interface SlopeLoaderDeps {
  fetchFn: typeof fetch
  codec: TileCodec
  getKey: () => string | null
}

export type SlopeLoader = (
  params: RequestParameters,
  abortController: AbortController,
) => Promise<GetResourceResponse<ArrayBuffer>>

const SLOPE_URL_RE = /^slope:\/\/(\d+)\/(\d+)\/(\d+)$/

export function parseSlopeUrl(url: string): { z: number; x: number; y: number } | null {
  const m = SLOPE_URL_RE.exec(url)
  if (!m) return null
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) }
}

export function createSlopeLoader(deps: SlopeLoaderDeps): SlopeLoader {
  const { fetchFn, codec, getKey } = deps
  // key → DEM tile URL template from tiles.json. A failed lookup is evicted so
  // the next tile retries instead of caching the failure.
  const templates = new Map<string, Promise<string>>()
  let transparentTile: Promise<ArrayBuffer> | null = null

  const templateFor = (key: string): Promise<string> => {
    let pending = templates.get(key)
    if (!pending) {
      pending = (async () => {
        const res = await fetchFn(terrainSourceUrl(key))
        if (!res.ok) throw new Error(`Terrain tiles.json returned ${res.status}`)
        const json = (await res.json()) as { tiles?: unknown }
        const tile = Array.isArray(json.tiles) ? json.tiles[0] : undefined
        if (typeof tile !== 'string') throw new Error('Terrain tiles.json has no tile URL')
        return tile
      })()
      pending.catch(() => templates.delete(key))
      templates.set(key, pending)
    }
    return pending
  }

  // Missing DEM tiles (ocean, outside coverage) render as nothing rather than
  // erroring, so they don't trip the tile-error banner.
  const emptyTile = (): Promise<ArrayBuffer> => {
    if (!transparentTile) {
      transparentTile = codec.encodePng(new Uint8ClampedArray(4), 1, 1)
      transparentTile.catch(() => {
        transparentTile = null
      })
    }
    return transparentTile
  }

  return async (params, abortController) => {
    const coords = parseSlopeUrl(params.url)
    if (!coords) throw new Error(`Malformed slope tile URL: ${params.url}`)
    const key = getKey()
    if (!key) throw new Error('No Maptiler key set')
    const { z, x, y } = coords
    const started = performance.now()

    const template = await templateFor(key)
    const demUrl = template
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y))
    const res = await fetchFn(demUrl, { signal: abortController.signal })
    if (res.status === 204 || res.status === 404) return { data: await emptyTile() }
    if (!res.ok) throw new Error(`Terrain tile returned ${res.status}`)

    const { rgba, width, height } = await codec.decode(await res.blob())
    const elevations = decodeTerrainRgb(rgba, width, height)
    const slope = slopeDegrees(elevations, width, height, metersPerPixel(z, y, width))
    const data = await codec.encodePng(colorizeSlope(slope), width, height)
    debug('slope tile', `${z}/${x}/${y}`, `${(performance.now() - started).toFixed(1)}ms`)
    return { data }
  }
}

export function registerSlopeProtocol(
  addProtocol: (name: string, loader: SlopeLoader) => void,
  deps: SlopeLoaderDeps,
): void {
  addProtocol(SLOPE_PROTOCOL, createSlopeLoader(deps))
}

import type { GetResourceResponse, RequestParameters } from 'maplibre-gl'
import {
  aspectFromGradient,
  decodeTerrainRgb,
  hornGradient,
  metersPerPixel,
  slopeFromGradient,
  type Gradient,
} from './slopeMath'
import { colorizeSlope } from './slopeBands'
import { colorizeAspect } from './aspectBands'
import { colorizeFreezing } from './freezingBands'
import { terrainSourceUrl } from '../mapConfig'
import { debug } from '../../utils/debug'
import { TERRAIN_OVERLAYS, type TerrainOverlay } from '../../types'

// Custom MapLibre protocols, one per terrain overlay: slope://{z}/{x}/{y},
// aspect://{z}/{x}/{y} and freezing://{z}/{x}/{y}?m=1850 → PNG tile shaded
// from the matching Maptiler terrain-rgb tile. The protocol name is the
// overlay name. The freezing overlay carries its split elevation (m) in the
// URL, so a new level is a new tile URL; without one its tiles are empty.
export function overlayTileUrl(overlay: TerrainOverlay, levelM?: number | null): string {
  const base = `${overlay}://{z}/{x}/{y}`
  return levelM === undefined || levelM === null ? base : `${base}?m=${Math.round(levelM)}`
}

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

export interface OverlayLoaderDeps {
  fetchFn: typeof fetch
  codec: TileCodec
  getKey: () => string | null
}

export type OverlayLoader = (
  params: RequestParameters,
  abortController: AbortController,
) => Promise<GetResourceResponse<ArrayBuffer>>

interface RenderInput {
  elevations: Float32Array
  // Horn gradient, computed only by the overlays that need it.
  gradient: () => Gradient
  levelM: number | null
}

const RENDERERS: Record<TerrainOverlay, (t: RenderInput) => Uint8ClampedArray<ArrayBuffer>> = {
  slope: (t) => colorizeSlope(slopeFromGradient(t.gradient())),
  aspect: (t) => {
    const g = t.gradient()
    return colorizeAspect(aspectFromGradient(g), slopeFromGradient(g))
  },
  freezing: (t) => colorizeFreezing(t.elevations, t.levelM ?? Infinity),
}

const OVERLAY_URL_RE = new RegExp(
  `^(${TERRAIN_OVERLAYS.join('|')})://(\\d+)/(\\d+)/(\\d+)(?:\\?m=(-?\\d+))?$`,
)

export function parseOverlayUrl(
  url: string,
): { overlay: TerrainOverlay; z: number; x: number; y: number; levelM: number | null } | null {
  const m = OVERLAY_URL_RE.exec(url)
  if (!m) return null
  return {
    overlay: m[1] as TerrainOverlay,
    z: Number(m[2]),
    x: Number(m[3]),
    y: Number(m[4]),
    levelM: m[5] === undefined ? null : Number(m[5]),
  }
}

// One loader serves every overlay protocol so they share the tiles.json
// lookup and the empty tile.
export function createOverlayLoader(deps: OverlayLoaderDeps): OverlayLoader {
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
    const coords = parseOverlayUrl(params.url)
    if (!coords) throw new Error(`Malformed overlay tile URL: ${params.url}`)
    const key = getKey()
    if (!key) throw new Error('No Maptiler key set')
    const { overlay, z, x, y, levelM } = coords
    // No freezing level yet (still loading, or the model has none): draw
    // nothing and spend no Maptiler request.
    if (overlay === 'freezing' && levelM === null) return { data: await emptyTile() }
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
    const gradient = () => hornGradient(elevations, width, height, metersPerPixel(z, y, width))
    const data = await codec.encodePng(RENDERERS[overlay]({ elevations, gradient, levelM }), width, height)
    debug(`${overlay} tile`, `${z}/${x}/${y}`, `${(performance.now() - started).toFixed(1)}ms`)
    return { data }
  }
}

export function registerOverlayProtocols(
  addProtocol: (name: string, loader: OverlayLoader) => void,
  deps: OverlayLoaderDeps,
): void {
  const loader = createOverlayLoader(deps)
  for (const overlay of TERRAIN_OVERLAYS) addProtocol(overlay, loader)
}

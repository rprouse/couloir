import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import type { TerrainOverlay } from '../../types'
import { overlayTileUrl } from '../slope/overlayProtocol'
import {
  COULOIR_OVERLAY_LAYER_IDS,
  DEM_MAX_ZOOM,
  DEM_TILE_SIZE,
  OVERLAY_LAYER_IDS,
  OVERLAY_MIN_ZOOM,
  OVERLAY_SOURCE_IDS,
} from './layerStyles'

// The overlay goes under the basemap's labels and under every Couloir layer:
// the first layer that is either a basemap symbol layer or one of ours.
export function overlayBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? []
  return layers.find((l) => l.type === 'symbol' || COULOIR_OVERLAY_LAYER_IDS.includes(l.id))?.id
}

export function TerrainOverlayLayer({ overlay }: { overlay: TerrainOverlay }): null {
  const map = useMap()
  const visible = useUiStore((s) => s.terrainOverlay === overlay)
  const opacity = useUiStore((s) => s.overlayOpacity)
  const sourceId = OVERLAY_SOURCE_IDS[overlay]
  const layerId = OVERLAY_LAYER_IDS[overlay]

  // (1) Install on every style.load (basemap/key change clears sources).
  // The layer is always present; toggling only flips visibility so its
  // place in the stack is fixed and computed tiles aren't thrown away.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(sourceId)) return
      const { terrainOverlay, overlayOpacity } = useUiStore.getState()
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [overlayTileUrl(overlay)],
        tileSize: DEM_TILE_SIZE,
        minzoom: OVERLAY_MIN_ZOOM,
        maxzoom: DEM_MAX_ZOOM,
      })
      map.addLayer(
        {
          id: layerId,
          type: 'raster',
          source: sourceId,
          minzoom: OVERLAY_MIN_ZOOM,
          paint: { 'raster-opacity': overlayOpacity, 'raster-fade-duration': 0 },
          layout: { visibility: terrainOverlay === overlay ? 'visible' : 'none' },
        },
        overlayBeforeId(map),
      )
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)
    return () => {
      map.off('style.load', install)
    }
  }, [map, overlay, sourceId, layerId])

  // (2) Visibility toggle.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(layerId)) return
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none')
  }, [map, layerId, visible])

  // (3) Opacity setting.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(layerId)) return
    map.setPaintProperty(layerId, 'raster-opacity', opacity)
  }, [map, layerId, opacity])

  return null
}

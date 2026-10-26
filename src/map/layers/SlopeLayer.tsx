import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { SLOPE_TILE_URL } from '../slope/slopeProtocol'
import {
  COULOIR_OVERLAY_LAYER_IDS,
  DEM_MAX_ZOOM,
  DEM_TILE_SIZE,
  SLOPE_LAYER_ID,
  SLOPE_MIN_ZOOM,
  SLOPE_SOURCE_ID,
} from './layerStyles'

// The overlay goes under the basemap's labels and under every Couloir layer:
// the first layer that is either a basemap symbol layer or one of ours.
export function slopeBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? []
  return layers.find((l) => l.type === 'symbol' || COULOIR_OVERLAY_LAYER_IDS.includes(l.id))?.id
}

export function SlopeLayer(): null {
  const map = useMap()
  const enabled = useUiStore((s) => s.slopeEnabled)
  const opacity = useUiStore((s) => s.slopeOpacity)

  // (1) Install on every style.load (basemap/key change clears sources).
  // The layer is always present; toggling only flips visibility so its
  // place in the stack is fixed and computed tiles aren't thrown away.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(SLOPE_SOURCE_ID)) return
      const { slopeEnabled, slopeOpacity } = useUiStore.getState()
      map.addSource(SLOPE_SOURCE_ID, {
        type: 'raster',
        tiles: [SLOPE_TILE_URL],
        tileSize: DEM_TILE_SIZE,
        minzoom: SLOPE_MIN_ZOOM,
        maxzoom: DEM_MAX_ZOOM,
      })
      map.addLayer(
        {
          id: SLOPE_LAYER_ID,
          type: 'raster',
          source: SLOPE_SOURCE_ID,
          minzoom: SLOPE_MIN_ZOOM,
          paint: { 'raster-opacity': slopeOpacity, 'raster-fade-duration': 0 },
          layout: { visibility: slopeEnabled ? 'visible' : 'none' },
        },
        slopeBeforeId(map),
      )
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)
    return () => {
      map.off('style.load', install)
    }
  }, [map])

  // (2) Visibility toggle.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(SLOPE_LAYER_ID)) return
    map.setLayoutProperty(SLOPE_LAYER_ID, 'visibility', enabled ? 'visible' : 'none')
  }, [map, enabled])

  // (3) Opacity slider.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(SLOPE_LAYER_ID)) return
    map.setPaintProperty(SLOPE_LAYER_ID, 'raster-opacity', opacity)
  }, [map, opacity])

  return null
}

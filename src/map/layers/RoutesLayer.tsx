import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useRoutesStore } from '../../store/routes'
import { useUiStore } from '../../store/ui'
import { buildRoutesGeoJson } from './routesLayerData'
import {
  ROUTES_GLOW_LAYER_ID,
  ROUTES_LINE_LAYER_ID,
  ROUTES_SOURCE_ID,
  ROUTE_LINE_GLOW_OPACITY,
  ROUTE_LINE_GLOW_WIDTH,
  ROUTE_LINE_WIDTH,
} from './layerStyles'

export function RoutesLayer(): null {
  const map = useMap()
  const routes = useRoutesStore((s) => s.routes)
  const visible = useUiStore((s) => s.layerVisibility.routes)

  // (1) Add source and layers when the map first becomes available.
  // setStyle() (basemap or key change) wipes sources, so re-attach on every
  // style.load — same pattern as the DEM source in MapView.tsx.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(ROUTES_SOURCE_ID)) return
      map.addSource(ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: ROUTES_GLOW_LAYER_ID,
        type: 'line',
        source: ROUTES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ROUTE_LINE_GLOW_WIDTH,
          'line-opacity': ROUTE_LINE_GLOW_OPACITY,
          'line-blur': 1,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: ROUTES_LINE_LAYER_ID,
        type: 'line',
        source: ROUTES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ROUTE_LINE_WIDTH,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    install()
    map.on('style.load', install)

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('route', id)
      }
    }
    map.on('click', ROUTES_LINE_LAYER_ID, onClick)
    // Cursor affordance — show pointer when hovering a clickable line.
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }
    map.on('mouseenter', ROUTES_LINE_LAYER_ID, onEnter)
    map.on('mouseleave', ROUTES_LINE_LAYER_ID, onLeave)

    return () => {
      map.off('style.load', install)
      map.off('click', ROUTES_LINE_LAYER_ID, onClick)
      map.off('mouseenter', ROUTES_LINE_LAYER_ID, onEnter)
      map.off('mouseleave', ROUTES_LINE_LAYER_ID, onLeave)
    }
  }, [map])

  // (2) Sync GeoJSON when routes change.
  useEffect(() => {
    if (!map) return
    const src = map.getSource(ROUTES_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    ;(src as GeoJSONSource).setData(buildRoutesGeoJson(routes) as never)
  }, [map, routes])

  // (3) Sync visibility on toggle change.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(ROUTES_LINE_LAYER_ID)) return
    const value = visible ? 'visible' : 'none'
    map.setLayoutProperty(ROUTES_LINE_LAYER_ID, 'visibility', value)
    map.setLayoutProperty(ROUTES_GLOW_LAYER_ID, 'visibility', value)
  }, [map, visible])

  return null
}

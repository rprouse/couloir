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

  // (1) Add source and layers once the style is ready. addSource/addLayer
  // throw "Style is not done loading" if called before MapLibre has fetched
  // and parsed the style JSON — install() must wait for style.load.
  // setStyle() (basemap or key change) re-fires style.load; the listener
  // covers both first-load and subsequent style swaps.
  // install() reads fresh state from the stores so it can run later via
  // style.load with current data, not whatever was in scope at mount time.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(ROUTES_SOURCE_ID)) return
      const initialRoutes = useRoutesStore.getState().routes
      const initialVisible = useUiStore.getState().layerVisibility.routes
      const visibility = initialVisible ? 'visible' : 'none'
      map.addSource(ROUTES_SOURCE_ID, {
        type: 'geojson',
        data: buildRoutesGeoJson(initialRoutes) as never,
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
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      })
      map.addLayer({
        id: ROUTES_LINE_LAYER_ID,
        type: 'line',
        source: ROUTES_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ROUTE_LINE_WIDTH,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('route', id)
      }
    }
    map.on('click', ROUTES_LINE_LAYER_ID, onClick)
    // Cursor affordance — show pointer when hovering a clickable line.
    // Guard against overriding the placement-mode crosshair.
    const onEnter = () => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      if (useUiStore.getState().placement.mode === 'idle') {
        map.getCanvas().style.cursor = ''
      }
    }
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
  // The source may not exist yet — install() runs on style.load, which is
  // asynchronous. install() seeds the source with the current routes via
  // useRoutesStore.getState(), so the initial data isn't lost; this effect
  // handles every subsequent change. The guard short-circuits cleanly when
  // the source isn't installed yet.
  useEffect(() => {
    if (!map) return
    const src = map.getSource(ROUTES_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    // Local FeatureCollection in routesLayerData.ts uses Route['geojson']
    // (LineStringZ — Z required) rather than GeoJSON.LineString (Z optional).
    // setData accepts the value at runtime; `as never` documents that we've
    // intentionally avoided pulling @types/geojson into the helper just to
    // satisfy a structural shape that's already correct for our use.
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

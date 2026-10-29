import { useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { filterByTags } from '../../utils/tags'
import { buildWaypointsGeoJson } from './waypointsLayerData'
import { buildWaypointIcon } from './wpIcons'
import { parseWaypointImageId } from '../../icons/waypointIcons'
import {
  WAYPOINTS_SOURCE_ID,
  WAYPOINTS_SYMBOLS_LAYER_ID,
} from './layerStyles'
import { debug } from '../../utils/debug'

export function WaypointsLayer(): null {
  const map = useMap()
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const tagFilter = useUiStore((s) => s.tagFilters.waypoints)
  const shown = useMemo(() => filterByTags(waypoints, tagFilter), [waypoints, tagFilter])
  const visible = useUiStore((s) => s.layerVisibility.waypoints)

  // Drag state lives in a ref because mousemove handlers fire on every pixel
  // and we don't want to re-bind React state for each one. dragging.id is set
  // by mousedown, mutated by mousemove (locally + via setData for live
  // feedback), and committed via update() on mouseup.
  const drag = useRef<{
    id: string | null
    lat: number
    lng: number
  }>({ id: null, lat: 0, lng: 0 })

  // Install source + layers on style.load. Marker images are drawn on demand:
  // each feature names its image ('wp:<icon>:<HEX>') and MapLibre asks for
  // any it doesn't have via styleimagemissing. That covers every icon/colour
  // mix and re-registers them after a basemap switch clears the style's
  // images. Re-registering an image with the same name throws — guard with
  // hasImage.
  useEffect(() => {
    if (!map) return

    const onImageMissing = (e: { id: string }) => {
      const parsed = parseWaypointImageId(e.id)
      if (!parsed || map.hasImage(e.id)) return
      const { data, pixelRatio } = buildWaypointIcon(parsed.icon, parsed.color)
      map.addImage(e.id, data, { pixelRatio })
    }
    map.on('styleimagemissing', onImageMissing)

    const install = () => {
      if (map.getSource(WAYPOINTS_SOURCE_ID)) return

      const initialWaypoints = filterByTags(
        useWaypointsStore.getState().waypoints,
        useUiStore.getState().tagFilters.waypoints,
      )
      const initialVisible = useUiStore.getState().layerVisibility.waypoints
      const visibility = initialVisible ? 'visible' : 'none'

      map.addSource(WAYPOINTS_SOURCE_ID, {
        type: 'geojson',
        data: buildWaypointsGeoJson(initialWaypoints) as never,
      })
      map.addLayer({
        id: WAYPOINTS_SYMBOLS_LAYER_ID,
        type: 'symbol',
        source: WAYPOINTS_SOURCE_ID,
        layout: {
          'icon-image': ['get', 'image'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          visibility,
        },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    // Click → open detail panel
    const onClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('waypoint', id)
      }
    }
    map.on('click', WAYPOINTS_SYMBOLS_LAYER_ID, onClick)

    // Cursor affordance — move when hovering a draggable waypoint
    const onEnter = () => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      map.getCanvas().style.cursor = 'move'
    }
    const onLeave = () => {
      // Don't override placement-mode crosshair while placement is active.
      if (useUiStore.getState().placement.mode === 'idle') {
        map.getCanvas().style.cursor = ''
      }
    }
    map.on('mouseenter', WAYPOINTS_SYMBOLS_LAYER_ID, onEnter)
    map.on('mouseleave', WAYPOINTS_SYMBOLS_LAYER_ID, onLeave)

    // Drag-to-reposition. Starts on mousedown over a symbol; disables dragPan
    // for the duration; updates the source data live; commits via update()
    // on mouseup. If placement mode is active we skip the drag — clicking the
    // map in placement mode is the click-to-place gesture.
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drag.current.id) return
      drag.current.lat = e.lngLat.lat
      drag.current.lng = e.lngLat.lng
      // Live feedback: rebuild GeoJSON from the store + the in-flight point.
      const src = map.getSource(WAYPOINTS_SOURCE_ID)
      if (!src || src.type !== 'geojson') return
      // Filtered so a drag doesn't briefly show waypoints hidden by the tag filter.
      const wps = filterByTags(
        useWaypointsStore.getState().waypoints,
        useUiStore.getState().tagFilters.waypoints,
      ).map((w) =>
        w.id === drag.current.id
          ? { ...w, lat: drag.current.lat, lng: drag.current.lng }
          : w,
      )
      ;(src as GeoJSONSource).setData(buildWaypointsGeoJson(wps) as never)
    }

    const onMouseUp = async () => {
      const { id, lat, lng } = drag.current
      drag.current = { id: null, lat: 0, lng: 0 }
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      window.removeEventListener('mouseup', onWindowMouseUp)
      map.dragPan.enable()
      if (!id) return
      // Commit. The store update flips updated_at and re-renders the layer,
      // which converges the visual state with the persisted state.
      try {
        await useWaypointsStore.getState().update(id, { lat, lng })
      } catch (err) {
        debug('waypoint drag-reposition failed', err)
      }
    }

    // Safety net: if the mouse is released outside the map canvas, MapLibre
    // never fires its 'mouseup'. This window-level listener ensures dragPan is
    // re-enabled and the drag state is cleared regardless. The drag-state guard
    // inside onMouseUp makes the call idempotent.
    const onWindowMouseUp = () => {
      void onMouseUp()
    }

    const onMouseDown = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id !== 'string') return
      e.preventDefault()
      drag.current = { id, lat: e.lngLat.lat, lng: e.lngLat.lng }
      map.dragPan.disable()
      map.on('mousemove', onMouseMove)
      map.on('mouseup', onMouseUp)
      window.addEventListener('mouseup', onWindowMouseUp)
    }

    map.on('mousedown', WAYPOINTS_SYMBOLS_LAYER_ID, onMouseDown)

    return () => {
      map.off('styleimagemissing', onImageMissing)
      map.off('style.load', install)
      map.off('click', WAYPOINTS_SYMBOLS_LAYER_ID, onClick)
      map.off('mouseenter', WAYPOINTS_SYMBOLS_LAYER_ID, onEnter)
      map.off('mouseleave', WAYPOINTS_SYMBOLS_LAYER_ID, onLeave)
      map.off('mousedown', WAYPOINTS_SYMBOLS_LAYER_ID, onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      window.removeEventListener('mouseup', onWindowMouseUp)
    }
  }, [map])

  // Sync GeoJSON on waypoint or tag-filter changes. Guards on the source not yet existing
  // (style.load is async) — install() seeds the initial data via getState().
  useEffect(() => {
    if (!map) return
    const src = map.getSource(WAYPOINTS_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    ;(src as GeoJSONSource).setData(buildWaypointsGeoJson(shown) as never)
  }, [map, shown])

  // Toggle visibility from the Layer panel.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(WAYPOINTS_SYMBOLS_LAYER_ID)) return
    map.setLayoutProperty(
      WAYPOINTS_SYMBOLS_LAYER_ID,
      'visibility',
      visible ? 'visible' : 'none',
    )
  }, [map, visible])

  return null
}

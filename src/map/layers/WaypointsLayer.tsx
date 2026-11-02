import { useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useWaypointsStore } from '../../store/waypoints'
import { draftNumber, useUiStore, type PanelState } from '../../store/ui'
import type { Waypoint } from '../../types'
import { filterByTags } from '../../utils/tags'
import { buildWaypointsGeoJson } from './waypointsLayerData'
import { buildWaypointIcon } from './wpIcons'
import { parseWaypointImageId } from '../../icons/waypointIcons'
import {
  MARKER_ICON_SIZE,
  WAYPOINTS_SOURCE_ID,
  WAYPOINTS_SYMBOLS_LAYER_ID,
} from './layerStyles'

// The id of the waypoint whose detail panel is in edit mode, or null.
function editingWaypointId(panel: PanelState): string | null {
  return panel.mode === 'edit' && panel.entityType === 'waypoint' ? panel.entityId : null
}

// While a waypoint is edited, the map shows it at the draft position (a drag
// or typed coordinates) rather than the stored one; Save commits it.
function withDraftPosition(
  waypoints: Waypoint[],
  editingId: string | null,
  lat: number | null,
  lng: number | null,
): Waypoint[] {
  if (editingId === null || lat === null || lng === null) return waypoints
  return waypoints.map((w) => (w.id === editingId ? { ...w, lat, lng } : w))
}

// A waypoint can be dragged only while its own detail panel is in edit mode;
// otherwise a click (which always jiggles the mouse a little) would move it.
function isDraggable(id: unknown): id is string {
  const { panel, placement } = useUiStore.getState()
  return (
    typeof id === 'string' &&
    placement.mode === 'idle' &&
    panel.mode === 'edit' &&
    panel.entityType === 'waypoint' &&
    panel.entityId === id
  )
}

export function WaypointsLayer(): null {
  const map = useMap()
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const tagFilter = useUiStore((s) => s.tagFilters.waypoints)
  const editingId = useUiStore((s) => editingWaypointId(s.panel))
  const draftLat = useUiStore((s) => (editingWaypointId(s.panel) ? draftNumber(s.panel, 'lat') : null))
  const draftLng = useUiStore((s) => (editingWaypointId(s.panel) ? draftNumber(s.panel, 'lng') : null))
  const shown = useMemo(
    () => withDraftPosition(filterByTags(waypoints, tagFilter), editingId, draftLat, draftLng),
    [waypoints, tagFilter, editingId, draftLat, draftLng],
  )
  const visible = useUiStore((s) => s.layerVisibility.waypoints)

  // Drag state lives in a ref because mousemove handlers fire on every pixel
  // and we don't want to re-bind React state for each one. dragging.id is set
  // by mousedown, mutated by mousemove (locally + via setData for live
  // feedback), and written to the edit panel's draft on mouseup.
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
          'icon-size': MARKER_ICON_SIZE,
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

    // Cursor affordance — move over the waypoint being edited, pointer over
    // the rest (they open on click).
    const onEnter = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id: unknown = e.features?.[0]?.properties?.id
      map.getCanvas().style.cursor = isDraggable(id) ? 'move' : 'pointer'
    }
    const onLeave = () => {
      // Don't override placement-mode crosshair while placement is active.
      if (useUiStore.getState().placement.mode === 'idle') {
        map.getCanvas().style.cursor = ''
      }
    }
    map.on('mouseenter', WAYPOINTS_SYMBOLS_LAYER_ID, onEnter)
    map.on('mouseleave', WAYPOINTS_SYMBOLS_LAYER_ID, onLeave)

    // Drag-to-reposition. Starts on mousedown over the waypoint being edited
    // (see isDraggable); disables dragPan for the duration; updates the source
    // data live; writes the edit draft on mouseup (the panel's Save stores
    // it). Placement mode skips the drag — clicking the map then is the
    // click-to-place gesture.
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

    const onMouseUp = () => {
      const { id, lat, lng } = drag.current
      drag.current = { id: null, lat: 0, lng: 0 }
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      window.removeEventListener('mouseup', onWindowMouseUp)
      map.dragPan.enable()
      if (!id) return
      // Only into the draft: the edit form picks it up, and Save or Cancel
      // decides. The layer re-renders from the draft, keeping the new spot.
      const ui = useUiStore.getState()
      if (editingWaypointId(ui.panel) === id) ui.updateDraft({ lat, lng })
    }

    // Safety net: if the mouse is released outside the map canvas, MapLibre
    // never fires its 'mouseup'. This window-level listener ensures dragPan is
    // re-enabled and the drag state is cleared regardless. The drag-state guard
    // inside onMouseUp makes the call idempotent.
    const onWindowMouseUp = () => onMouseUp()

    const onMouseDown = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      const id: unknown = e.features?.[0]?.properties?.id
      if (!isDraggable(id)) return
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

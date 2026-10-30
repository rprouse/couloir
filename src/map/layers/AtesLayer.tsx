import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useAtesAreasStore } from '../../store/atesAreas'
import { parseWaypointImageId, waypointImageId } from '../../icons/waypointIcons'
import { ATES_POI_TYPES } from '../../types'
import { useUiStore } from '../../store/ui'
import { atesClassColorExpression, buildAtesGeoJson } from './atesLayerData'
import { atesPopupContent } from './atesPopup'
import { buildWaypointIcon } from './wpIcons'
import styles from './AtesLayer.module.css'
import {
  ATES_ACCESS_COLOR,
  ATES_ACCESS_LAYER_ID,
  ATES_AREA_COLOR,
  ATES_AREA_LAYER_ID,
  ATES_ATTRIBUTION,
  ATES_DECISION_COLOR,
  ATES_DECISION_LAYER_ID,
  ATES_FILL_LAYER_ID,
  ATES_LAYER_IDS,
  ATES_LINE_WIDTH,
  ATES_LINES_LAYER_ID,
  ATES_OUTLINE_COLOR,
  ATES_OUTLINE_LAYER_ID,
  ATES_PATH_COLOR,
  ATES_PATHS_LAYER_ID,
  ATES_POI_COLOR,
  ATES_POI_ICONS,
  ATES_POI_LAYER_ID,
  ATES_SOURCE_ID,
  COULOIR_OVERLAY_LAYER_IDS,
} from './layerStyles'

// Routes, tracks, waypoints and photos: drawn above ATES and win a click.
const ENTITY_LAYER_IDS = COULOIR_OVERLAY_LAYER_IDS.filter(
  (id) => !(ATES_LAYER_IDS as readonly string[]).includes(id),
)

// ATES goes under the basemap's labels and under Couloir's entity layers, so
// above the slope/aspect raster (which goes under every Couloir layer).
export function atesBeforeId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? []
  return layers.find((l) => l.type === 'symbol' || ENTITY_LAYER_IDS.includes(l.id))?.id
}

const kindIs = (kind: string) => ['==', ['get', 'kind'], kind]

// Point of interest → its waypoint-style marker image.
const poiImage = [
  'match',
  ['get', 'poi'],
  ...ATES_POI_TYPES.flatMap((t) => [t, waypointImageId(ATES_POI_ICONS[t], ATES_POI_COLOR)]),
  waypointImageId(ATES_POI_ICONS.other, ATES_POI_COLOR),
]

// Clickable layers, and which kind of feature wins when several are hit.
const CLICK_LAYER_IDS = [ATES_POI_LAYER_ID, ATES_DECISION_LAYER_ID, ATES_ACCESS_LAYER_ID, ATES_FILL_LAYER_ID]
const CLICK_PRIORITY = ['poi', 'decision_point', 'access_route', 'zone']
const POINTER_LAYER_IDS = [ATES_POI_LAYER_ID, ATES_DECISION_LAYER_ID]

export function AtesLayer(): null {
  const map = useMap()
  const areas = useAtesAreasStore((s) => s.areas)
  const visible = useUiStore((s) => s.atesEnabled)
  const opacity = useUiStore((s) => s.atesOpacity)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // (1) Install on every style.load (basemap/key change clears sources), plus
  // the click popup and point cursor.
  useEffect(() => {
    if (!map) return

    // Point-of-interest markers use waypoint image ids. WaypointsLayer draws
    // those on demand too; hasImage keeps the two handlers from both adding.
    const onImageMissing = (e: { id: string }) => {
      const parsed = parseWaypointImageId(e.id)
      if (!parsed || map.hasImage(e.id)) return
      const { data, pixelRatio } = buildWaypointIcon(parsed.icon, parsed.color)
      map.addImage(e.id, data, { pixelRatio })
    }
    map.on('styleimagemissing', onImageMissing)

    const install = () => {
      if (map.getSource(ATES_SOURCE_ID)) return
      const { atesEnabled, atesOpacity } = useUiStore.getState()
      const visibility = atesEnabled ? 'visible' : 'none'
      map.addSource(ATES_SOURCE_ID, {
        type: 'geojson',
        // Local FeatureCollection types (no @types/geojson); see RoutesLayer.
        data: buildAtesGeoJson(useAtesAreasStore.getState().areas) as never,
        attribution: ATES_ATTRIBUTION,
      })
      const before = atesBeforeId(map)
      const color = atesClassColorExpression() as never
      const add = (layer: Record<string, unknown>) =>
        map.addLayer({ source: ATES_SOURCE_ID, ...layer } as never, before)

      add({
        id: ATES_FILL_LAYER_ID,
        type: 'fill',
        filter: kindIs('zone'),
        paint: { 'fill-color': color, 'fill-opacity': atesOpacity },
        layout: { visibility },
      })
      add({
        id: ATES_OUTLINE_LAYER_ID,
        type: 'line',
        filter: kindIs('zone'),
        paint: { 'line-color': ATES_OUTLINE_COLOR, 'line-width': 1, 'line-opacity': 0.5 },
        layout: { visibility },
      })
      add({
        id: ATES_AREA_LAYER_ID,
        type: 'line',
        filter: kindIs('area'),
        paint: { 'line-color': ATES_AREA_COLOR, 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [3, 2] },
        layout: { visibility },
      })
      add({
        id: ATES_ACCESS_LAYER_ID,
        type: 'line',
        filter: kindIs('access_route'),
        paint: { 'line-color': ATES_ACCESS_COLOR, 'line-width': 3, 'line-opacity': 0.9 },
        layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      })
      add({
        id: ATES_PATHS_LAYER_ID,
        type: 'line',
        filter: kindIs('avalanche_path'),
        paint: { 'line-color': ATES_PATH_COLOR, 'line-width': 2 },
        layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      })
      add({
        id: ATES_LINES_LAYER_ID,
        type: 'line',
        filter: kindIs('ates_line'),
        paint: { 'line-color': color, 'line-width': ATES_LINE_WIDTH, 'line-opacity': 0.9 },
        layout: { visibility, 'line-cap': 'round', 'line-join': 'round' },
      })
      add({
        id: ATES_DECISION_LAYER_ID,
        type: 'circle',
        filter: kindIs('decision_point'),
        paint: {
          'circle-color': ATES_DECISION_COLOR,
          'circle-radius': 5,
          'circle-stroke-color': ATES_AREA_COLOR,
          'circle-stroke-width': 1.5,
        },
        layout: { visibility },
      })
      add({
        id: ATES_POI_LAYER_ID,
        type: 'symbol',
        filter: kindIs('poi'),
        layout: { visibility, 'icon-image': poiImage, 'icon-size': 0.8, 'icon-allow-overlap': true },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    // One map-wide click handler rather than per-layer ones, so routes,
    // tracks, waypoints and photos can keep priority: their own handlers open
    // the entity, and this one stands aside when any of them was hit.
    const present = (ids: readonly string[]) => ids.filter((id) => map.getLayer(id))
    const onClick = (e: maplibregl.MapMouseEvent) => {
      popupRef.current?.remove()
      popupRef.current = null
      const ui = useUiStore.getState()
      if (ui.placement.mode !== 'idle' || !ui.atesEnabled) return

      const entityLayers = present(ENTITY_LAYER_IDS)
      if (entityLayers.length > 0 && map.queryRenderedFeatures(e.point, { layers: entityLayers }).length > 0) return

      const atesLayers = present(CLICK_LAYER_IDS)
      if (atesLayers.length === 0) return
      const hits = map.queryRenderedFeatures(e.point, { layers: atesLayers })
      const hit = CLICK_PRIORITY.map((kind) => hits.find((f) => f.properties?.kind === kind)).find(Boolean) ?? hits[0]
      if (!hit) return

      popupRef.current = new maplibregl.Popup({ className: styles.popup, maxWidth: '280px' })
        .setLngLat(e.lngLat)
        .setDOMContent(atesPopupContent(hit.properties ?? {}))
        .addTo(map)
    }
    map.on('click', onClick)

    const onEnter = () => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      if (useUiStore.getState().placement.mode === 'idle') map.getCanvas().style.cursor = ''
    }
    for (const id of POINTER_LAYER_IDS) {
      map.on('mouseenter', id, onEnter)
      map.on('mouseleave', id, onLeave)
    }

    return () => {
      map.off('styleimagemissing', onImageMissing)
      map.off('style.load', install)
      map.off('click', onClick)
      for (const id of POINTER_LAYER_IDS) {
        map.off('mouseenter', id, onEnter)
        map.off('mouseleave', id, onLeave)
      }
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [map])

  // (2) Sync data when areas are imported, replaced or deleted.
  useEffect(() => {
    if (!map) return
    const src = map.getSource(ATES_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    ;(src as GeoJSONSource).setData(buildAtesGeoJson(areas) as never)
  }, [map, areas])

  // (3) Visibility toggle. Turning the layer off also closes its popup.
  useEffect(() => {
    if (!map) return
    if (!visible) {
      popupRef.current?.remove()
      popupRef.current = null
    }
    for (const id of ATES_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, visible])

  // (4) Fill opacity.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(ATES_FILL_LAYER_ID)) return
    map.setPaintProperty(ATES_FILL_LAYER_ID, 'fill-opacity', opacity)
  }, [map, opacity])

  return null
}

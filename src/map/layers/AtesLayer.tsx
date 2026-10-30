import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useAtesAreasStore } from '../../store/atesAreas'
import { useUiStore } from '../../store/ui'
import { atesClassColorExpression, buildAtesGeoJson } from './atesLayerData'
import { atesPopupContent } from './atesPopup'
import styles from './AtesLayer.module.css'
import {
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

export function AtesLayer(): null {
  const map = useMap()
  const areas = useAtesAreasStore((s) => s.areas)
  const visible = useUiStore((s) => s.atesEnabled)
  const opacity = useUiStore((s) => s.atesOpacity)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  // (1) Install on every style.load (basemap/key change clears sources), plus
  // the click popup and decision-point cursor.
  useEffect(() => {
    if (!map) return

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

      const atesLayers = present([ATES_DECISION_LAYER_ID, ATES_FILL_LAYER_ID])
      if (atesLayers.length === 0) return
      const hits = map.queryRenderedFeatures(e.point, { layers: atesLayers })
      const hit = hits.find((f) => f.properties?.kind === 'decision_point') ?? hits[0]
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
    map.on('mouseenter', ATES_DECISION_LAYER_ID, onEnter)
    map.on('mouseleave', ATES_DECISION_LAYER_ID, onLeave)

    return () => {
      map.off('style.load', install)
      map.off('click', onClick)
      map.off('mouseenter', ATES_DECISION_LAYER_ID, onEnter)
      map.off('mouseleave', ATES_DECISION_LAYER_ID, onLeave)
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

import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useTracksStore } from '../../store/tracks'
import { useUiStore } from '../../store/ui'
import { buildTracksGeoJson } from './tracksLayerData'
import {
  TRACKS_LINE_LAYER_ID,
  TRACKS_SOURCE_ID,
  TRACK_LINE_DASH,
  TRACK_LINE_WIDTH,
} from './layerStyles'

export function TracksLayer(): null {
  const map = useMap()
  const tracks = useTracksStore((s) => s.tracks)
  const visible = useUiStore((s) => s.layerVisibility.tracks)

  // (1) Add source and layer when the map first becomes available.
  // setStyle() (basemap or key change) wipes sources, so re-attach on every
  // style.load — same pattern as the DEM source in MapView.tsx.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(TRACKS_SOURCE_ID)) return
      map.addSource(TRACKS_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: TRACKS_LINE_LAYER_ID,
        type: 'line',
        source: TRACKS_SOURCE_ID,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': TRACK_LINE_WIDTH,
          'line-dasharray': TRACK_LINE_DASH,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    install()
    map.on('style.load', install)

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('track', id)
      }
    }
    map.on('click', TRACKS_LINE_LAYER_ID, onClick)
    // Cursor affordance — show pointer when hovering a clickable line.
    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }
    map.on('mouseenter', TRACKS_LINE_LAYER_ID, onEnter)
    map.on('mouseleave', TRACKS_LINE_LAYER_ID, onLeave)

    return () => {
      map.off('style.load', install)
      map.off('click', TRACKS_LINE_LAYER_ID, onClick)
      map.off('mouseenter', TRACKS_LINE_LAYER_ID, onEnter)
      map.off('mouseleave', TRACKS_LINE_LAYER_ID, onLeave)
    }
  }, [map])

  // (2) Sync GeoJSON when tracks change.
  // React commits effects in declaration order. On first mount with `map`
  // non-null, effect (1) above runs first and synchronously calls
  // `map.addSource(TRACKS_SOURCE_ID, ...)`. By the time this effect's
  // `getSource(...)` lookup runs (still inside the same commit), the
  // source exists and `setData` populates it correctly. The guard on the
  // next line is for the early-render case where `map` is still null.
  useEffect(() => {
    if (!map) return
    const src = map.getSource(TRACKS_SOURCE_ID)
    if (!src || src.type !== 'geojson') return
    // Local FeatureCollection in tracksLayerData.ts uses Track['geojson']
    // (LineStringZ — Z required) rather than GeoJSON.LineString (Z optional).
    // setData accepts the value at runtime; `as never` documents that we've
    // intentionally avoided pulling @types/geojson into the helper just to
    // satisfy a structural shape that's already correct for our use.
    ;(src as GeoJSONSource).setData(buildTracksGeoJson(tracks) as never)
  }, [map, tracks])

  // (3) Sync visibility on toggle change.
  useEffect(() => {
    if (!map) return
    if (!map.getLayer(TRACKS_LINE_LAYER_ID)) return
    map.setLayoutProperty(TRACKS_LINE_LAYER_ID, 'visibility', visible ? 'visible' : 'none')
  }, [map, visible])

  return null
}

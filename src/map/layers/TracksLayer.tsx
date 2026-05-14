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

  // (1) Add source and layer once the style is ready. addSource/addLayer
  // throw "Style is not done loading" if called before MapLibre has fetched
  // and parsed the style JSON — install() must wait for style.load.
  // setStyle() (basemap or key change) re-fires style.load; the listener
  // covers both first-load and subsequent style swaps.
  // install() reads fresh state from the stores so it can run later via
  // style.load with current data, not whatever was in scope at mount time.
  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(TRACKS_SOURCE_ID)) return
      const initialTracks = useTracksStore.getState().tracks
      const initialVisible = useUiStore.getState().layerVisibility.tracks
      const visibility = initialVisible ? 'visible' : 'none'
      map.addSource(TRACKS_SOURCE_ID, {
        type: 'geojson',
        data: buildTracksGeoJson(initialTracks) as never,
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
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') {
        useUiStore.getState().openEntity('track', id)
      }
    }
    map.on('click', TRACKS_LINE_LAYER_ID, onClick)
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
  // The source may not exist yet — install() runs on style.load, which is
  // asynchronous. install() seeds the source with the current tracks via
  // useTracksStore.getState(), so the initial data isn't lost; this effect
  // handles every subsequent change. The guard short-circuits cleanly when
  // the source isn't installed yet.
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

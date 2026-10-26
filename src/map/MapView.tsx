import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './MapView.module.css'
import { useSettingsStore } from '../store/settings'
import { useUiStore } from '../store/ui'
import { styleUrl, terrainSourceUrl } from './mapConfig'
import { createTileErrorMonitor, type TileErrorMonitor } from './errors/tileErrorMonitor'
import { BasemapControl } from './controls/BasemapControl'
import { TerrainControl } from './controls/TerrainControl'
import { setMap } from '../hooks/useMap'
import { RoutesLayer } from './layers/RoutesLayer'
import { TracksLayer } from './layers/TracksLayer'
import { WaypointsLayer } from './layers/WaypointsLayer'
import { PhotosLayer } from './layers/PhotosLayer'
import { usePlacementMapBinding } from './placement/usePlacementMapBinding'
import { usePhotoCursorPreview } from './placement/photoCursorPreview'
import { PhotoPositionMarker } from './placement/PhotoPositionMarker'
import { MAP_DEFAULTS } from '../types'
import { WelcomeScreen } from '../panels/Welcome/WelcomeScreen'
import { debug } from '../utils/debug'

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const monitorRef = useRef<TileErrorMonitor | null>(null)
  usePlacementMapBinding()
  usePhotoCursorPreview()

  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const activeBasemap = useUiStore((s) => s.activeBasemap)
  const terrainEnabled = useUiStore((s) => s.terrainEnabled)
  const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)
  const [styleError, setStyleError] = useState<string | null>(null)
  const [tileBannerVisible, setTileBannerVisible] = useState(false)

  // Map lifecycle driven by maptilerKey + activeBasemap:
  //   - null key: tear down any existing map.
  //   - key set, no map: create the map with the current basemap.
  //   - key OR basemap changed, map exists: rebind the style on the existing map.
  // The DEM source and terrain re-attach via installDem on style.load.
  // The map is destroyed on full unmount via the bottom effect.
  useEffect(() => {
    if (!maptilerKey) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMap(null)
      }
      monitorRef.current = null
      return
    }
    if (!containerRef.current) return

    if (mapRef.current) {
      // Key or basemap changed; clear error UI and reset the rolling-window
      // monitor before rebinding the style.
      setStyleError(null)
      setTileBannerVisible(false)
      monitorRef.current?.reset()
      mapRef.current.setStyle(styleUrl(activeBasemap, maptilerKey))
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(activeBasemap, maptilerKey),
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      pitch: MAP_DEFAULTS.pitch,
      bearing: MAP_DEFAULTS.bearing,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left')
    mapRef.current = map
    setMap(map)

    // Re-install the DEM source on every style.load. setStyle() (key change
    // and basemap switch) clears all sources, so reattaching here covers both
    // the initial load and every subsequent style swap.
    // Reads the key live from the settings store so a key change before this
    // fires uses the up-to-date value.
    const installDem = () => {
      const currentKey = useSettingsStore.getState().maptilerKey
      if (!currentKey) return
      if (!map.getSource('maptiler-dem')) {
        map.addSource('maptiler-dem', {
          type: 'raster-dem',
          url: terrainSourceUrl(currentKey),
          tileSize: 256,
        })
      }
      const { terrainEnabled, terrainExaggeration } = useUiStore.getState()
      if (terrainEnabled) {
        map.setTerrain({ source: 'maptiler-dem', exaggeration: terrainExaggeration })
      }
    }
    map.on('style.load', installDem)

    const monitor = createTileErrorMonitor({
      threshold: 3,
      windowMs: 10_000,
      onTrip: () => setTileBannerVisible(true),
    })
    monitorRef.current = monitor

    const handleError = (event: { error?: { status?: number }; source?: { url?: string } }) => {
      const status = event.error?.status
      const url = event.source?.url ?? ''
      debug('map error', status, url)
      if (url.includes('style.json') && status && status >= 400) {
        setStyleError(`Maptiler returned ${status}. Check your API key.`)
        setActiveTab('settings')
        return
      }
      monitor.recordError()
    }
    map.on('error', handleError)
  }, [maptilerKey, setActiveTab, activeBasemap])

  // React to terrain state changes (toggle + exaggeration slider).
  // Skips when the DEM source isn't installed yet — handled by installDem on
  // first style.load.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!map.getSource('maptiler-dem')) return
    if (terrainEnabled) {
      map.setTerrain({ source: 'maptiler-dem', exaggeration: terrainExaggeration })
    } else {
      map.setTerrain(null)
    }
  }, [terrainEnabled, terrainExaggeration])

  // Destroy the map only on full component unmount.
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      setMap(null)
      monitorRef.current = null
    }
  }, [])

  if (!maptilerKey) return <WelcomeScreen />

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.canvas} data-testid="map-canvas" />
      <BasemapControl />
      <TerrainControl />
      <RoutesLayer />
      <TracksLayer />
      <WaypointsLayer />
      <PhotosLayer />
      <PhotoPositionMarker />
      {styleError && (
        <div role="alert" className={styles.banner}>
          <span>{styleError}</span>
        </div>
      )}
      {tileBannerVisible && !styleError && (
        <div role="status" className={styles.banner}>
          <span>Tile loading is failing — your key may be invalid or over quota.</span>
          <button
            type="button"
            className={styles.bannerDismiss}
            onClick={() => setTileBannerVisible(false)}
            aria-label="Dismiss tile-error banner"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

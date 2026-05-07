import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './MapView.module.css'
import { useSettingsStore } from '../store/settings'
import { useUiStore } from '../store/ui'
import { styleUrl, terrainSourceUrl } from './mapConfig'
import { createTileErrorMonitor, type TileErrorMonitor } from './errors/tileErrorMonitor'
import { TerrainControl } from './controls/TerrainControl'
import { MAP_DEFAULTS } from '../types'
import { debug } from '../utils/debug'

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const monitorRef = useRef<TileErrorMonitor | null>(null)
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const terrainEnabled = useUiStore((s) => s.terrainEnabled)
  const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)
  const [styleError, setStyleError] = useState<string | null>(null)
  const [tileBannerVisible, setTileBannerVisible] = useState(false)

  // Map lifecycle driven by maptilerKey:
  //   - null key: tear down any existing map (the empty-state JSX has unmounted the container).
  //   - key set, no map: create the map.
  //   - key changed, map exists: rebind the style on the existing map.
  // The map is also destroyed on component unmount via the third effect below.
  useEffect(() => {
    if (!maptilerKey) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      monitorRef.current = null
      return
    }
    if (!containerRef.current) return

    if (mapRef.current) {
      // Key changed on an existing map: clear any error UI and reset the
      // rolling-window monitor so stale tile-error timestamps from the
      // previous key cannot trip the banner against the new key.
      setStyleError(null)
      setTileBannerVisible(false)
      monitorRef.current?.reset()
      mapRef.current.setStyle(styleUrl(MAP_DEFAULTS.basemap, maptilerKey))
      return
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(MAP_DEFAULTS.basemap, maptilerKey),
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      pitch: MAP_DEFAULTS.pitch,
      bearing: MAP_DEFAULTS.bearing,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    mapRef.current = map

    // Re-install the DEM source on every style.load. setStyle() (key change in
    // this task; basemap switch in Task 1.5) clears all sources, so reattaching
    // here covers both the initial load and every subsequent style swap.
    const installDem = () => {
      if (!map.getSource('maptiler-dem')) {
        map.addSource('maptiler-dem', {
          type: 'raster-dem',
          url: terrainSourceUrl(maptilerKey),
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
  }, [maptilerKey, setActiveTab])

  // React to terrain state changes (toggle + exaggeration slider).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
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
      monitorRef.current = null
    }
  }, [])

  if (!maptilerKey) {
    return (
      <div className={styles.empty}>
        <div>
          <p>A Maptiler API key is required to load the map.</p>
          <p>Open Settings to enter your key.</p>
          <p style={{ marginTop: 'var(--space-md)' }}>
            <a
              href="https://cloud.maptiler.com/account/keys/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a free Maptiler key →
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div ref={containerRef} className={styles.canvas} data-testid="map-canvas" />
      <TerrainControl />
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

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import styles from './MapView.module.css'
import { useSettingsStore } from '../store/settings'
import { useUiStore } from '../store/ui'
import { styleUrl } from './mapConfig'
import { createTileErrorMonitor } from './errors/tileErrorMonitor'
import { MAP_DEFAULTS } from '../types'
import { debug } from '../utils/debug'

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // Keep a ref to the latest key so the mount effect always reads the current value
  // without re-running when it changes.
  const maptilerKeyRef = useRef<string | null>(null)
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  maptilerKeyRef.current = maptilerKey
  const setActiveTab = useUiStore((s) => s.setActiveTab)
  const setActiveTabRef = useRef(setActiveTab)
  setActiveTabRef.current = setActiveTab
  const [styleError, setStyleError] = useState<string | null>(null)
  const [tileBannerVisible, setTileBannerVisible] = useState(false)

  // Mount effect: create map once. Runs only when containerRef becomes available.
  // Does NOT depend on maptilerKey so it does not re-run on key changes.
  useEffect(() => {
    const key = maptilerKeyRef.current
    if (!key || !containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl(MAP_DEFAULTS.basemap, key),
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      pitch: MAP_DEFAULTS.pitch,
      bearing: MAP_DEFAULTS.bearing,
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    mapRef.current = map

    const monitor = createTileErrorMonitor({
      threshold: 3,
      windowMs: 10_000,
      onTrip: () => setTileBannerVisible(true),
    })

    const handleError = (event: { error?: { status?: number }; source?: { url?: string } }) => {
      const status = event.error?.status
      const url = event.source?.url ?? ''
      debug('map error', status, url)
      if (url.includes('style.json') && status && status >= 400) {
        setStyleError(`Maptiler returned ${status}. Check your API key.`)
        setActiveTabRef.current('settings')
        return
      }
      monitor.recordError()
    }
    map.on('error', handleError)

    return () => {
      map.off('error', handleError)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When the key changes after the map is alive, rebind the style.
  useEffect(() => {
    if (!mapRef.current || !maptilerKey) return
    setStyleError(null)
    setTileBannerVisible(false)
    mapRef.current.setStyle(styleUrl(MAP_DEFAULTS.basemap, maptilerKey))
  }, [maptilerKey])

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

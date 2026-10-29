import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import maplibregl from 'maplibre-gl'
import styles from './LocateControl.module.css'
import { useMap } from '../../hooks/useMap'
import { POINT_FLY_ZOOM } from '../flyToEntity'

// Browsers withhold geolocation outside a secure context (plain-HTTP LAN
// addresses), either by omitting it or by failing every request.
export function geolocationAvailable(): boolean {
  return window.isSecureContext && 'geolocation' in navigator
}

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied.'
    case error.POSITION_UNAVAILABLE:
      return 'Waiting for a GPS fix…'
    default:
      return 'Location timed out.'
  }
}

const INSECURE_MESSAGE = 'Location needs HTTPS (or localhost).'

function createDotElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = styles.dot
  el.setAttribute('data-testid', 'user-location-dot')
  return el
}

// Toggle button under MapLibre's zoom/compass. On: centres the map on the
// first GPS fix, then moves a dot with the user without moving the map.
// Off: stops watching and removes the dot.
export function LocateControl() {
  const map = useMap()
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState(false)
  const [hasFix, setHasFix] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // A MapLibre control slot, so the button stacks with the built-in controls.
  useEffect(() => {
    if (!map) return
    const el = document.createElement('div')
    el.className = `maplibregl-ctrl ${styles.slot}`
    const control: maplibregl.IControl = {
      onAdd: () => el,
      onRemove: () => el.remove(),
    }
    map.addControl(control, 'top-left')
    setSlot(el)
    return () => {
      map.removeControl(control)
      setSlot(null)
    }
  }, [map])

  useEffect(() => {
    if (!map || !active) return
    const marker = new maplibregl.Marker({ element: createDotElement() })
    let centred = false
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lngLat: [number, number] = [position.coords.longitude, position.coords.latitude]
        marker.setLngLat(lngLat).addTo(map)
        setMessage(null)
        if (!centred) {
          centred = true
          setHasFix(true)
          map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), POINT_FLY_ZOOM) })
        }
      },
      (error) => {
        setMessage(geolocationErrorMessage(error))
        // A lost fix is often temporary (trees, a gully); keep watching.
        if (error.code === error.PERMISSION_DENIED) setActive(false)
      },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    )
    return () => {
      navigator.geolocation.clearWatch(watchId)
      marker.remove()
    }
  }, [map, active])

  const toggle = () => {
    setHasFix(false)
    if (active) {
      setActive(false)
      setMessage(null)
      return
    }
    if (!geolocationAvailable()) {
      setMessage(INSECURE_MESSAGE)
      return
    }
    setMessage(null)
    setActive(true)
  }

  if (!slot) return null

  const status = !active ? 'off' : hasFix ? 'tracking' : 'locating'
  return createPortal(
    <>
      <div className="maplibregl-ctrl-group">
        <button
          type="button"
          className={styles.button}
          data-status={status}
          aria-pressed={active}
          aria-label={active ? 'Stop showing my location' : 'Show my location'}
          title={active ? 'Stop showing my location' : 'Show my location'}
          onClick={toggle}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <path
              d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {message && (
        <div role="status" className={styles.message}>
          {message}
        </div>
      )}
    </>,
    slot,
  )
}

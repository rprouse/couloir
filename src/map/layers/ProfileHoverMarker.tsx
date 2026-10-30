import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import styles from './ProfileHoverMarker.module.css'

function createDotElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = styles.dot
  el.setAttribute('data-testid', 'profile-hover-dot')
  return el
}

// A red dot on the map at the point hovered on a route or track elevation
// profile. A DOM marker rather than a layer, so it sits above every layer and
// survives basemap style swaps.
export function ProfileHoverMarker(): null {
  const map = useMap()
  const point = useUiStore((s) => s.profileHover)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!map) return
    const marker = new maplibregl.Marker({ element: createDotElement() })
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map])

  // Declared after the effect above so the marker exists when this runs.
  useEffect(() => {
    const marker = markerRef.current
    if (!map || !marker) return
    if (point === null) {
      marker.remove()
      return
    }
    marker.setLngLat(point).addTo(map)
  }, [map, point])

  return null
}

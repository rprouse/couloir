import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import styles from './PhotoCursorPreview.module.css'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'

// While a photo without GPS awaits placement, its thumbnail follows the
// cursor. The element ignores pointer events so the click falls through to
// the map, where usePlacementMapBinding turns it into completePlacement.
export function applyPhotoCursorPreview(map: maplibregl.Map, previewUrl: string): () => void {
  const el = document.createElement('img')
  el.src = previewUrl
  el.alt = ''
  el.className = styles.preview
  // Set inline too: CSS-module class names are not applied under jsdom tests.
  el.style.pointerEvents = 'none'

  const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left', offset: [12, -12] })
  let shown = false

  const onMove = (e: maplibregl.MapMouseEvent) => {
    marker.setLngLat(e.lngLat)
    if (!shown) {
      marker.addTo(map)
      shown = true
    }
  }
  const onOut = () => {
    marker.remove()
    shown = false
  }
  map.on('mousemove', onMove)
  map.on('mouseout', onOut)

  return () => {
    map.off('mousemove', onMove)
    map.off('mouseout', onOut)
    marker.remove()
  }
}

export function usePhotoCursorPreview(): void {
  const map = useMap()
  const preview = useUiStore((s) => (s.placement.mode === 'photo' ? s.placement.pending.preview : null))
  useEffect(() => {
    if (!map || !preview) return
    return applyPhotoCursorPreview(map, preview)
  }, [map, preview])
}

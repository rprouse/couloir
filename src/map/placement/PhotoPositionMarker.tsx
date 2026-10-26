import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { draftNumber, useUiStore, type PanelState } from '../../store/ui'
import { PHOTO_PIN_COLOR } from '../layers/layerStyles'

function isPhotoDraft(panel: PanelState): boolean {
  return (panel.mode === 'create' || panel.mode === 'edit') && panel.entityType === 'photo'
}

// While a photo is being created or edited, a draggable pin marks its
// position. Dropping the pin writes lat/lng into the panel draft, which the
// form saves. View mode shows no pin — the position is locked.
export function PhotoPositionMarker(): null {
  const map = useMap()
  const active = useUiStore((s) => isPhotoDraft(s.panel))
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))
  const markerRef = useRef<maplibregl.Marker | null>(null)

  useEffect(() => {
    if (!map || !active) return
    const marker = new maplibregl.Marker({ draggable: true, color: PHOTO_PIN_COLOR })
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      useUiStore.getState().updateDraft({ lat: p.lat, lng: p.lng })
    })
    markerRef.current = marker
    return () => {
      marker.remove()
      markerRef.current = null
    }
  }, [map, active])

  // Follow the draft: the initial seed, typed coordinates, or a drag commit.
  // Declared after the effect above so the marker exists when this runs.
  useEffect(() => {
    const marker = markerRef.current
    if (!map || !marker) return
    if (lat === null || lng === null) {
      marker.remove()
      return
    }
    marker.setLngLat([lng, lat]).addTo(map)
  }, [map, active, lat, lng])

  return null
}

import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useUiStore } from '../../store/ui'
import { useMap } from '../../hooks/useMap'

// Map-side binding for placement mode: cursor + one-shot map click.
// Extracted as a pure helper (applyPlacementBinding) so the side effects can
// be unit-tested against a fake map without needing MapLibre/jsdom support.
// The hook is a thin wrapper for use inside MapView.
export function applyPlacementBinding(
  map: maplibregl.Map,
  mode: 'idle' | 'waypoint' | 'photo',
  onComplete: (lat: number, lng: number) => void,
): () => void {
  if (mode === 'idle') return () => {}

  const canvas = map.getCanvas()
  const previousCursor = canvas.style.cursor
  canvas.style.cursor = 'crosshair'

  const handler = (e: { lngLat: { lat: number; lng: number } }) => {
    onComplete(e.lngLat.lat, e.lngLat.lng)
  }
  // `handler` accepts a narrower shape than MapLibre's generic MapMouseEvent overload
  // requires. The cast is safe because MapMouseEvent structurally satisfies { lngLat: { lat, lng } }.
  map.on('click', handler as never)

  return () => {
    map.off('click', handler as never)
    canvas.style.cursor = previousCursor
  }
}

export function usePlacementMapBinding(): void {
  const map = useMap()
  const placementMode = useUiStore((s) => s.placement.mode)

  useEffect(() => {
    if (!map) return
    if (placementMode === 'idle') return
    // Photo placement (Phase 5) will need a different click payload; for now
    // we route both branches through completePlacement(lat, lng).
    const onComplete = (lat: number, lng: number) => {
      useUiStore.getState().completePlacement(lat, lng)
    }
    const teardown = applyPlacementBinding(map, placementMode, onComplete)
    return teardown
  }, [map, placementMode])
}

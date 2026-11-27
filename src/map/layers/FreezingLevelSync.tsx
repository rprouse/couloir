import { useEffect } from 'react'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { needsRefetch, useFreezingLevelStore } from '../../store/freezingLevel'

// How often "now" advances and the forecast age is checked while the
// freezing overlay is on.
const TICK_MS = 5 * 60 * 1000

// Keeps the freezing-level forecast for the map centre while the freezing
// overlay is on: fetched when it's switched on, then again whenever the map
// settles far enough from the forecast point or the forecast gets old.
export function FreezingLevelSync(): null {
  const map = useMap()
  const active = useUiStore((s) => s.terrainOverlay === 'freezing')

  useEffect(() => {
    if (!map || !active) return
    const store = useFreezingLevelStore
    const refresh = () => {
      const now = Date.now()
      store.getState().tick(now)
      const { lat, lng } = map.getCenter()
      const state = store.getState()
      // A newer load aborts an older one, so panning on before it lands is fine.
      if (needsRefetch(state, lat, lng, now)) void state.load(lat, lng)
    }
    refresh()
    map.on('moveend', refresh)
    const timer = setInterval(refresh, TICK_MS)
    return () => {
      map.off('moveend', refresh)
      clearInterval(timer)
    }
  }, [map, active])

  return null
}

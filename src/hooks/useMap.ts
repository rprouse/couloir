import { useSyncExternalStore } from 'react'
import type maplibregl from 'maplibre-gl'

let current: maplibregl.Map | null = null
const listeners = new Set<() => void>()

export function setMap(map: maplibregl.Map | null): void {
  current = map
  for (const l of listeners) l()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function getSnapshot(): maplibregl.Map | null {
  return current
}

// Hook returns the live map instance, or null while the map is being
// initialized / has been torn down. Layer components must guard against null.
export function useMap(): maplibregl.Map | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

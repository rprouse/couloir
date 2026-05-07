import { create } from 'zustand'
import type { Basemap } from '../types'

const TERRAIN_KEY  = 'couloir_terrain_exaggeration'
const BASEMAP_KEY  = 'couloir_basemap'
const VALID_BASEMAPS: ReadonlySet<Basemap> = new Set(['satellite', 'outdoor', 'winter'])
const MIN = 1
const MAX = 3

export type SidebarTab = 'layers' | 'search' | 'settings'
export type LayerKey = 'routes' | 'tracks' | 'waypoints' | 'photos'

interface UiState {
  activeTab: SidebarTab
  sidebarCollapsed: boolean
  terrainEnabled: boolean
  terrainExaggeration: number
  activeBasemap: Basemap
  layerVisibility: Record<LayerKey, boolean>
  setActiveTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  toggleTerrain: () => void
  setTerrainExaggeration: (value: number) => void
  setBasemap: (basemap: Basemap) => void
  toggleLayer: (layer: LayerKey) => void
  hydrateFromStorage: () => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'layers',
  sidebarCollapsed: false,
  terrainEnabled: true,
  terrainExaggeration: 1.5,
  activeBasemap: 'outdoor',
  layerVisibility: { routes: true, tracks: true, waypoints: true, photos: true },
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTerrain: () => set((s) => ({ terrainEnabled: !s.terrainEnabled })),
  setTerrainExaggeration: (value) => {
    const next = clamp(value)
    localStorage.setItem(TERRAIN_KEY, String(next))
    set({ terrainExaggeration: next })
  },
  setBasemap: (basemap) => {
    localStorage.setItem(BASEMAP_KEY, basemap)
    set({ activeBasemap: basemap })
  },
  toggleLayer: (layer) =>
    set((s) => ({
      layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] },
    })),
  hydrateFromStorage: () => {
    // Silent fallback to the in-memory default if a stored value is missing
    // or unparseable. Keeps app load resilient to localStorage corruption or
    // a future schema change that hasn't run yet.
    const rawTerrain = localStorage.getItem(TERRAIN_KEY)
    if (rawTerrain !== null) {
      const n = Number(rawTerrain)
      if (Number.isFinite(n)) set({ terrainExaggeration: clamp(n) })
    }
    const rawBasemap = localStorage.getItem(BASEMAP_KEY)
    if (rawBasemap && VALID_BASEMAPS.has(rawBasemap as Basemap)) {
      set({ activeBasemap: rawBasemap as Basemap })
    }
  },
}))

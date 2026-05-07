import { create } from 'zustand'

const TERRAIN_KEY = 'couloir_terrain_exaggeration'
const MIN = 1
const MAX = 3

export type SidebarTab = 'layers' | 'search' | 'settings'

interface UiState {
  activeTab: SidebarTab
  sidebarCollapsed: boolean
  terrainEnabled: boolean
  terrainExaggeration: number
  setActiveTab: (tab: SidebarTab) => void
  toggleSidebar: () => void
  toggleTerrain: () => void
  setTerrainExaggeration: (value: number) => void
  hydrateFromStorage: () => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'layers',
  sidebarCollapsed: false,
  terrainEnabled: true,
  terrainExaggeration: 1.5,
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTerrain: () => set((s) => ({ terrainEnabled: !s.terrainEnabled })),
  setTerrainExaggeration: (value) => {
    const next = clamp(value)
    localStorage.setItem(TERRAIN_KEY, String(next))
    set({ terrainExaggeration: next })
  },
  hydrateFromStorage: () => {
    // Silent fallback to the in-memory default if the stored value is missing
    // or unparseable. Keeps app load resilient to localStorage corruption or a
    // future schema change that hasn't run yet; the user just sees the default
    // and can re-set it from Settings.
    const raw = localStorage.getItem(TERRAIN_KEY)
    if (raw === null) return
    const n = Number(raw)
    if (Number.isFinite(n)) set({ terrainExaggeration: clamp(n) })
  },
}))

import { create } from 'zustand'
import type { Basemap, EntityDraft, EntityType } from '../types'

const TERRAIN_KEY  = 'couloir_terrain_exaggeration'
const BASEMAP_KEY  = 'couloir_basemap'
const VALID_BASEMAPS: ReadonlySet<Basemap> = new Set(['satellite', 'outdoor', 'winter'])
const MIN = 1
const MAX = 3

export type SidebarTab = 'layers' | 'search' | 'settings'
export type LayerKey = 'routes' | 'tracks' | 'waypoints' | 'photos'

// Panel and placement state machines per ARCHITECTURE.md.
export type PanelState =
  | { mode: 'idle' }
  | { mode: 'view';   entityType: EntityType; entityId: string }
  | { mode: 'edit';   entityType: EntityType; entityId: string; draft: EntityDraft }
  | { mode: 'create'; entityType: 'waypoint' | 'photo'; draft: EntityDraft }

export interface PhotoPlacementContext {
  blob: Blob
  preview: string                // object URL for the in-flight thumbnail
  exif: Record<string, unknown>  // shape lands in Phase 5; opaque for now
}

export type PlacementState =
  | { mode: 'idle' }
  | { mode: 'waypoint' }
  | { mode: 'photo'; ctx: PhotoPlacementContext }

interface UiState {
  // Phase 1 surface
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

  // Phase 2 surface — panel + placement state machines
  panel: PanelState
  placement: PlacementState
  openEntity: (entityType: EntityType, entityId: string) => void
  editCurrent: (initialDraft?: EntityDraft) => void
  closePanel: () => void
  startWaypointPlacement: () => void
  startPhotoPlacement: (ctx: PhotoPlacementContext) => void
  completePlacement: (lat: number, lng: number) => void
  cancelPlacement: () => void
  updateDraft: (patch: EntityDraft) => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))

export const useUiStore = create<UiState>((set, get) => ({
  // ----- Phase 1 fields (unchanged behavior) -----
  activeTab: 'layers',
  sidebarCollapsed: false,
  terrainEnabled: true,
  terrainExaggeration: 1.5,
  // Default basemap lives in the UI store's initial state — see notes in
  // src/types/index.ts (MAP_DEFAULTS). Don't reintroduce it there.
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

  // ----- Phase 2 fields: panel + placement -----
  panel: { mode: 'idle' },
  placement: { mode: 'idle' },

  openEntity: (entityType, entityId) => {
    set({
      panel: { mode: 'view', entityType, entityId },
      // Opening an entity always cancels any in-flight placement.
      placement: { mode: 'idle' },
    })
  },

  editCurrent: (initialDraft = {}) => {
    const cur = get().panel
    if (cur.mode !== 'view') {
      // Defensive: editCurrent is only valid from view mode. Silently no-op
      // rather than throw so a misfired UI event doesn't crash the app.
      return
    }
    set({
      panel: {
        mode: 'edit',
        entityType: cur.entityType,
        entityId: cur.entityId,
        draft: initialDraft,
      },
    })
  },

  closePanel: () => set({ panel: { mode: 'idle' } }),

  startWaypointPlacement: () => set({ placement: { mode: 'waypoint' } }),

  startPhotoPlacement: (ctx) => set({ placement: { mode: 'photo', ctx } }),

  completePlacement: (lat, lng) => {
    const cur = get().placement
    if (cur.mode === 'idle') return
    const draft: EntityDraft =
      cur.mode === 'waypoint'
        ? { lat, lng }
        : { lat, lng, blob_ref: '' /* set on save */ }
    // FIXME(phase 5): the photo branch drops `cur.ctx.blob` when placement
    // transitions to idle. The Phase 5 photo-create form needs the blob
    // to persist somewhere — either stash it on the draft (requires a type
    // extension), keep `placement.mode === 'photo'` while the create panel
    // is open, or add a separate `pendingPhoto` slot. Decide when wiring
    // up the actual create flow.
    set({
      placement: { mode: 'idle' },
      panel: { mode: 'create', entityType: cur.mode, draft },
    })
  },

  cancelPlacement: () => set({ placement: { mode: 'idle' } }),

  updateDraft: (patch) => {
    const cur = get().panel
    if (cur.mode === 'edit') {
      set({ panel: { ...cur, draft: { ...cur.draft, ...patch } } })
    } else if (cur.mode === 'create') {
      set({ panel: { ...cur, draft: { ...cur.draft, ...patch } } })
    }
  },
}))

import { create } from 'zustand'
import {
  TERRAIN_OVERLAYS,
  type Basemap,
  type EntityDraft,
  type EntityType,
  type PendingPhoto,
  type TerrainOverlay,
} from '../types'

const TERRAIN_KEY  = 'couloir_terrain_exaggeration'
const BASEMAP_KEY  = 'couloir_basemap'
const TERRAIN_OVERLAY_KEY = 'couloir_terrain_overlay'
const OVERLAY_OPACITY_KEY = 'couloir_overlay_opacity'
const NAVIGATION_AID_KEY = 'couloir_navigation_aid'
const ATES_ENABLED_KEY = 'couloir_ates_enabled'
const ATES_OPACITY_KEY = 'couloir_ates_opacity'
const TERRAIN_CONTROL_COLLAPSED_KEY = 'couloir_terrain_control_collapsed'
const VALID_BASEMAPS: ReadonlySet<Basemap> = new Set(['satellite', 'outdoor', 'winter'])
const MIN = 1
const MAX = 3
export const OVERLAY_OPACITY_MIN = 0.2
export const OVERLAY_OPACITY_MAX = 1
const OVERLAY_OPACITY_DEFAULT = 0.6
// ATES fills sit over the slope/aspect raster, so they default lighter.
const ATES_OPACITY_DEFAULT = 0.45

export type SidebarTab = 'layers' | 'search' | 'settings'
export type LayerKey = 'routes' | 'tracks' | 'waypoints' | 'photos'

// Panel and placement state machines per ARCHITECTURE.md.
export type PanelState =
  | { mode: 'idle' }
  | { mode: 'view';   entityType: EntityType; entityId: string }
  | { mode: 'edit';   entityType: EntityType; entityId: string; draft: EntityDraft }
  | { mode: 'create'; entityType: 'waypoint'; draft: EntityDraft }
  | { mode: 'create'; entityType: 'photo'; draft: EntityDraft; pending: PendingPhoto }

export type PlacementState =
  | { mode: 'idle' }
  | { mode: 'waypoint' }
  | { mode: 'photo'; pending: PendingPhoto }

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
  setSidebarCollapsed: (collapsed: boolean) => void
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
  startPhotoPlacement: (pending: PendingPhoto) => void
  completePlacement: (lat: number, lng: number) => void
  cancelPlacement: () => void
  updateDraft: (patch: EntityDraft) => void

  // Phase 6 — per-layer tag filters (OR semantics; empty = no filter)
  tagFilters: Record<LayerKey, string[]>
  setTagFilter: (layer: LayerKey, tagIds: string[]) => void
  clearTagFilter: (layer: LayerKey) => void
  pruneTagFromFilters: (tagId: string) => void

  // Phase 7/9 — terrain overlay: slope angle or aspect, one at a time (both
  // persisted; off by default to spare quota). Opacity is shared.
  terrainOverlay: TerrainOverlay | null
  overlayOpacity: number
  setTerrainOverlay: (overlay: TerrainOverlay | null) => void
  setOverlayOpacity: (value: number) => void

  // Centre crosshair plus lat/lng, elevation and bearing readout (persisted;
  // on by default).
  navigationAidEnabled: boolean
  setNavigationAidEnabled: (enabled: boolean) => void

  // Phase 12 — imported ATES zones, a switch independent of the terrain
  // overlay so they can sit on top of slope or aspect. Both persisted; on by
  // default (nothing draws until an area is imported). Fill opacity is its own.
  atesEnabled: boolean
  atesOpacity: number
  setAtesEnabled: (enabled: boolean) => void
  setAtesOpacity: (value: number) => void

  // Whether the bottom-right terrain/overlay box is collapsed to its header.
  // Null until the user chooses (persisted); the box then collapses on mobile
  // and expands on desktop.
  terrainControlCollapsed: boolean | null
  setTerrainControlCollapsed: (collapsed: boolean) => void

  // The About dialog, opened from the sidebar.
  aboutOpen: boolean
  setAboutOpen: (open: boolean) => void

  // The point under the cursor on a route or track elevation profile, as
  // [lng, lat], marked on the map. Null when the profile isn't hovered.
  profileHover: [number, number] | null
  setProfileHover: (point: [number, number] | null) => void
}

const clamp = (n: number) => Math.max(MIN, Math.min(MAX, n))
const clampOpacity = (n: number) => Math.max(OVERLAY_OPACITY_MIN, Math.min(OVERLAY_OPACITY_MAX, n))

// The in-flight photo's preview object URL is owned by this store: whichever
// transition drops the last reference to a pending photo revokes its URL.
function pendingPreview(s: { panel: PanelState; placement: PlacementState }): string | null {
  if (s.placement.mode === 'photo') return s.placement.pending.preview
  if (s.panel.mode === 'create' && s.panel.entityType === 'photo') return s.panel.pending.preview
  return null
}

// Reads a numeric field from the create/edit draft, or null. Selectors use
// this to subscribe to primitives (lat/lng) rather than a fresh object.
export function draftNumber(panel: PanelState, key: 'lat' | 'lng'): number | null {
  if (panel.mode !== 'create' && panel.mode !== 'edit') return null
  const v = (panel.draft as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : null
}

export const useUiStore = create<UiState>((set, get) => {
  const transition = (next: Partial<Pick<UiState, 'panel' | 'placement'>>) => {
    const before = pendingPreview(get())
    set(next)
    const after = pendingPreview(get())
    if (before !== null && before !== after) URL.revokeObjectURL(before)
  }

  return {
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
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
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
      const rawOverlay = localStorage.getItem(TERRAIN_OVERLAY_KEY)
      if (rawOverlay && TERRAIN_OVERLAYS.includes(rawOverlay as TerrainOverlay)) {
        set({ terrainOverlay: rawOverlay as TerrainOverlay })
      }
      const rawOpacity = localStorage.getItem(OVERLAY_OPACITY_KEY)
      if (rawOpacity !== null) {
        const n = Number(rawOpacity)
        if (Number.isFinite(n)) set({ overlayOpacity: clampOpacity(n) })
      }
      const rawNavigationAid = localStorage.getItem(NAVIGATION_AID_KEY)
      if (rawNavigationAid === 'true' || rawNavigationAid === 'false') {
        set({ navigationAidEnabled: rawNavigationAid === 'true' })
      }
      const rawAtesEnabled = localStorage.getItem(ATES_ENABLED_KEY)
      if (rawAtesEnabled === 'true' || rawAtesEnabled === 'false') {
        set({ atesEnabled: rawAtesEnabled === 'true' })
      }
      const rawAtesOpacity = localStorage.getItem(ATES_OPACITY_KEY)
      if (rawAtesOpacity !== null) {
        const n = Number(rawAtesOpacity)
        if (Number.isFinite(n)) set({ atesOpacity: clampOpacity(n) })
      }
      const rawCollapsed = localStorage.getItem(TERRAIN_CONTROL_COLLAPSED_KEY)
      if (rawCollapsed === 'true' || rawCollapsed === 'false') {
        set({ terrainControlCollapsed: rawCollapsed === 'true' })
      }
    },

    // ----- Phase 2 fields: panel + placement -----
    panel: { mode: 'idle' },
    placement: { mode: 'idle' },

    openEntity: (entityType, entityId) => {
      // Opening an entity always cancels any in-flight placement.
      transition({ panel: { mode: 'view', entityType, entityId }, placement: { mode: 'idle' } })
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

    closePanel: () => transition({ panel: { mode: 'idle' } }),

    startWaypointPlacement: () => transition({ placement: { mode: 'waypoint' } }),

    startPhotoPlacement: (pending) => transition({ placement: { mode: 'photo', pending } }),

    completePlacement: (lat, lng) => {
      const cur = get().placement
      if (cur.mode === 'idle') return
      const panel: PanelState =
        cur.mode === 'waypoint'
          ? { mode: 'create', entityType: 'waypoint', draft: { lat, lng } }
          : { mode: 'create', entityType: 'photo', draft: { lat, lng }, pending: cur.pending }
      transition({ placement: { mode: 'idle' }, panel })
    },

    cancelPlacement: () => transition({ placement: { mode: 'idle' } }),

    updateDraft: (patch) => {
      const cur = get().panel
      if (cur.mode === 'edit') {
        set({ panel: { ...cur, draft: { ...cur.draft, ...patch } } })
      } else if (cur.mode === 'create') {
        set({ panel: { ...cur, draft: { ...cur.draft, ...patch } } })
      }
    },

    // ----- Phase 6 fields: tag filters -----
    tagFilters: { routes: [], tracks: [], waypoints: [], photos: [] },
    setTagFilter: (layer, tagIds) =>
      set((s) => ({ tagFilters: { ...s.tagFilters, [layer]: tagIds } })),
    clearTagFilter: (layer) =>
      set((s) => ({ tagFilters: { ...s.tagFilters, [layer]: [] } })),
    pruneTagFromFilters: (tagId) =>
      set((s) => ({
        tagFilters: {
          routes: s.tagFilters.routes.filter((t) => t !== tagId),
          tracks: s.tagFilters.tracks.filter((t) => t !== tagId),
          waypoints: s.tagFilters.waypoints.filter((t) => t !== tagId),
          photos: s.tagFilters.photos.filter((t) => t !== tagId),
        },
      })),

    // ----- Phase 7/9 fields: terrain overlay -----
    terrainOverlay: null,
    overlayOpacity: OVERLAY_OPACITY_DEFAULT,
    setTerrainOverlay: (overlay) => {
      if (overlay === null) localStorage.removeItem(TERRAIN_OVERLAY_KEY)
      else localStorage.setItem(TERRAIN_OVERLAY_KEY, overlay)
      set({ terrainOverlay: overlay })
    },
    setOverlayOpacity: (value) => {
      const next = clampOpacity(value)
      localStorage.setItem(OVERLAY_OPACITY_KEY, String(next))
      set({ overlayOpacity: next })
    },

    // ----- Navigation aid -----
    navigationAidEnabled: true,
    setNavigationAidEnabled: (enabled) => {
      localStorage.setItem(NAVIGATION_AID_KEY, String(enabled))
      set({ navigationAidEnabled: enabled })
    },

    // ----- Phase 12: ATES zones -----
    atesEnabled: true,
    atesOpacity: ATES_OPACITY_DEFAULT,
    setAtesEnabled: (enabled) => {
      localStorage.setItem(ATES_ENABLED_KEY, String(enabled))
      set({ atesEnabled: enabled })
    },
    setAtesOpacity: (value) => {
      const next = clampOpacity(value)
      localStorage.setItem(ATES_OPACITY_KEY, String(next))
      set({ atesOpacity: next })
    },

    // ----- Terrain control box -----
    terrainControlCollapsed: null,
    setTerrainControlCollapsed: (collapsed) => {
      localStorage.setItem(TERRAIN_CONTROL_COLLAPSED_KEY, String(collapsed))
      set({ terrainControlCollapsed: collapsed })
    },

    // ----- About dialog -----
    aboutOpen: false,
    setAboutOpen: (open) => set({ aboutOpen: open }),

    // ----- Elevation profile hover -----
    profileHover: null,
    setProfileHover: (point) => set({ profileHover: point }),
  }
})

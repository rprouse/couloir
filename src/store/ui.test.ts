import { draftNumber, useUiStore } from './ui'
import type { PendingPhoto } from '../types'

describe('ui store — sidebar tabs', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('initial state is the layers tab, expanded', () => {
    const initial = useUiStore.getInitialState()
    expect(initial.activeTab).toBe('layers')
    expect(initial.sidebarCollapsed).toBe(false)
  })

  it('switches the active tab', () => {
    useUiStore.getState().setActiveTab('settings')
    expect(useUiStore.getState().activeTab).toBe('settings')
  })

  it('toggles the collapsed state', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })

  it('sets the collapsed state explicitly', () => {
    useUiStore.getState().setSidebarCollapsed(true)
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })
})

describe('ui store — terrain', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('defaults terrain enabled with exaggeration 1.5', () => {
    const initial = useUiStore.getInitialState()
    expect(initial.terrainEnabled).toBe(true)
    expect(initial.terrainExaggeration).toBe(1.5)
  })

  it('toggles terrain', () => {
    useUiStore.getState().toggleTerrain()
    expect(useUiStore.getState().terrainEnabled).toBe(false)
  })

  it('persists exaggeration to localStorage', () => {
    useUiStore.getState().setTerrainExaggeration(2.5)
    expect(localStorage.getItem('couloir_terrain_exaggeration')).toBe('2.5')
    expect(useUiStore.getState().terrainExaggeration).toBe(2.5)
  })

  it('hydrates exaggeration from localStorage', () => {
    localStorage.setItem('couloir_terrain_exaggeration', '2.0')
    useUiStore.getState().hydrateFromStorage()
    expect(useUiStore.getState().terrainExaggeration).toBe(2.0)
  })

  it('clamps exaggeration to [1, 3]', () => {
    useUiStore.getState().setTerrainExaggeration(0.2)
    expect(useUiStore.getState().terrainExaggeration).toBe(1)
    useUiStore.getState().setTerrainExaggeration(7)
    expect(useUiStore.getState().terrainExaggeration).toBe(3)
  })
})

describe('ui store — basemap', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('defaults to outdoor', () => {
    const initial = useUiStore.getInitialState()
    expect(initial.activeBasemap).toBe('outdoor')
  })

  it('persists basemap on change', () => {
    useUiStore.getState().setBasemap('satellite')
    expect(localStorage.getItem('couloir_basemap')).toBe('satellite')
    expect(useUiStore.getState().activeBasemap).toBe('satellite')
  })

  it('hydrates basemap from localStorage', () => {
    localStorage.setItem('couloir_basemap', 'winter')
    useUiStore.getState().hydrateFromStorage()
    expect(useUiStore.getState().activeBasemap).toBe('winter')
  })

  it('ignores unknown values during hydration', () => {
    localStorage.setItem('couloir_basemap', 'mars')
    useUiStore.getState().hydrateFromStorage()
    expect(useUiStore.getState().activeBasemap).toBe('outdoor')
  })
})

describe('ui store — layer visibility', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('defaults all layers visible', () => {
    const initial = useUiStore.getInitialState()
    expect(initial.layerVisibility).toEqual({
      routes: true, tracks: true, waypoints: true, photos: true,
    })
  })

  it('toggles a single layer without affecting others', () => {
    useUiStore.getState().toggleLayer('routes')
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
    expect(useUiStore.getState().layerVisibility.tracks).toBe(true)
    expect(useUiStore.getState().layerVisibility.waypoints).toBe(true)
    expect(useUiStore.getState().layerVisibility.photos).toBe(true)
  })
})

describe('ui store — panel state machine', () => {
  beforeEach(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })

  it('openEntity moves to view mode', () => {
    useUiStore.getState().openEntity('route', 'r1')
    expect(useUiStore.getState().panel).toEqual({
      mode: 'view',
      entityType: 'route',
      entityId: 'r1',
    })
  })

  it('opening an entity cancels any in-flight placement', () => {
    useUiStore.getState().startWaypointPlacement()
    useUiStore.getState().openEntity('route', 'r1')
    expect(useUiStore.getState().placement).toEqual({ mode: 'idle' })
  })

  it('editCurrent transitions view → edit', () => {
    useUiStore.getState().openEntity('waypoint', 'w1')
    useUiStore.getState().editCurrent({ name: 'Initial draft name' })
    const panel = useUiStore.getState().panel
    expect(panel.mode).toBe('edit')
    if (panel.mode === 'edit') {
      expect(panel.entityType).toBe('waypoint')
      expect(panel.entityId).toBe('w1')
      expect(panel.draft).toEqual({ name: 'Initial draft name' })
    }
  })

  it('editCurrent is a no-op when not in view mode', () => {
    useUiStore.getState().editCurrent({ name: 'x' })
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('closePanel returns to idle from any mode', () => {
    useUiStore.getState().openEntity('route', 'r1')
    useUiStore.getState().closePanel()
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('updateDraft merges into the current edit/create draft', () => {
    useUiStore.getState().openEntity('waypoint', 'w1')
    useUiStore.getState().editCurrent({ name: 'A' })
    useUiStore.getState().updateDraft({ description: 'B' })
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'edit') throw new Error('expected edit mode')
    expect(panel.draft).toEqual({ name: 'A', description: 'B' })
  })
})

describe('ui store — placement state machine', () => {
  beforeEach(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })

  it('startWaypointPlacement enters waypoint mode', () => {
    useUiStore.getState().startWaypointPlacement()
    expect(useUiStore.getState().placement).toEqual({ mode: 'waypoint' })
  })

  it('completePlacement(lat, lng) opens the create panel and clears placement', () => {
    useUiStore.getState().startWaypointPlacement()
    useUiStore.getState().completePlacement(49.5, -116.0)
    const state = useUiStore.getState()
    expect(state.placement).toEqual({ mode: 'idle' })
    expect(state.panel.mode).toBe('create')
    if (state.panel.mode === 'create') {
      expect(state.panel.entityType).toBe('waypoint')
      expect(state.panel.draft).toMatchObject({ lat: 49.5, lng: -116.0 })
    }
  })

  it('completePlacement is a no-op when no placement is active', () => {
    useUiStore.getState().completePlacement(49.5, -116.0)
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('cancelPlacement clears placement without touching the panel', () => {
    useUiStore.getState().openEntity('route', 'r1')
    useUiStore.getState().startWaypointPlacement()
    useUiStore.getState().cancelPlacement()
    const state = useUiStore.getState()
    expect(state.placement).toEqual({ mode: 'idle' })
    expect(state.panel.mode).toBe('view')
  })
})

const pendingPhoto = (preview = 'blob:test/p1'): PendingPhoto => ({
  blob: new Blob(['full']),
  thumb: new Blob(['thumb']),
  preview,
  width: 4000,
  height: 3000,
  filename: 'IMG_0001.jpg',
  exif: { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null },
})

describe('photo placement', () => {
  let revoke: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    useUiStore.setState({ panel: { mode: 'idle' }, placement: { mode: 'idle' } })
    revoke = vi.spyOn(URL, 'revokeObjectURL')
  })
  afterEach(() => revoke.mockRestore())

  it('carries the pending photo from placement onto the create panel', () => {
    const pending = pendingPhoto()
    useUiStore.getState().startPhotoPlacement(pending)
    expect(useUiStore.getState().placement).toEqual({ mode: 'photo', pending })
    useUiStore.getState().completePlacement(49.5, -116.0)
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'create' || panel.entityType !== 'photo') throw new Error('expected photo create')
    expect(panel.pending).toBe(pending)
    expect(panel.draft).toEqual({ lat: 49.5, lng: -116.0 })
    expect(useUiStore.getState().placement.mode).toBe('idle')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('revokes the preview when placement is cancelled', () => {
    useUiStore.getState().startPhotoPlacement(pendingPhoto('blob:test/a'))
    useUiStore.getState().cancelPlacement()
    expect(revoke).toHaveBeenCalledWith('blob:test/a')
  })

  it('revokes the preview when the create panel closes', () => {
    useUiStore.getState().startPhotoPlacement(pendingPhoto('blob:test/b'))
    useUiStore.getState().completePlacement(1, 2)
    useUiStore.getState().closePanel()
    expect(revoke).toHaveBeenCalledWith('blob:test/b')
  })

  it('revokes the preview when save transitions to view', () => {
    useUiStore.getState().startPhotoPlacement(pendingPhoto('blob:test/c'))
    useUiStore.getState().completePlacement(1, 2)
    useUiStore.getState().openEntity('photo', 'p1')
    expect(revoke).toHaveBeenCalledWith('blob:test/c')
  })

  it('updateDraft keeps the pending photo', () => {
    const pending = pendingPhoto()
    useUiStore.getState().startPhotoPlacement(pending)
    useUiStore.getState().completePlacement(1, 2)
    useUiStore.getState().updateDraft({ lat: 3 })
    const panel = useUiStore.getState().panel
    if (panel.mode !== 'create' || panel.entityType !== 'photo') throw new Error('expected photo create')
    expect(panel.pending).toBe(pending)
    expect(panel.draft).toEqual({ lat: 3, lng: 2 })
  })
})

describe('draftNumber', () => {
  it('reads numeric draft fields from create/edit panels only', () => {
    expect(draftNumber({ mode: 'idle' }, 'lat')).toBeNull()
    expect(draftNumber({ mode: 'edit', entityType: 'photo', entityId: 'p', draft: { lat: 4 } }, 'lat')).toBe(4)
    expect(draftNumber({ mode: 'edit', entityType: 'photo', entityId: 'p', draft: {} }, 'lng')).toBeNull()
  })
})

describe('tag filters', () => {
  beforeEach(() => useUiStore.setState({ tagFilters: { routes: [], tracks: [], waypoints: [], photos: [] } }))
  it('sets and clears per layer, independently', () => {
    useUiStore.getState().setTagFilter('routes', ['t1'])
    useUiStore.getState().setTagFilter('photos', ['t2'])
    useUiStore.getState().clearTagFilter('routes')
    expect(useUiStore.getState().tagFilters).toEqual({ routes: [], tracks: [], waypoints: [], photos: ['t2'] })
  })
})

import { useUiStore } from './ui'

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

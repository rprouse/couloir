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

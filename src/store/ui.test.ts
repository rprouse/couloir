import { useUiStore } from './ui'

describe('ui store — sidebar tabs', () => {
  beforeEach(() => {
    useUiStore.setState({ activeTab: 'layers', sidebarCollapsed: false })
  })

  it('defaults to the layers tab, expanded', () => {
    expect(useUiStore.getState().activeTab).toBe('layers')
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
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

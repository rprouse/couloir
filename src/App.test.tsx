import { act, render, screen } from '@testing-library/react'
import App from './App'
import { useUiStore } from './store/ui'

describe('App', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renders the sidebar and the map area', () => {
    render(<App />)
    // Disambiguate: Sidebar and DetailPanel are both <aside role="complementary">.
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument()
    expect(screen.getByTestId('map-area')).toBeInTheDocument()
  })

  it('on desktop, the sidebar stays open when the detail panel opens', () => {
    render(<App />)
    act(() => useUiStore.getState().openEntity('route', 'r1'))
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })

  it('on mobile, opening the detail panel closes the sidebar sheet', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<App />)
    // Reopen the sheet after the mount effect closed it.
    act(() => useUiStore.setState({ sidebarCollapsed: false, panel: { mode: 'idle' } }))
    act(() => useUiStore.getState().openEntity('route', 'r1'))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('on mobile, starting placement closes the sidebar sheet', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<App />)
    act(() => useUiStore.setState({ sidebarCollapsed: false }))
    act(() => useUiStore.getState().startWaypointPlacement())
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('on mobile, the sheet starts closed', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    act(() => useUiStore.setState({ sidebarCollapsed: false }))
    render(<App />)
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })
})

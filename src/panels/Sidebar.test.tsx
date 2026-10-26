import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { useUiStore } from '../store/ui'

describe('Sidebar', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => vi.unstubAllGlobals())

  it('renders three tab buttons', () => {
    render(<Sidebar panels={{}} />)
    expect(screen.getByRole('button', { name: /layers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab as selected', () => {
    render(<Sidebar panels={{}} />)
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches which tab is selected on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar panels={{}} />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('button', { name: /settings/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('toggles the collapse button label and aside state on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar panels={{}} />)
    const aside = screen.getByRole('complementary', { name: 'Sidebar' })
    expect(aside).toHaveAttribute('data-collapsed', 'false')

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))

    expect(aside).toHaveAttribute('data-collapsed', 'true')
    expect(
      screen.getByRole('button', { name: /expand sidebar/i }),
    ).toBeInTheDocument()
  })

  it('renders the panel for the active tab', () => {
    useUiStore.setState({ activeTab: 'settings' })
    render(<Sidebar panels={{ settings: <div>SETTINGS_PANEL</div> }} />)
    expect(screen.getByText('SETTINGS_PANEL')).toBeInTheDocument()
  })

  it('does not render content when collapsed', () => {
    useUiStore.setState({ sidebarCollapsed: true, activeTab: 'settings' })
    render(<Sidebar panels={{ settings: <div>SETTINGS_PANEL</div> }} />)
    expect(screen.queryByText('SETTINGS_PANEL')).not.toBeInTheDocument()
  })

  it('clicking a tab while collapsed expands the sidebar', () => {
    act(() => useUiStore.setState({ sidebarCollapsed: true, activeTab: 'layers' }))
    render(<Sidebar panels={{ layers: <div>L</div>, search: <div>S</div> }} />)
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(useUiStore.getState()).toMatchObject({ sidebarCollapsed: false, activeTab: 'search' })
  })

  it('on mobile, tapping the active tab collapses the sheet', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    act(() => useUiStore.setState({ sidebarCollapsed: false, activeTab: 'layers' }))
    render(<Sidebar panels={{ layers: <div>L</div> }} />)
    fireEvent.click(screen.getByRole('button', { name: /layers/i }))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })

  it('on desktop, tapping the active tab keeps the sidebar open', () => {
    render(<Sidebar panels={{ layers: <div>L</div> }} />)
    fireEvent.click(screen.getByRole('button', { name: /layers/i }))
    expect(useUiStore.getState().sidebarCollapsed).toBe(false)
  })
})

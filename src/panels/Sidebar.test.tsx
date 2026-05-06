import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { useUiStore } from '../store/ui'

describe('Sidebar', () => {
  beforeEach(() => {
    useUiStore.setState({ activeTab: 'layers', sidebarCollapsed: false })
  })

  it('renders three tab buttons', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /layers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab as selected', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches the active tab on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(useUiStore.getState().activeTab).toBe('settings')
  })

  it('toggles collapse on the collapse button', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))
    expect(useUiStore.getState().sidebarCollapsed).toBe(true)
  })
})

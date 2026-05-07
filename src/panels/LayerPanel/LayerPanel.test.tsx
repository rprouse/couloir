import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayerPanel } from './LayerPanel'
import { useUiStore } from '../../store/ui'

describe('LayerPanel', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders four rows with zero counts', () => {
    render(<LayerPanel />)
    for (const label of ['Routes', 'Tracks', 'Waypoints', 'Photos']) {
      const row = screen.getByText(label).closest('[data-row]')
      expect(row).not.toBeNull()
      expect(row).toHaveTextContent(/\b0\b/)
    }
  })

  it('toggles layer visibility on click', async () => {
    const user = userEvent.setup()
    render(<LayerPanel />)
    await user.click(screen.getByRole('switch', { name: /routes visibility/i }))
    expect(screen.getByRole('switch', { name: /routes visibility/i })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LayerPanel } from './LayerPanel'
import { useUiStore } from '../../store/ui'

const stubPrompt = async () =>
  ({ choice: 'skip' as const, applyToAll: false })

describe('LayerPanel', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders four rows with zero counts', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    for (const label of ['Routes', 'Tracks', 'Waypoints', 'Photos']) {
      const row = screen.getByText(label).closest('[data-row]')
      expect(row).not.toBeNull()
      const count = row?.querySelector('[data-count]')
      expect(count).toHaveAttribute('data-count', '0')
      expect(count).toHaveTextContent('0')
    }
  })

  it('toggles layer visibility when the switch is clicked', async () => {
    const user = userEvent.setup()
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    await user.click(screen.getByRole('switch', { name: 'Routes' }))
    expect(screen.getByRole('switch', { name: 'Routes' })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
  })

  it('toggles layer visibility when the visible label is clicked', async () => {
    const user = userEvent.setup()
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    // Clicking the <label> activates the associated input thanks to htmlFor.
    await user.click(screen.getByText('Tracks'))
    expect(screen.getByRole('switch', { name: 'Tracks' })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.tracks).toBe(false)
  })
})

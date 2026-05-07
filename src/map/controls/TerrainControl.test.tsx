import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerrainControl } from './TerrainControl'
import { useUiStore } from '../../store/ui'

describe('TerrainControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders an enabled toggle and the slider value', () => {
    render(<TerrainControl />)
    expect(screen.getByRole('switch', { name: /3d terrain/i })).toBeChecked()
    expect(screen.getByRole('slider', { name: /exaggeration/i })).toHaveValue('1.5')
  })

  it('toggles terrain on click', async () => {
    const user = userEvent.setup()
    render(<TerrainControl />)
    await user.click(screen.getByRole('switch', { name: /3d terrain/i }))
    expect(screen.getByRole('switch', { name: /3d terrain/i })).not.toBeChecked()
  })

  it('updates exaggeration on slider change', () => {
    render(<TerrainControl />)
    fireEvent.change(screen.getByRole('slider', { name: /exaggeration/i }), {
      target: { value: '2.5' },
    })
    expect(screen.getByRole('slider', { name: /exaggeration/i })).toHaveValue('2.5')
    expect(useUiStore.getState().terrainExaggeration).toBe(2.5)
  })

  it('disables the slider when terrain is off', () => {
    useUiStore.setState({ terrainEnabled: false })
    render(<TerrainControl />)
    expect(screen.getByRole('slider', { name: /exaggeration/i })).toBeDisabled()
  })
})

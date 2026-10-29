import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerrainControl } from './TerrainControl'
import { useUiStore } from '../../store/ui'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { SLOPE_BANDS } from '../slope/slopeBands'
import { ASPECT_SECTORS } from '../slope/aspectBands'

describe('TerrainControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders an enabled terrain toggle and no sliders', () => {
    render(<TerrainControl />)
    expect(screen.getByRole('switch', { name: /3d terrain/i })).toBeChecked()
    // Exaggeration and opacity live in Settings.
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('toggles terrain on click', async () => {
    const user = userEvent.setup()
    render(<TerrainControl />)
    await user.click(screen.getByRole('switch', { name: /3d terrain/i }))
    expect(screen.getByRole('switch', { name: /3d terrain/i })).not.toBeChecked()
    expect(useUiStore.getState().terrainEnabled).toBe(false)
  })

  describe('terrain overlay', () => {
    afterEach(() => act(() => setMap(null)))

    it('starts with Off pressed and switches between overlays', async () => {
      const user = userEvent.setup()
      render(<TerrainControl />)
      const group = screen.getByRole('group', { name: /overlay/i })
      expect(group).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'Slope' }))
      expect(useUiStore.getState().terrainOverlay).toBe('slope')
      expect(screen.getByRole('button', { name: 'Slope' })).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'Aspect' }))
      expect(useUiStore.getState().terrainOverlay).toBe('aspect')
      expect(screen.getByRole('button', { name: 'Slope' })).toHaveAttribute('aria-pressed', 'false')

      await user.click(screen.getByRole('button', { name: 'Off' }))
      expect(useUiStore.getState().terrainOverlay).toBeNull()
    })

    it('shows no legend while the overlay is off', () => {
      render(<TerrainControl />)
      expect(screen.queryByRole('list', { name: /slope angle legend/i })).toBeNull()
      expect(screen.queryByRole('img', { name: /aspect legend/i })).toBeNull()
    })

    it('shows the slope bands and caveat for the slope overlay', () => {
      useUiStore.setState({ terrainOverlay: 'slope' })
      render(<TerrainControl />)
      const legend = screen.getByRole('list', { name: /slope angle legend/i })
      expect(legend.querySelectorAll('li')).toHaveLength(SLOPE_BANDS.length)
      expect(screen.getByText(/not a substitute for field assessment/i)).toBeInTheDocument()
    })

    it('shows the compass rose and caveat for the aspect overlay', () => {
      useUiStore.setState({ terrainOverlay: 'aspect' })
      render(<TerrainControl />)
      const rose = screen.getByRole('img', { name: /aspect legend/i })
      expect(rose.querySelectorAll('path')).toHaveLength(ASPECT_SECTORS.length)
      expect(screen.queryByRole('list', { name: /slope angle legend/i })).toBeNull()
      expect(screen.getByText(/not a substitute for field assessment/i)).toBeInTheDocument()
    })

    it('hints to zoom in below the minimum overlay zoom, updating on zoomend', () => {
      const map = new __mocks__.MockMap()
      map.getZoom.mockReturnValue(8)
      act(() => setMap(map as never))
      useUiStore.setState({ terrainOverlay: 'aspect' })
      render(<TerrainControl />)
      expect(screen.getByText(/zoom in to see aspect/i)).toBeInTheDocument()
      map.getZoom.mockReturnValue(12)
      act(() => map.emit('zoomend'))
      expect(screen.queryByText(/zoom in to see aspect/i)).toBeNull()
    })
  })
})

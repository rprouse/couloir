import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerrainControl } from './TerrainControl'
import { useUiStore } from '../../store/ui'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { SLOPE_BANDS } from '../slope/slopeBands'

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
    expect(useUiStore.getState().terrainEnabled).toBe(false)
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

  describe('slope overlay', () => {
    afterEach(() => act(() => setMap(null)))

    it('renders an unchecked slope switch and toggles the store', async () => {
      const user = userEvent.setup()
      render(<TerrainControl />)
      const toggle = screen.getByRole('switch', { name: /slope angle/i })
      expect(toggle).not.toBeChecked()
      await user.click(toggle)
      expect(useUiStore.getState().slopeEnabled).toBe(true)
    })

    it('disables the opacity slider while slope is off', () => {
      render(<TerrainControl />)
      expect(screen.getByRole('slider', { name: /slope opacity/i })).toBeDisabled()
    })

    it('updates opacity on slider change', () => {
      useUiStore.setState({ slopeEnabled: true })
      render(<TerrainControl />)
      fireEvent.change(screen.getByRole('slider', { name: /slope opacity/i }), {
        target: { value: '0.4' },
      })
      expect(useUiStore.getState().slopeOpacity).toBe(0.4)
      expect(screen.getByText('40%')).toBeInTheDocument()
    })

    it('shows the legend and caveat only while slope is on', () => {
      const { rerender } = render(<TerrainControl />)
      expect(screen.queryByRole('list', { name: /slope angle legend/i })).toBeNull()
      act(() => useUiStore.setState({ slopeEnabled: true }))
      rerender(<TerrainControl />)
      const legend = screen.getByRole('list', { name: /slope angle legend/i })
      expect(legend.querySelectorAll('li')).toHaveLength(SLOPE_BANDS.length)
      expect(screen.getByText(/not a substitute for field assessment/i)).toBeInTheDocument()
    })

    it('hints to zoom in below the minimum slope zoom, updating on zoomend', () => {
      const map = new __mocks__.MockMap()
      map.getZoom.mockReturnValue(8)
      act(() => setMap(map as never))
      useUiStore.setState({ slopeEnabled: true })
      render(<TerrainControl />)
      expect(screen.getByText(/zoom in to see slope/i)).toBeInTheDocument()
      map.getZoom.mockReturnValue(12)
      act(() => map.emit('zoomend'))
      expect(screen.queryByText(/zoom in to see slope/i)).toBeNull()
    })
  })
})

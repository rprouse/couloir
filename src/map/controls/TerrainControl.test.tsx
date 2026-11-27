import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerrainControl, TerrainControlPanel } from './TerrainControl'
import { useUiStore } from '../../store/ui'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { SLOPE_BANDS } from '../slope/slopeBands'
import { useAtesAreasStore } from '../../store/atesAreas'
import { buildAtesArea } from '../../storage/contract'
import { ASPECT_SECTORS } from '../slope/aspectBands'
import { useFreezingLevelStore } from '../../store/freezingLevel'

describe('TerrainControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('sits in the bottom-right control stack, above the attribution', () => {
    const map = new __mocks__.MockMap()
    act(() => setMap(map as never))
    const { unmount } = render(<TerrainControl />)
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'bottom-right')
    const control = map.addControl.mock.calls[0][0] as { onAdd: () => HTMLElement }
    expect(control.onAdd()).toHaveTextContent('3D Terrain')
    unmount()
    expect(map.removeControl).toHaveBeenCalledWith(control)
    act(() => setMap(null))
  })

  it('renders an enabled terrain toggle and no sliders', () => {
    render(<TerrainControlPanel />)
    expect(screen.getByRole('switch', { name: /3d terrain/i })).toBeChecked()
    // Exaggeration and opacity live in Settings.
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('toggles terrain on click', async () => {
    const user = userEvent.setup()
    render(<TerrainControlPanel />)
    await user.click(screen.getByRole('switch', { name: /3d terrain/i }))
    expect(screen.getByRole('switch', { name: /3d terrain/i })).not.toBeChecked()
    expect(useUiStore.getState().terrainEnabled).toBe(false)
  })

  describe('collapsing', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('collapses to a header that names what is on, and remembers it', async () => {
      useUiStore.setState({ terrainOverlay: 'slope' })
      const user = userEvent.setup()
      render(<TerrainControlPanel />)
      const header = screen.getByRole('button', { name: /terrain/i, expanded: true })
      await user.click(header)
      expect(header).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('switch', { name: /3d terrain/i })).toBeNull()
      expect(header).toHaveTextContent('3D · Slope')
      expect(localStorage.getItem('couloir_terrain_control_collapsed')).toBe('true')
      await user.click(header)
      expect(screen.getByRole('switch', { name: /3d terrain/i })).toBeInTheDocument()
    })

    it('starts collapsed on mobile until the user expands it', () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      render(<TerrainControlPanel />)
      expect(screen.getByRole('button', { name: /terrain/i })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('switch', { name: /3d terrain/i })).toBeNull()
    })
  })

  describe('ATES switch', () => {
    beforeEach(() => {
      useAtesAreasStore.setState({ areas: [] })
    })

    it('is hidden until an area has been imported', () => {
      render(<TerrainControlPanel />)
      expect(screen.queryByRole('switch', { name: /ates ratings/i })).toBeNull()
    })

    it('toggles the layer and shows a legend of the classes present', async () => {
      const user = userEvent.setup()
      useAtesAreasStore.setState({ areas: [buildAtesArea()] })
      render(<TerrainControlPanel />)
      const toggle = screen.getByRole('switch', { name: /ates ratings/i })
      expect(toggle).toBeChecked()
      const legend = screen.getByRole('list', { name: /ates legend/i })
      expect(legend).toHaveTextContent('Complex (Class 3)')
      expect(legend).not.toHaveTextContent('Simple')
      expect(legend).toHaveTextContent('Decision point')
      expect(legend).not.toHaveTextContent('Parking')
      expect(screen.getByText(/not today’s avalanche danger/)).toBeInTheDocument()

      await user.click(toggle)
      expect(useUiStore.getState().atesEnabled).toBe(false)
      expect(screen.queryByRole('list', { name: /ates legend/i })).toBeNull()
    })

    it('works alongside a terrain overlay', async () => {
      const user = userEvent.setup()
      useAtesAreasStore.setState({ areas: [buildAtesArea()] })
      render(<TerrainControlPanel />)
      await user.click(screen.getByRole('button', { name: 'Slope' }))
      expect(useUiStore.getState().terrainOverlay).toBe('slope')
      expect(useUiStore.getState().atesEnabled).toBe(true)
      expect(screen.getByRole('list', { name: /slope angle legend/i })).toBeInTheDocument()
      expect(screen.getByRole('list', { name: /ates legend/i })).toBeInTheDocument()
    })
  })

  describe('terrain overlay', () => {
    afterEach(() => act(() => setMap(null)))

    it('starts with Off pressed and switches between overlays', async () => {
      const user = userEvent.setup()
      render(<TerrainControlPanel />)
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
      render(<TerrainControlPanel />)
      expect(screen.queryByRole('list', { name: /slope angle legend/i })).toBeNull()
      expect(screen.queryByRole('img', { name: /aspect legend/i })).toBeNull()
    })

    it('shows the slope bands and caveat for the slope overlay', () => {
      useUiStore.setState({ terrainOverlay: 'slope' })
      render(<TerrainControlPanel />)
      const legend = screen.getByRole('list', { name: /slope angle legend/i })
      expect(legend.querySelectorAll('li')).toHaveLength(SLOPE_BANDS.length)
      expect(screen.getByText(/not a substitute for field assessment/i)).toBeInTheDocument()
    })

    it('shows the compass rose and caveat for the aspect overlay', () => {
      useUiStore.setState({ terrainOverlay: 'aspect' })
      render(<TerrainControlPanel />)
      const rose = screen.getByRole('img', { name: /aspect legend/i })
      expect(rose.querySelectorAll('path')).toHaveLength(ASPECT_SECTORS.length)
      expect(screen.queryByRole('list', { name: /slope angle legend/i })).toBeNull()
      expect(screen.getByText(/not a substitute for field assessment/i)).toBeInTheDocument()
    })

    describe('freezing overlay', () => {
      const T0 = 1_800_000_000_000
      beforeEach(() => {
        useFreezingLevelStore.setState(useFreezingLevelStore.getInitialState())
        useUiStore.setState({ terrainOverlay: 'freezing' })
      })

      it('is offered as an overlay', async () => {
        useUiStore.setState({ terrainOverlay: null })
        const user = userEvent.setup()
        render(<TerrainControlPanel />)
        await user.click(screen.getByRole('button', { name: 'Freezing' }))
        expect(useUiStore.getState().terrainOverlay).toBe('freezing')
      })

      it('shows loading until the forecast arrives', () => {
        render(<TerrainControlPanel />)
        expect(screen.getByText(/loading freezing level/i)).toBeInTheDocument()
      })

      it('shows the level, the two bands, the hour and the Open-Meteo credit', () => {
        useFreezingLevelStore.setState({
          now: T0,
          forecast: {
            lat: 49.5,
            lng: -115.06,
            groundElevation: 1018,
            fetchedAt: T0,
            hours: [
              { time: T0, levelM: 1750, belowGround: false },
              { time: T0 + 3_600_000, levelM: 1018, belowGround: true },
            ],
          },
        })
        render(<TerrainControlPanel />)
        expect(screen.getByText(/freezing level 1,?750 m/i)).toBeInTheDocument()
        const legend = screen.getByRole('list', { name: /freezing level legend/i })
        expect(legend.querySelectorAll('li')).toHaveLength(2)
        expect(screen.getByRole('link', { name: /open-meteo/i })).toBeInTheDocument()
        expect(screen.getByText('Now')).toBeInTheDocument()

        act(() => useFreezingLevelStore.getState().setHourOffset(1))
        expect(screen.getByText(/below 1018 m/i)).toBeInTheDocument()
        expect(screen.getByRole('slider', { name: /forecast hour/i })).toHaveValue('1')
      })

      it('shows the error with a retry for the map centre', async () => {
        const map = new __mocks__.MockMap()
        act(() => setMap(map as never))
        const load = vi.fn(async (_lat: number, _lng: number) => {})
        useFreezingLevelStore.setState({ error: 'Open-Meteo returned 500', load })
        const user = userEvent.setup()
        render(<TerrainControlPanel />)
        expect(screen.getByRole('alert')).toHaveTextContent('Open-Meteo returned 500')
        await user.click(screen.getByRole('button', { name: 'Retry' }))
        expect(load).toHaveBeenCalledWith(49.504, -115.063)
      })
    })

    it('hints to zoom in below the minimum overlay zoom, updating on zoomend', () => {
      const map = new __mocks__.MockMap()
      map.getZoom.mockReturnValue(8)
      act(() => setMap(map as never))
      useUiStore.setState({ terrainOverlay: 'aspect' })
      render(<TerrainControlPanel />)
      expect(screen.getByText(/zoom in to see aspect/i)).toBeInTheDocument()
      map.getZoom.mockReturnValue(12)
      act(() => map.emit('zoomend'))
      expect(screen.queryByText(/zoom in to see aspect/i)).toBeNull()
    })
  })
})

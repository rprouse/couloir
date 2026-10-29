import { act, render, screen } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { NavigationAid } from './NavigationAid'

describe('NavigationAid', () => {
  let map: InstanceType<typeof __mocks__.MockMap>

  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
    map = new __mocks__.MockMap()
    act(() => setMap(map as unknown as maplibregl.Map))
  })

  afterEach(() => {
    act(() => setMap(null))
  })

  it('shows the crosshair and the centre reading', () => {
    map.getBearing.mockReturnValue(120)
    render(<NavigationAid />)
    expect(screen.getByTestId('map-crosshair')).toBeInTheDocument()
    const readout = screen.getByLabelText('Map centre')
    expect(readout).toHaveTextContent('49.50400')
    expect(readout).toHaveTextContent('-115.06300')
    expect(readout).toHaveTextContent('120° ESE')
    // No terrain mesh: elevation is unavailable.
    expect(readout).toHaveTextContent('—')
  })

  it('updates as the map moves', () => {
    vi.useFakeTimers()
    try {
      render(<NavigationAid />)
      map.getCenter.mockReturnValue({ lng: -116, lat: 50 })
      map.terrain = { exaggeration: 1, getElevationForLngLatZoom: vi.fn(() => 2134.4) }
      act(() => {
        map.emit('move')
        vi.runAllTimers()
      })
      const readout = screen.getByLabelText('Map centre')
      expect(readout).toHaveTextContent('50.00000')
      expect(readout).toHaveTextContent('2134 m')
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders nothing when turned off in settings', () => {
    useUiStore.setState({ navigationAidEnabled: false })
    render(<NavigationAid />)
    expect(screen.queryByTestId('map-crosshair')).toBeNull()
    expect(screen.queryByLabelText('Map centre')).toBeNull()
  })
})

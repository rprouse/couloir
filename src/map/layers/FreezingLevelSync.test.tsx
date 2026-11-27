import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { useFreezingLevelStore } from '../../store/freezingLevel'
import { FreezingLevelSync } from './FreezingLevelSync'

describe('FreezingLevelSync', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  const load = vi.fn(async (_lat: number, _lng: number) => {})

  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
    useFreezingLevelStore.setState({ ...useFreezingLevelStore.getInitialState(), load })
    load.mockClear()
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
  })
  afterEach(() => act(() => setMap(null)))

  it('does nothing while another overlay is shown', () => {
    useUiStore.setState({ terrainOverlay: 'slope' })
    render(<FreezingLevelSync />)
    act(() => map.emit('moveend'))
    expect(load).not.toHaveBeenCalled()
  })

  it('loads for the map centre when the freezing overlay is switched on', () => {
    render(<FreezingLevelSync />)
    act(() => useUiStore.setState({ terrainOverlay: 'freezing' }))
    expect(load).toHaveBeenCalledWith(49.504, -115.063)
  })

  it('refetches only when the map settles far from the forecast point', () => {
    useUiStore.setState({ terrainOverlay: 'freezing' })
    useFreezingLevelStore.setState({
      forecast: { lat: 49.5, lng: -115.06, groundElevation: 1018, fetchedAt: Date.now(), hours: [] },
    })
    render(<FreezingLevelSync />)
    expect(load).not.toHaveBeenCalled()

    map.getCenter.mockReturnValue({ lat: 49.52, lng: -115.1 })
    act(() => map.emit('moveend'))
    expect(load).not.toHaveBeenCalled()

    map.getCenter.mockReturnValue({ lat: 50.2, lng: -116.5 })
    act(() => map.emit('moveend'))
    expect(load).toHaveBeenCalledWith(50.2, -116.5)
  })

  it('stops listening when the overlay is switched off', () => {
    useUiStore.setState({ terrainOverlay: 'freezing' })
    render(<FreezingLevelSync />)
    load.mockClear()
    act(() => useUiStore.setState({ terrainOverlay: null }))
    map.getCenter.mockReturnValue({ lat: 52, lng: -118 })
    act(() => map.emit('moveend'))
    expect(load).not.toHaveBeenCalled()
  })
})

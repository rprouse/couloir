import { render } from '@testing-library/react'
import { act } from 'react'
import maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { PhotoPositionMarker } from './PhotoPositionMarker'

type Marker = InstanceType<typeof __mocks__.MockMarker>
const lastMarker = () => vi.mocked(maplibregl.Marker).mock.results.at(-1)!.value as Marker

describe('PhotoPositionMarker', () => {
  beforeEach(() => {
    vi.mocked(maplibregl.Marker).mockClear()
    act(() => setMap(new __mocks__.MockMap() as never))
    useUiStore.setState({ panel: { mode: 'idle' }, placement: { mode: 'idle' } })
  })
  afterEach(() => act(() => setMap(null)))

  it('shows a draggable pin at the draft position while editing a photo', () => {
    render(<PhotoPositionMarker />)
    expect(maplibregl.Marker).not.toHaveBeenCalled()
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'photo', entityId: 'p1', draft: { lat: 49.5, lng: -115 } },
    }))
    const marker = lastMarker()
    expect(marker.options).toMatchObject({ draggable: true })
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-115, 49.5])
    expect(marker.addTo).toHaveBeenCalled()
  })

  it('writes the dropped position into the draft', () => {
    render(<PhotoPositionMarker />)
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'photo', entityId: 'p1', draft: { lat: 49.5, lng: -115 } },
    }))
    const marker = lastMarker()
    marker.setLngLat({ lng: -115.2, lat: 49.7 })
    act(() => marker.emit('dragend'))
    expect(useUiStore.getState().panel).toMatchObject({ draft: { lat: 49.7, lng: -115.2 } })
  })

  it('removes the pin when the panel leaves edit mode', () => {
    render(<PhotoPositionMarker />)
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'photo', entityId: 'p1', draft: { lat: 49.5, lng: -115 } },
    }))
    const marker = lastMarker()
    act(() => useUiStore.getState().openEntity('photo', 'p1'))
    expect(marker.remove).toHaveBeenCalled()
  })

  it('ignores waypoint edits', () => {
    render(<PhotoPositionMarker />)
    act(() => useUiStore.setState({
      panel: { mode: 'edit', entityType: 'waypoint', entityId: 'w1', draft: { lat: 1, lng: 2 } },
    }))
    expect(maplibregl.Marker).not.toHaveBeenCalled()
  })
})

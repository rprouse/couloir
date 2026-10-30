import { render } from '@testing-library/react'
import { act } from 'react'
import maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { ProfileHoverMarker } from './ProfileHoverMarker'

type Marker = InstanceType<typeof __mocks__.MockMarker>
const lastMarker = () => vi.mocked(maplibregl.Marker).mock.results.at(-1)!.value as Marker

describe('ProfileHoverMarker', () => {
  beforeEach(() => {
    vi.mocked(maplibregl.Marker).mockClear()
    act(() => setMap(new __mocks__.MockMap() as never))
    useUiStore.setState({ profileHover: null })
  })
  afterEach(() => act(() => setMap(null)))

  it('shows a dot at the hovered profile point', () => {
    render(<ProfileHoverMarker />)
    const marker = lastMarker()
    expect(marker.addTo).not.toHaveBeenCalled()
    act(() => useUiStore.getState().setProfileHover([-116, 49.5]))
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-116, 49.5])
    expect(marker.addTo).toHaveBeenCalled()
  })

  it('removes the dot when the profile is no longer hovered', () => {
    render(<ProfileHoverMarker />)
    const marker = lastMarker()
    act(() => useUiStore.getState().setProfileHover([-116, 49.5]))
    act(() => useUiStore.getState().setProfileHover(null))
    expect(marker.remove).toHaveBeenCalled()
  })
})

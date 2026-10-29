import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { LocateControl } from './LocateControl'

type SuccessCallback = (position: GeolocationPosition) => void
type ErrorCallback = (error: GeolocationPositionError) => void

const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2

function position(lat: number, lng: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lng } } as GeolocationPosition
}

function positionError(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT: 3 } as GeolocationPositionError
}

describe('LocateControl', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  let onPosition: SuccessCallback
  let onError: ErrorCallback
  const geolocation = {
    watchPosition: vi.fn((success: SuccessCallback, error: ErrorCallback) => {
      onPosition = success
      onError = error
      return 7
    }),
    clearWatch: vi.fn(),
  }

  function setSecureContext(secure: boolean) {
    Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true })
  }

  // The mock map doesn't call onAdd, so mount the control slot by hand.
  function renderControl() {
    const result = render(<LocateControl />)
    const control = map.addControl.mock.calls[0][0] as maplibregl.IControl
    document.body.appendChild(control.onAdd(map as unknown as maplibregl.Map))
    return result
  }

  function lastMarker(): InstanceType<typeof __mocks__.MockMarker> {
    return vi.mocked(maplibregl.Marker).mock.results.at(-1)!.value
  }

  beforeEach(() => {
    vi.mocked(maplibregl.Marker).mockClear()
    geolocation.watchPosition.mockClear()
    geolocation.clearWatch.mockClear()
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true })
    setSecureContext(true)
    map = new __mocks__.MockMap()
    act(() => setMap(map as unknown as maplibregl.Map))
  })

  afterEach(() => {
    act(() => setMap(null))
    document.body.innerHTML = ''
  })

  it('adds a button to the top-left control stack', () => {
    renderControl()
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'top-left')
    expect(screen.getByRole('button', { name: 'Show my location' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('centres on the first fix, then moves only the dot', async () => {
    renderControl()
    await userEvent.click(screen.getByRole('button', { name: 'Show my location' }))
    expect(geolocation.watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    )

    act(() => onPosition(position(49.5, -115.1)))
    expect(map.flyTo).toHaveBeenCalledTimes(1)
    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [-115.1, 49.5] }))
    const marker = lastMarker()
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-115.1, 49.5])
    expect(marker.addTo).toHaveBeenCalledWith(map)

    act(() => onPosition(position(49.51, -115.12)))
    expect(map.flyTo).toHaveBeenCalledTimes(1)
    expect(marker.setLngLat).toHaveBeenLastCalledWith([-115.12, 49.51])
  })

  it('stops watching and removes the dot when toggled off', async () => {
    renderControl()
    await userEvent.click(screen.getByRole('button', { name: 'Show my location' }))
    act(() => onPosition(position(49.5, -115.1)))
    const marker = lastMarker()

    const stop = screen.getByRole('button', { name: 'Stop showing my location' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(stop)
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7)
    expect(marker.remove).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Show my location' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('centres again when turned back on', async () => {
    renderControl()
    const button = screen.getByRole('button')
    await userEvent.click(button)
    act(() => onPosition(position(49.5, -115.1)))
    await userEvent.click(button)
    await userEvent.click(button)
    act(() => onPosition(position(49.6, -115.2)))
    expect(map.flyTo).toHaveBeenCalledTimes(2)
  })

  it('explains that location needs HTTPS on an insecure origin', async () => {
    setSecureContext(false)
    renderControl()
    await userEvent.click(screen.getByRole('button', { name: 'Show my location' }))
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('HTTPS')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('turns off when permission is denied', async () => {
    renderControl()
    await userEvent.click(screen.getByRole('button', { name: 'Show my location' }))
    act(() => onError(positionError(PERMISSION_DENIED)))
    expect(screen.getByRole('status')).toHaveTextContent('permission denied')
    expect(geolocation.clearWatch).toHaveBeenCalledWith(7)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps watching through a lost fix', async () => {
    renderControl()
    await userEvent.click(screen.getByRole('button', { name: 'Show my location' }))
    act(() => onError(positionError(POSITION_UNAVAILABLE)))
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for a GPS fix')
    expect(geolocation.clearWatch).not.toHaveBeenCalled()

    act(() => onPosition(position(49.5, -115.1)))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('removes its control when the map goes away', () => {
    renderControl()
    const control = map.addControl.mock.calls[0][0]
    act(() => setMap(null))
    expect(map.removeControl).toHaveBeenCalledWith(control)
  })
})

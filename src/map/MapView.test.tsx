import { render, screen, act } from '@testing-library/react'
import * as maplibre from 'maplibre-gl'
import { MapView } from './MapView'
import { useSettingsStore } from '../store/settings'

const MapMock = maplibre.Map as unknown as ReturnType<typeof vi.fn>

describe('MapView', () => {
  beforeEach(() => {
    MapMock.mockClear()
    useSettingsStore.setState({ maptilerKey: null })
    localStorage.clear()
  })

  it('does not initialize the map when no key is set', () => {
    render(<MapView />)
    expect(MapMock).not.toHaveBeenCalled()
    expect(screen.getByText(/maptiler api key/i)).toBeInTheDocument()
  })

  it('initializes the map with the outdoor style when a key is set', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY' })
    render(<MapView />)
    expect(MapMock).toHaveBeenCalledTimes(1)
    const args = MapMock.mock.calls[0][0]
    expect(args.style).toBe('https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY')
    expect(args.center).toEqual([-116.0, 49.5])
    expect(args.zoom).toBe(11)
    expect(args.pitch).toBe(45)
  })

  it('opens settings and surfaces an error when the style fetch fails', async () => {
    useSettingsStore.setState({ maptilerKey: 'BAD' })
    const { rerender } = render(<MapView />)

    const map = MapMock.mock.results[0].value as { emit: (e: string, p?: unknown) => void }
    act(() => {
      map.emit('error', { error: { status: 401 }, source: { url: 'style.json' } })
    })
    rerender(<MapView />)

    expect(screen.getByRole('alert')).toHaveTextContent(/maptiler/i)
  })

  it('rebinds the map style when the key changes', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY1' })
    render(<MapView />)
    expect(MapMock).toHaveBeenCalledTimes(1)

    act(() => {
      useSettingsStore.getState().setMaptilerKey('KEY2')
    })

    const map = MapMock.mock.results[0].value as { setStyle: ReturnType<typeof vi.fn> }
    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY2',
    )
  })
})

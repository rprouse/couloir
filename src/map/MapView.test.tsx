import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as maplibre from 'maplibre-gl'
import { MapView } from './MapView'
import { useSettingsStore } from '../store/settings'
import { useUiStore } from '../store/ui'

const MapMock = maplibre.Map as unknown as ReturnType<typeof vi.fn>

describe('MapView', () => {
  beforeEach(() => {
    MapMock.mockClear()
    useSettingsStore.setState({ maptilerKey: null })
    useUiStore.setState(useUiStore.getInitialState())
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

  it('opens settings and surfaces an error when the style fetch fails', () => {
    useSettingsStore.setState({ maptilerKey: 'BAD' })
    render(<MapView />)

    const map = MapMock.mock.results[0].value as { emit: (e: string, p?: unknown) => void }
    act(() => {
      map.emit('error', { error: { status: 401 }, source: { url: 'style.json' } })
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/maptiler/i)
    expect(useUiStore.getState().activeTab).toBe('settings')
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

  it('rebinds the map style when the basemap changes', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY' })
    render(<MapView />)
    expect(MapMock).toHaveBeenCalledTimes(1)

    const map = MapMock.mock.results[0].value as { setStyle: ReturnType<typeof vi.fn> }

    act(() => {
      useUiStore.getState().setBasemap('satellite')
    })

    expect(map.setStyle).toHaveBeenCalledWith(
      'https://api.maptiler.com/maps/satellite/style.json?key=KEY',
    )
  })

  it('re-installs the DEM source and terrain after a basemap switch', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY' })
    render(<MapView />)

    const map = MapMock.mock.results[0].value as {
      emit: (e: string, p?: unknown) => void
      addSource: ReturnType<typeof vi.fn>
      setTerrain: ReturnType<typeof vi.fn>
    }

    // Clear any calls from initial setup so we observe only post-switch wiring.
    map.addSource.mockClear()
    map.setTerrain.mockClear()

    act(() => {
      useUiStore.getState().setBasemap('satellite')
    })
    // Simulate the style.load that MapLibre fires after setStyle.
    act(() => {
      map.emit('style.load')
    })

    expect(map.addSource).toHaveBeenCalledWith(
      'maptiler-dem',
      expect.objectContaining({
        type: 'raster-dem',
        url: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=KEY',
      }),
    )
    expect(map.setTerrain).toHaveBeenCalledWith({
      source: 'maptiler-dem',
      exaggeration: 1.5,
    })
  })

  it('initializes the map when the key transitions from null to set', () => {
    render(<MapView />)
    expect(MapMock).not.toHaveBeenCalled()

    act(() => {
      useSettingsStore.getState().setMaptilerKey('NEWKEY')
    })

    expect(MapMock).toHaveBeenCalledTimes(1)
    const args = MapMock.mock.calls[0][0]
    expect(args.style).toBe('https://api.maptiler.com/maps/outdoor-v2/style.json?key=NEWKEY')
  })

  it('tears down the map when the key is cleared', () => {
    useSettingsStore.setState({ maptilerKey: 'KEY' })
    render(<MapView />)
    expect(MapMock).toHaveBeenCalledTimes(1)

    const map = MapMock.mock.results[0].value as { remove: ReturnType<typeof vi.fn> }

    act(() => {
      useSettingsStore.getState().setMaptilerKey(null)
    })

    expect(map.remove).toHaveBeenCalledTimes(1)
  })

  it('shows a dismissable banner after sustained tile errors', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ maptilerKey: 'KEY' })
    render(<MapView />)

    const map = MapMock.mock.results[0].value as {
      emit: (e: string, p?: unknown) => void
    }

    act(() => {
      map.emit('error', { error: { status: 500 }, source: { url: 'tile.png' } })
      map.emit('error', { error: { status: 500 }, source: { url: 'tile.png' } })
      map.emit('error', { error: { status: 500 }, source: { url: 'tile.png' } })
    })

    expect(screen.getByRole('status')).toHaveTextContent(/tile loading is failing/i)

    await user.click(
      screen.getByRole('button', { name: /dismiss tile-error banner/i }),
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

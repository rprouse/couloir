import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { SlopeLayer } from './SlopeLayer'
import { SLOPE_TILE_URL } from '../slope/slopeProtocol'
import { DEM_MAX_ZOOM, DEM_TILE_SIZE, SLOPE_MIN_ZOOM } from './layerStyles'

type Layer = { id: string; type: string }

describe('SlopeLayer', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
  })
  afterEach(() => act(() => setMap(null)))

  const withStyleLayers = (layers: Layer[]) => map.getStyle.mockReturnValue({ layers })

  it('adds a raster source over the slope protocol and a hidden raster layer', () => {
    render(<SlopeLayer />)
    expect(map.addSource).toHaveBeenCalledWith('slope-source', {
      type: 'raster',
      tiles: [SLOPE_TILE_URL],
      tileSize: DEM_TILE_SIZE,
      minzoom: SLOPE_MIN_ZOOM,
      maxzoom: DEM_MAX_ZOOM,
    })
    const [layer] = map.addLayer.mock.calls[0] as [Record<string, unknown>]
    expect(layer).toMatchObject({
      id: 'slope-raster',
      type: 'raster',
      source: 'slope-source',
      minzoom: SLOPE_MIN_ZOOM,
      paint: { 'raster-opacity': 0.6, 'raster-fade-duration': 0 },
      layout: { visibility: 'none' },
    })
  })

  it('installs visible with the stored opacity when enabled', () => {
    useUiStore.setState({ slopeEnabled: true, slopeOpacity: 0.8 })
    render(<SlopeLayer />)
    const [layer] = map.addLayer.mock.calls[0] as [Record<string, unknown>]
    expect(layer).toMatchObject({
      paint: { 'raster-opacity': 0.8 },
      layout: { visibility: 'visible' },
    })
  })

  it('inserts below the first basemap label layer', () => {
    withStyleLayers([
      { id: 'background', type: 'background' },
      { id: 'hillshade', type: 'hillshade' },
      { id: 'place-labels', type: 'symbol' },
      { id: 'routes-line', type: 'line' },
    ])
    render(<SlopeLayer />)
    expect(map.addLayer.mock.calls[0][1]).toBe('place-labels')
  })

  it('inserts below Couloir layers when the basemap has no labels', () => {
    withStyleLayers([
      { id: 'background', type: 'background' },
      { id: 'routes-glow', type: 'line' },
      { id: 'waypoints-symbols', type: 'symbol' },
    ])
    render(<SlopeLayer />)
    expect(map.addLayer.mock.calls[0][1]).toBe('routes-glow')
  })

  it('appends on top when there is nothing to go under', () => {
    withStyleLayers([{ id: 'background', type: 'background' }])
    render(<SlopeLayer />)
    expect(map.addLayer.mock.calls[0][1]).toBeUndefined()
  })

  it('applies toggle and opacity changes to the existing layer', () => {
    map.getLayer.mockReturnValue({} as never)
    render(<SlopeLayer />)
    act(() => useUiStore.getState().toggleSlope())
    expect(map.setLayoutProperty).toHaveBeenCalledWith('slope-raster', 'visibility', 'visible')
    act(() => useUiStore.getState().setSlopeOpacity(0.3))
    expect(map.setPaintProperty).toHaveBeenCalledWith('slope-raster', 'raster-opacity', 0.3)
  })

  it('reinstalls after a style swap without duplicating the source', () => {
    render(<SlopeLayer />)
    expect(map.addSource).toHaveBeenCalledTimes(1)
    // Style still holds the source: style.load must not add it again.
    map.getSource.mockReturnValue({} as never)
    act(() => map.emit('style.load'))
    expect(map.addSource).toHaveBeenCalledTimes(1)
    // setStyle() cleared it: style.load adds it back.
    map.getSource.mockReturnValue(null as never)
    act(() => map.emit('style.load'))
    expect(map.addSource).toHaveBeenCalledTimes(2)
  })
})

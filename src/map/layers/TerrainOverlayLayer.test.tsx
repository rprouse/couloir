import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { TerrainOverlayLayer } from './TerrainOverlayLayer'
import { DEM_MAX_ZOOM, DEM_TILE_SIZE, OVERLAY_MIN_ZOOM } from './layerStyles'

type Layer = { id: string; type: string }

describe('TerrainOverlayLayer', () => {
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
    render(<TerrainOverlayLayer overlay="slope" />)
    expect(map.addSource).toHaveBeenCalledWith('slope-source', {
      type: 'raster',
      tiles: ['slope://{z}/{x}/{y}'],
      tileSize: DEM_TILE_SIZE,
      minzoom: OVERLAY_MIN_ZOOM,
      maxzoom: DEM_MAX_ZOOM,
    })
    const [layer] = map.addLayer.mock.calls[0] as [Record<string, unknown>]
    expect(layer).toMatchObject({
      id: 'slope-raster',
      type: 'raster',
      source: 'slope-source',
      minzoom: OVERLAY_MIN_ZOOM,
      paint: { 'raster-opacity': 0.6, 'raster-fade-duration': 0 },
      layout: { visibility: 'none' },
    })
  })

  it('installs visible with the stored opacity when it is the chosen overlay', () => {
    useUiStore.setState({ terrainOverlay: 'slope', overlayOpacity: 0.8 })
    render(<TerrainOverlayLayer overlay="slope" />)
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
    render(<TerrainOverlayLayer overlay="slope" />)
    expect(map.addLayer.mock.calls[0][1]).toBe('place-labels')
  })

  it('inserts below Couloir layers when the basemap has no labels', () => {
    withStyleLayers([
      { id: 'background', type: 'background' },
      { id: 'routes-glow', type: 'line' },
      { id: 'waypoints-symbols', type: 'symbol' },
    ])
    render(<TerrainOverlayLayer overlay="slope" />)
    expect(map.addLayer.mock.calls[0][1]).toBe('routes-glow')
  })

  it('appends on top when there is nothing to go under', () => {
    withStyleLayers([{ id: 'background', type: 'background' }])
    render(<TerrainOverlayLayer overlay="slope" />)
    expect(map.addLayer.mock.calls[0][1]).toBeUndefined()
  })

  it('applies overlay and opacity changes to the existing layer', () => {
    map.getLayer.mockReturnValue({} as never)
    render(<TerrainOverlayLayer overlay="slope" />)
    act(() => useUiStore.getState().setTerrainOverlay('slope'))
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith('slope-raster', 'visibility', 'visible')
    act(() => useUiStore.getState().setOverlayOpacity(0.3))
    expect(map.setPaintProperty).toHaveBeenCalledWith('slope-raster', 'raster-opacity', 0.3)
    act(() => useUiStore.getState().setTerrainOverlay('aspect'))
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith('slope-raster', 'visibility', 'none')
  })

  it('installs the aspect overlay on its own source and layer', () => {
    useUiStore.setState({ terrainOverlay: 'aspect' })
    render(<TerrainOverlayLayer overlay="aspect" />)
    expect(map.addSource).toHaveBeenCalledWith(
      'aspect-source',
      expect.objectContaining({ tiles: ['aspect://{z}/{x}/{y}'] }),
    )
    const [layer] = map.addLayer.mock.calls[0] as [Record<string, unknown>]
    expect(layer).toMatchObject({
      id: 'aspect-raster',
      source: 'aspect-source',
      layout: { visibility: 'visible' },
    })
  })

  it('reinstalls after a style swap without duplicating the source', () => {
    render(<TerrainOverlayLayer overlay="slope" />)
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

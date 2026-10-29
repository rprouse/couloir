import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { WaypointsLayer } from './WaypointsLayer'
import { WAYPOINTS_SYMBOLS_LAYER_ID } from './layerStyles'

// jsdom has no 2D canvas; the drawing is covered by wpIcons.test.ts.
vi.mock('./wpIcons', () => ({
  buildWaypointIcon: () => ({ data: { width: 64, height: 64 }, pixelRatio: 2 }),
}))

describe('WaypointsLayer', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
    useWaypointsStore.setState({ waypoints: [] })
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
  })
  afterEach(() => act(() => setMap(null)))

  const missing = (id: string) => act(() => map.emit('styleimagemissing', { id }))

  it('reads each feature’s icon image from its image property', () => {
    render(<WaypointsLayer />)
    const [layer] = map.addLayer.mock.calls[0] as [{ id: string; layout: Record<string, unknown> }]
    expect(layer.id).toBe(WAYPOINTS_SYMBOLS_LAYER_ID)
    expect(layer.layout['icon-image']).toEqual(['get', 'image'])
  })

  it('listens for missing images before adding the layer', () => {
    render(<WaypointsLayer />)
    const onOrder = map.on.mock.invocationCallOrder[
      map.on.mock.calls.findIndex(([event]) => event === 'styleimagemissing')
    ]
    expect(onOrder).toBeLessThan(map.addLayer.mock.invocationCallOrder[0])
  })

  it('draws a waypoint image on demand at 2× pixel ratio', () => {
    render(<WaypointsLayer />)
    missing('wp:cabin:22C55E')
    expect(map.addImage).toHaveBeenCalledWith('wp:cabin:22C55E', expect.anything(), { pixelRatio: 2 })
  })

  it('ignores images it did not make and ones already registered', () => {
    render(<WaypointsLayer />)
    missing('photo-placeholder')
    map.hasImage.mockReturnValue(true)
    missing('wp:cabin:22C55E')
    expect(map.addImage).not.toHaveBeenCalled()
  })

  it('stops listening on unmount', () => {
    const { unmount } = render(<WaypointsLayer />)
    unmount()
    missing('wp:cabin:22C55E')
    expect(map.addImage).not.toHaveBeenCalled()
  })
})

import { __mocks__ } from '../test/mocks/maplibre-gl'
import { flyToEntity, POINT_FLY_ZOOM } from './flyToEntity'

describe('flyToEntity', () => {
  it('fits a line entity to its bounds', () => {
    const map = new __mocks__.MockMap()
    flyToEntity(map as never, { kind: 'line', geojson: { type: 'LineString', coordinates: [[-116, 49.5, 0], [-115.9, 49.6, 0]] } })
    expect(map.fitBounds).toHaveBeenCalledWith([[-116, 49.5], [-115.9, 49.6]], expect.objectContaining({ padding: expect.any(Number) }))
  })
  it('flies to a point entity, never zooming out', () => {
    const map = new __mocks__.MockMap()
    map.getZoom.mockReturnValue(16)
    flyToEntity(map as never, { kind: 'point', lat: 49.5, lng: -116 })
    expect(map.flyTo).toHaveBeenCalledWith({ center: [-116, 49.5], zoom: 16 })
    map.getZoom.mockReturnValue(10)
    flyToEntity(map as never, { kind: 'point', lat: 49.5, lng: -116 })
    expect(map.flyTo).toHaveBeenLastCalledWith({ center: [-116, 49.5], zoom: POINT_FLY_ZOOM })
  })
})

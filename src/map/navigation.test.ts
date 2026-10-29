import type maplibregl from 'maplibre-gl'
import { __mocks__ } from '../test/mocks/maplibre-gl'
import { formatCoordinate, readNavigation } from './navigation'

function mockMap(): InstanceType<typeof __mocks__.MockMap> {
  return new __mocks__.MockMap()
}

describe('readNavigation', () => {
  it('reads the centre and normalises the bearing to 0–359', () => {
    const map = mockMap()
    map.getCenter.mockReturnValue({ lng: -115.1, lat: 49.5 })
    map.getBearing.mockReturnValue(-90.4)
    const reading = readNavigation(map as unknown as maplibregl.Map)
    expect(reading).toEqual({ lat: 49.5, lng: -115.1, elevationM: null, bearingDeg: 270 })
  })

  it('wraps a bearing that rounds up to 360', () => {
    const map = mockMap()
    map.getBearing.mockReturnValue(359.7)
    expect(readNavigation(map as unknown as maplibregl.Map).bearingDeg).toBe(0)
  })

  it('removes the terrain exaggeration from the elevation', () => {
    const map = mockMap()
    map.terrain = { exaggeration: 1.5, getElevationForLngLatZoom: vi.fn(() => 3000) }
    expect(readNavigation(map as unknown as maplibregl.Map).elevationM).toBe(2000)
  })
})

describe('formatCoordinate', () => {
  it('uses five decimal places', () => {
    expect(formatCoordinate(49.504)).toBe('49.50400')
    expect(formatCoordinate(-115.0634567)).toBe('-115.06346')
  })
})

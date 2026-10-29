import { buildPhotosGeoJson } from './photosLayerData'
import type { Photo } from '../../types'

const photo = (id: string, lat: number, lng: number, bearing: number | null = null) =>
  ({ id, lat, lng, bearing }) as Photo

describe('buildPhotosGeoJson', () => {
  it('emits one point per photo at its position, with its id', () => {
    expect(buildPhotosGeoJson([photo('a', 49.5, -115)])).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-115, 49.5] },
        properties: { id: 'a' },
      }],
    })
  })
  it('carries the bearing when it is set, including due north', () => {
    const [north, east] = buildPhotosGeoJson([photo('n', 0, 0, 0), photo('e', 0, 0, 90)]).features
    expect(north.properties).toEqual({ id: 'n', bearing: 0 })
    expect(east.properties).toEqual({ id: 'e', bearing: 90 })
  })
})

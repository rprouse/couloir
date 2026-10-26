import { buildPhotosGeoJson, photoIconName } from './photosLayerData'
import type { Photo } from '../../types'

const photo = (id: string, lat: number, lng: number) => ({ id, lat, lng }) as Photo

describe('buildPhotosGeoJson', () => {
  it('emits one point per photo at its position, with id and icon name', () => {
    expect(buildPhotosGeoJson([photo('a', 49.5, -115)])).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-115, 49.5] },
        properties: { id: 'a', icon: 'photo-a' },
      }],
    })
  })
  it('names icons by photo id', () => {
    expect(photoIconName('xyz')).toBe('photo-xyz')
  })
})

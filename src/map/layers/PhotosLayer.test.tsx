import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { PhotosLayer } from './PhotosLayer'
import { PHOTO_CLUSTER } from '../../types'

describe('PhotosLayer', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
    usePhotosStore.setState({ photos: [] })
  })
  afterEach(() => act(() => setMap(null)))

  it('adds a clustered source and the three photo layers', () => {
    render(<PhotosLayer />)
    expect(map.addSource).toHaveBeenCalledWith('photos-source', expect.objectContaining({
      type: 'geojson', cluster: true,
      clusterMaxZoom: PHOTO_CLUSTER.clusterMaxZoom, clusterRadius: PHOTO_CLUSTER.clusterRadius,
    }))
    const layers = map.addLayer.mock.calls.map(([l]) => l as { id: string; filter?: unknown })
    expect(layers.map((l) => l.id)).toEqual(['photos-clusters', 'photos-cluster-count', 'photos-thumbnails'])
    expect(layers[0].filter).toEqual(['has', 'point_count'])
    expect(layers[2].filter).toEqual(['!', ['has', 'point_count']])
    expect(map.addImage).toHaveBeenCalledWith('photo-placeholder', expect.anything(), { pixelRatio: 2 })
  })

  it('toggles visibility on every photos-* layer together', () => {
    map.getLayer.mockReturnValue({} as never)
    render(<PhotosLayer />)
    map.setLayoutProperty.mockClear()
    act(() => useUiStore.getState().toggleLayer('photos'))
    for (const id of ['photos-clusters', 'photos-cluster-count', 'photos-thumbnails']) {
      expect(map.setLayoutProperty).toHaveBeenCalledWith(id, 'visibility', 'none')
    }
    act(() => useUiStore.getState().toggleLayer('photos'))
  })
})

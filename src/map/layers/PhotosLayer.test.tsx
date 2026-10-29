import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { PhotosLayer } from './PhotosLayer'
import { PHOTO_ARROW_MIN_ZOOM } from './layerStyles'

interface LayerSpec {
  id: string
  type: string
  minzoom?: number
  filter?: unknown
  layout?: Record<string, unknown>
}

describe('PhotosLayer', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
    usePhotosStore.setState({ photos: [] })
  })
  afterEach(() => act(() => setMap(null)))

  it('adds an unclustered source with bearing arrows beneath the dots', () => {
    render(<PhotosLayer />)
    const [, source] = map.addSource.mock.calls[0] as [string, Record<string, unknown>]
    expect(map.addSource.mock.calls[0][0]).toBe('photos-source')
    expect(source.cluster).toBeUndefined()

    const layers = map.addLayer.mock.calls.map(([l]) => l as LayerSpec)
    expect(layers.map((l) => [l.id, l.type])).toEqual([
      ['photos-arrows', 'symbol'],
      ['photos-dots', 'circle'],
    ])
    const [arrows] = layers
    expect(arrows.minzoom).toBe(PHOTO_ARROW_MIN_ZOOM)
    expect(arrows.filter).toEqual(['has', 'bearing'])
    expect(arrows.layout).toMatchObject({
      'icon-image': 'photo-arrow',
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
    })
    expect(map.addImage).toHaveBeenCalledWith('photo-arrow', expect.anything(), { pixelRatio: 2 })
  })

  it('re-registers the arrow image after a basemap switch', () => {
    render(<PhotosLayer />)
    map.addImage.mockClear()
    map.emit('style.load')
    expect(map.addImage).toHaveBeenCalledWith('photo-arrow', expect.anything(), { pixelRatio: 2 })
  })

  it('opens the photo when its dot is clicked', () => {
    render(<PhotosLayer />)
    // The mock's on() is typed (event, handler); the layer-scoped form passes
    // (event, layerId, handler).
    const calls = map.on.mock.calls as unknown as [string, string, (e: unknown) => void][]
    const handler = calls.find(([event, layer]) => event === 'click' && layer === 'photos-dots')?.[2]
    act(() => handler?.({ features: [{ properties: { id: 'p1' } }] }))
    expect(useUiStore.getState().panel).toEqual({ mode: 'view', entityType: 'photo', entityId: 'p1' })
  })

  it('toggles visibility on every photos-* layer together', () => {
    map.getLayer.mockReturnValue({} as never)
    render(<PhotosLayer />)
    map.setLayoutProperty.mockClear()
    act(() => useUiStore.getState().toggleLayer('photos'))
    for (const id of ['photos-arrows', 'photos-dots']) {
      expect(map.setLayoutProperty).toHaveBeenCalledWith(id, 'visibility', 'none')
    }
    act(() => useUiStore.getState().toggleLayer('photos'))
  })
})

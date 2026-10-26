import maplibregl from 'maplibre-gl'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { applyPhotoCursorPreview } from './photoCursorPreview'

describe('applyPhotoCursorPreview', () => {
  beforeEach(() => vi.mocked(maplibregl.Marker).mockClear())

  it('adds a pointer-transparent thumbnail marker that follows the cursor', () => {
    const map = new __mocks__.MockMap()
    const teardown = applyPhotoCursorPreview(map as never, 'blob:test/thumb')
    const marker = vi.mocked(maplibregl.Marker).mock.results[0].value as InstanceType<typeof __mocks__.MockMarker>
    const el = marker.options.element as HTMLImageElement
    expect(el.src).toBe('blob:test/thumb')
    expect(el.style.pointerEvents).toBe('none')
    expect(marker.addTo).not.toHaveBeenCalled()

    map.emit('mousemove', { lngLat: { lng: -115, lat: 49.5 } })
    map.emit('mousemove', { lngLat: { lng: -115.1, lat: 49.6 } })
    expect(marker.addTo).toHaveBeenCalledTimes(1)
    expect(marker.setLngLat).toHaveBeenLastCalledWith({ lng: -115.1, lat: 49.6 })

    teardown()
    expect(marker.remove).toHaveBeenCalled()
    expect(map.off).toHaveBeenCalledWith('mousemove', expect.any(Function))
  })
})

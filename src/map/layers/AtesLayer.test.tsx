import { render } from '@testing-library/react'
import { act } from 'react'
import { __mocks__, Popup } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { useAtesAreasStore } from '../../store/atesAreas'
import { buildAtesArea } from '../../storage/contract'
import { AtesLayer } from './AtesLayer'
import {
  ATES_ATTRIBUTION,
  ATES_DECISION_LAYER_ID,
  ATES_FILL_LAYER_ID,
  ATES_LAYER_IDS,
  ATES_SOURCE_ID,
  ROUTES_LINE_LAYER_ID,
} from './layerStyles'

type AddedLayer = { id: string; type: string; filter: unknown; paint: Record<string, unknown>; layout: Record<string, unknown> }

describe('AtesLayer', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(Popup).mockClear()
    useUiStore.setState(useUiStore.getInitialState())
    useAtesAreasStore.setState({ areas: [buildAtesArea()] })
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
  })
  afterEach(() => act(() => setMap(null)))

  const added = () => map.addLayer.mock.calls.map(([layer]) => layer as AddedLayer)

  it('adds one GeoJSON source with the areas and Avalanche Canada attribution', () => {
    render(<AtesLayer />)
    const [id, source] = map.addSource.mock.calls[0] as [string, { type: string; data: { features: unknown[] }; attribution: string }]
    expect(id).toBe(ATES_SOURCE_ID)
    expect(source.type).toBe('geojson')
    expect(source.data.features).toHaveLength(2)
    expect(source.attribution).toBe(ATES_ATTRIBUTION)
  })

  it('adds every ATES layer, each filtered to its feature kind', () => {
    render(<AtesLayer />)
    expect(added().map((l) => l.id)).toEqual([...ATES_LAYER_IDS])
    const filters = Object.fromEntries(added().map((l) => [l.id, l.filter]))
    expect(filters['ates-fill']).toEqual(['==', ['get', 'kind'], 'zone'])
    expect(filters['ates-outline']).toEqual(['==', ['get', 'kind'], 'zone'])
    expect(filters['ates-area']).toEqual(['==', ['get', 'kind'], 'area'])
    expect(filters['ates-paths']).toEqual(['==', ['get', 'kind'], 'avalanche_path'])
    expect(filters['ates-lines']).toEqual(['==', ['get', 'kind'], 'ates_line'])
    expect(filters['ates-decision-points']).toEqual(['==', ['get', 'kind'], 'decision_point'])
    expect(filters['ates-access']).toEqual(['==', ['get', 'kind'], 'access_route'])
    expect(filters['ates-poi']).toEqual(['==', ['get', 'kind'], 'poi'])
    expect(filters['ates-path-arrows']).toEqual(['==', ['get', 'kind'], 'avalanche_path'])
  })

  it('puts a downslope arrow at the middle of each avalanche path', () => {
    render(<AtesLayer />)
    expect(map.addImage).toHaveBeenCalledWith('ates-path-arrow', expect.anything(), { pixelRatio: 2 })
    const arrows = added().find((l) => l.id === 'ates-path-arrows')!
    expect(arrows.type).toBe('symbol')
    expect(arrows.layout).toMatchObject({
      'symbol-placement': 'line-center',
      'icon-image': 'ates-path-arrow',
      'icon-rotation-alignment': 'map',
    })
  })

  it('draws points of interest as waypoint markers, adding missing images', () => {
    render(<AtesLayer />)
    const poi = added().find((l) => l.id === 'ates-poi')!
    expect(poi.layout['icon-image']).toEqual([
      'match', ['get', 'poi'],
      'parking', 'wp:local_parking:22C55E',
      'cabin', 'wp:cottage:3B82F6',
      'destination', 'wp:flag:F97316',
      'other', 'wp:location_on:A78BFA',
      'wp:location_on:A78BFA',
    ])
    expect(poi.layout['icon-size']).toBe(0.8)
    act(() => map.emit('styleimagemissing', { id: 'wp:flag:F97316' }))
    expect(map.addImage).toHaveBeenCalledWith('wp:flag:F97316', expect.anything(), { pixelRatio: 2 })
  })

  it('fills zones by class at the stored opacity', () => {
    useUiStore.setState({ atesOpacity: 0.7 })
    render(<AtesLayer />)
    const fill = added().find((l) => l.id === ATES_FILL_LAYER_ID)!
    expect((fill.paint['fill-color'] as unknown[])[0]).toBe('match')
    expect(fill.paint['fill-opacity']).toBe(0.7)
  })

  it('inserts below basemap labels and Couloir entity layers, above the terrain overlay', () => {
    map.getStyle.mockReturnValue({
      layers: [
        { id: 'background', type: 'background' },
        { id: 'slope-raster', type: 'raster' },
        { id: 'routes-glow', type: 'line' },
        { id: 'place-labels', type: 'symbol' },
      ],
    })
    render(<AtesLayer />)
    expect(map.addLayer.mock.calls.every(([, before]) => before === 'routes-glow')).toBe(true)
  })

  it('installs hidden when switched off, and follows the switch and opacity', () => {
    useUiStore.setState({ atesEnabled: false })
    render(<AtesLayer />)
    expect(added().every((l) => l.layout.visibility === 'none')).toBe(true)

    map.getLayer.mockReturnValue({} as never)
    act(() => useUiStore.getState().setAtesEnabled(true))
    for (const id of ATES_LAYER_IDS) {
      expect(map.setLayoutProperty).toHaveBeenCalledWith(id, 'visibility', 'visible')
    }
    act(() => useUiStore.getState().setAtesOpacity(0.3))
    expect(map.setPaintProperty).toHaveBeenCalledWith(ATES_FILL_LAYER_ID, 'fill-opacity', 0.3)
  })

  it('pushes new data when areas change', () => {
    const setData = vi.fn()
    render(<AtesLayer />)
    map.getSource.mockReturnValue({ type: 'geojson', setData } as never)
    act(() => useAtesAreasStore.setState({ areas: [] }))
    expect(setData).toHaveBeenCalledWith({ type: 'FeatureCollection', features: [] })
  })

  it('reinstalls after a style swap without duplicating the source', () => {
    render(<AtesLayer />)
    map.getSource.mockReturnValue({} as never)
    act(() => map.emit('style.load'))
    expect(map.addSource).toHaveBeenCalledTimes(1)
    map.getSource.mockReturnValue(null as never)
    act(() => map.emit('style.load'))
    expect(map.addSource).toHaveBeenCalledTimes(2)
  })

  describe('click popup', () => {
    const click = () =>
      act(() => map.emit('click', { point: { x: 1, y: 2 }, lngLat: { lng: -116, lat: 49.5 } }))

    const zone = { properties: { kind: 'zone', ates: 'complex', description: 'Steep.', areaName: 'Test Basin' } }
    const decision = { properties: { kind: 'decision_point', name: 'Col', description: '', areaName: 'Test Basin' } }

    beforeEach(() => {
      map.getLayer.mockReturnValue({} as never)
    })

    function hitsFor(entityHits: unknown[], atesHits: unknown[]) {
      map.queryRenderedFeatures.mockImplementation((_p, opts) =>
        opts?.layers?.includes(ATES_FILL_LAYER_ID) ? atesHits : entityHits,
      )
    }

    it('shows the area, class and definition of a clicked zone', () => {
      hitsFor([], [zone])
      render(<AtesLayer />)
      click()
      expect(Popup).toHaveBeenCalledTimes(1)
      const popup = vi.mocked(Popup).mock.results[0].value as InstanceType<typeof __mocks__.MockPopup>
      expect(popup.setLngLat).toHaveBeenCalledWith({ lng: -116, lat: 49.5 })
      expect(popup.addTo).toHaveBeenCalledWith(map)
      expect(popup.content?.textContent).toContain('Test Basin')
      expect(popup.content?.textContent).toContain('Complex (Class 3)')
      expect(popup.content?.textContent).toContain('Steep.')
    })

    it('prefers a decision point over the zone under it', () => {
      hitsFor([], [zone, decision])
      render(<AtesLayer />)
      click()
      const popup = vi.mocked(Popup).mock.results[0].value as InstanceType<typeof __mocks__.MockPopup>
      expect(popup.content?.textContent).toContain('Col')
      expect(popup.content?.textContent).toContain('Decision point')
    })

    it('prefers a point of interest, and names an access route', () => {
      const poi = { properties: { kind: 'poi', poi: 'cabin', name: 'Tunnel Creek Hut', description: '', areaName: 'Test Basin' } }
      const access = { properties: { kind: 'access_route', name: 'Access', description: 'Access', areaName: 'Test Basin' } }
      hitsFor([], [zone, access, poi])
      render(<AtesLayer />)
      click()
      const popup = vi.mocked(Popup).mock.results[0].value as InstanceType<typeof __mocks__.MockPopup>
      expect(popup.content?.textContent).toBe('Tunnel Creek HutHut, cabin or shelter · Test Basin')
      hitsFor([], [zone, access])
      click()
      const second = vi.mocked(Popup).mock.results[1].value as InstanceType<typeof __mocks__.MockPopup>
      // The description repeats the name, so it isn't shown twice.
      expect(second.content?.textContent).toBe('AccessAccess route · Test Basin')
    })

    it('stands aside when a route, track, waypoint or photo was clicked', () => {
      hitsFor([{ properties: { id: 'route-1' } }], [zone])
      render(<AtesLayer />)
      click()
      expect(Popup).not.toHaveBeenCalled()
      const [, entityQuery] = map.queryRenderedFeatures.mock.calls[0]
      expect(entityQuery?.layers).toContain(ROUTES_LINE_LAYER_ID)
      expect(entityQuery?.layers).not.toContain(ATES_FILL_LAYER_ID)
    })

    it('does nothing while placing a waypoint or photo, or when switched off', () => {
      hitsFor([], [zone])
      render(<AtesLayer />)
      act(() => useUiStore.getState().startWaypointPlacement())
      click()
      act(() => useUiStore.getState().cancelPlacement())
      act(() => useUiStore.getState().setAtesEnabled(false))
      click()
      expect(Popup).not.toHaveBeenCalled()
    })

    it('closes the open popup on the next click and on unmount', () => {
      hitsFor([], [zone])
      const { unmount } = render(<AtesLayer />)
      click()
      const first = vi.mocked(Popup).mock.results[0].value as InstanceType<typeof __mocks__.MockPopup>
      click()
      expect(first.remove).toHaveBeenCalled()
      const second = vi.mocked(Popup).mock.results[1].value as InstanceType<typeof __mocks__.MockPopup>
      unmount()
      expect(second.remove).toHaveBeenCalled()
    })

    it('shows a pointer over decision points', () => {
      render(<AtesLayer />)
      const canvas = { style: { cursor: '' } as CSSStyleDeclaration }
      map.getCanvas.mockReturnValue(canvas)
      act(() => map.emitLayer('mouseenter', ATES_DECISION_LAYER_ID))
      expect(canvas.style.cursor).toBe('pointer')
      act(() => map.emitLayer('mouseleave', ATES_DECISION_LAYER_ID))
      expect(canvas.style.cursor).toBe('')
    })
  })
})

import { strToU8, zipSync } from 'fflate'
import { act } from 'react'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { InMemoryStorageProvider } from '../../storage/memory'
import { clearStorage, setStorage } from '../../storage/provider'
import { useAtesAreasStore } from '../../store/atesAreas'
import { useUiStore } from '../../store/ui'
import { ATES_FIXTURE_KML } from '../../utils/atesKml.fixture'
import { subscribeToast } from '../import/importToast'
import { runAtesImport } from './runAtesImport'

const kmz = (kml: string, name = 'Fixture Basin.kmz') =>
  new File([zipSync({ 'doc.kml': strToU8(kml) })], name)

describe('runAtesImport', () => {
  let toasts: (string | null)[]
  let unsubscribe: () => void
  let map: InstanceType<typeof __mocks__.MockMap>

  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
    useAtesAreasStore.setState({ areas: [], loading: false, error: null })
    toasts = []
    unsubscribe = subscribeToast((m) => toasts.push(m))
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
  })

  afterEach(() => {
    unsubscribe()
    clearStorage()
    act(() => setMap(null))
  })

  it('imports, reports zones and skips, turns the layer on and frames the area', async () => {
    useUiStore.setState({ atesEnabled: false })
    await runAtesImport([kmz(ATES_FIXTURE_KML)])
    expect(toasts[0]).toBe('Imported Fixture Basin (7 zones, 1 skipped).')
    expect(useAtesAreasStore.getState().areas).toHaveLength(1)
    expect(useUiStore.getState().atesEnabled).toBe(true)
    expect(map.fitBounds).toHaveBeenCalledWith(
      [[-115.08, 49.33], [expect.closeTo(-115.039, 6), expect.closeTo(49.36, 6)]],
      { padding: 40 },
    )
  })

  it('says Updated when the area was already imported', async () => {
    await runAtesImport([kmz(ATES_FIXTURE_KML)])
    await runAtesImport([kmz(ATES_FIXTURE_KML)])
    expect(toasts.at(-1)).toMatch(/^Updated Fixture Basin/)
    expect(useAtesAreasStore.getState().areas).toHaveLength(1)
  })

  it('reports a bad file by name and still imports the good one', async () => {
    await runAtesImport([new File(['nope'], 'route.kmz'), kmz(ATES_FIXTURE_KML)])
    expect(toasts[0]).toMatch(/^route\.kmz: This file is not a KMZ.*Imported Fixture Basin/)
    expect(useAtesAreasStore.getState().areas).toHaveLength(1)
  })

  it('leaves the layer and map alone when nothing imported', async () => {
    useUiStore.setState({ atesEnabled: false })
    await runAtesImport([new File(['nope'], 'route.kmz')])
    expect(useUiStore.getState().atesEnabled).toBe(false)
    expect(map.fitBounds).not.toHaveBeenCalled()
  })
})

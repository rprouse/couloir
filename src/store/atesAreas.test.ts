import { strToU8, zipSync } from 'fflate'
import { useAtesAreasStore } from './atesAreas'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import { buildAtesArea } from '../storage/contract'
import { ATES_FIXTURE_KML } from '../utils/atesKml.fixture'

const kmz = (kml: string) => new File([zipSync({ 'doc.kml': strToU8(kml) })], 'x.kmz')

describe('ATES areas store', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useAtesAreasStore.setState({ areas: [], loading: false, error: null })
  })

  afterEach(() => {
    clearStorage()
  })

  it('load() reads every area from storage', async () => {
    await storage.saveAtesArea(buildAtesArea())
    await useAtesAreasStore.getState().load()
    expect(useAtesAreasStore.getState().areas.map((a) => a.id)).toEqual(['ates-1'])
  })

  it('importFile() adds the area in name order, and a re-import replaces it', async () => {
    await storage.saveAtesArea(buildAtesArea({ id: 'z', name: 'Zed Bowl' }))
    await useAtesAreasStore.getState().load()

    const first = await useAtesAreasStore.getState().importFile(kmz(ATES_FIXTURE_KML))
    expect(useAtesAreasStore.getState().areas.map((a) => a.name)).toEqual(['Fixture Basin', 'Zed Bowl'])

    const again = await useAtesAreasStore.getState().importFile(kmz(ATES_FIXTURE_KML))
    expect(again.replaced).toBe(true)
    expect(again.area.id).toBe(first.area.id)
    expect(useAtesAreasStore.getState().areas).toHaveLength(2)
  })

  it('remove() drops the area from state and storage', async () => {
    await storage.saveAtesArea(buildAtesArea())
    await useAtesAreasStore.getState().load()
    await useAtesAreasStore.getState().remove('ates-1')
    expect(useAtesAreasStore.getState().areas).toEqual([])
    expect(await storage.getAtesAreas()).toEqual([])
  })
})

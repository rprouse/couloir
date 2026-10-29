import { strToU8, zipSync } from 'fflate'
import { InMemoryStorageProvider } from '../../storage/memory'
import { AtesImportError } from '../../utils/atesKml'
import { ATES_FIXTURE_KML } from '../../utils/atesKml.fixture'
import { importAtesKmz } from './atesImport'

function kmzFile(kml: string, name = 'Fixture Basin.kmz'): File {
  return new File([zipSync({ 'doc.kml': strToU8(kml) })], name)
}

describe('importAtesKmz', () => {
  let storage: InMemoryStorageProvider

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('imports a new area', async () => {
    const result = await importAtesKmz(storage, kmzFile(ATES_FIXTURE_KML))
    expect(result.replaced).toBe(false)
    expect(result.skipped).toBe(1)
    expect(result.area.name).toBe('Fixture Basin')
    expect(result.area.source_filename).toBe('Fixture Basin.kmz')
    expect(result.area.imported_at).toBe(result.area.updated_at)
    expect(await storage.getAtesAreas()).toEqual([result.area])
  })

  it('replaces an area with the same name in place, keeping its id and import date', async () => {
    // Only Date: faking timers would stall jsdom's File.arrayBuffer().
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const first = await importAtesKmz(storage, kmzFile(ATES_FIXTURE_KML))

    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))
    const fewerZones = ATES_FIXTURE_KML
      .replace('<name>Fixture Basin</name>', '<name>FIXTURE basin</name>')
      .replace(/<Folder>\s*<name>Class 3 – Complex<\/name>[\s\S]*?<\/Folder>/, '')
    const second = await importAtesKmz(storage, kmzFile(fewerZones, 'renamed.kmz'))

    expect(second.replaced).toBe(true)
    expect(second.area.id).toBe(first.area.id)
    expect(second.area.imported_at).toBe('2026-01-01T00:00:00.000Z')
    expect(second.area.updated_at).toBe('2026-02-01T00:00:00.000Z')
    expect(second.area.geojson.features.length).toBe(first.area.geojson.features.length - 1)

    const stored = await storage.getAtesAreas()
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('FIXTURE basin')
  })

  it('throws AtesImportError for a file that is not a KMZ', async () => {
    await expect(importAtesKmz(storage, new File(['<gpx/>'], 'route.gpx')))
      .rejects.toBeInstanceOf(AtesImportError)
    expect(await storage.getAtesAreas()).toEqual([])
  })
})

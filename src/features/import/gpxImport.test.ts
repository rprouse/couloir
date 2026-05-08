import { importGpxFiles, type ImportDeps, type DuplicateChoice } from './gpxImport'
import type { ParsedGpx } from '../../utils/gpx'
import type { Route, Track } from '../../types'

const minimalRoute: Route = {
  id: 'existing-id',
  user_id: 'local',
  name: 'existing',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
  source_hash: 'h',
  source_filename: null,
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const minimalTrack: Track = {
  id: 'existing-id',
  user_id: 'local',
  name: 'existing',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
  source_hash: 'h',
  source_filename: null,
  color: '#2A7BE0',
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  duration_s: null,
  moving_time_s: null,
  recorded_at: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

// Build a fake GPX file. The real parser isn't exercised here; we stub out
// `parseGpx` via deps so the test focuses on orchestration.
function fakeFile(name: string, content = name): File {
  return new File([content], name, { type: 'application/gpx+xml' })
}

const baseDeps: () => ImportDeps = () => ({
  parseGpx: (xml, filename) => {
    if (xml === 'BAD') throw new Error('parse error')
    return {
      kind: filename.includes('track') ? 'track' : 'route',
      name: filename,
      description: '',
      geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
      distance_m: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      source_filename: filename,
      ...(filename.includes('track')
        ? { duration_s: null, moving_time_s: null, recorded_at: null }
        : {}),
    } as ParsedGpx
  },
  hashBytes: async (bytes) => `hash-${new TextDecoder().decode(bytes)}`,
  lookupRouteByHash: async () => null,
  lookupTrackByHash: async () => null,
  saveRoute: vi.fn().mockResolvedValue({ id: 'r1' }),
  saveTrack: vi.fn().mockResolvedValue({ id: 't1' }),
  replaceRoute: vi.fn().mockResolvedValue(undefined),
  replaceTrack: vi.fn().mockResolvedValue(undefined),
  promptDuplicate: async () => ({ choice: 'skip', applyToAll: false }),
})

describe('importGpxFiles', () => {
  it('imports a single non-duplicate route', async () => {
    const deps = baseDeps()
    const summary = await importGpxFiles([fakeFile('a.gpx')], deps)
    expect(summary.routesImported).toBe(1)
    expect(summary.tracksImported).toBe(0)
    expect(summary.duplicatesSkipped).toBe(0)
    expect(summary.errors).toEqual([])
    expect(deps.saveRoute).toHaveBeenCalledOnce()
  })

  it('routes track files to saveTrack', async () => {
    const deps = baseDeps()
    await importGpxFiles([fakeFile('my-track.gpx')], deps)
    expect(deps.saveTrack).toHaveBeenCalledOnce()
    expect(deps.saveRoute).not.toHaveBeenCalled()
  })

  it('skips a duplicate when the user chooses skip', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => minimalRoute
    deps.promptDuplicate = async () => ({ choice: 'skip', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('dup.gpx')], deps)
    expect(summary.duplicatesSkipped).toBe(1)
    expect(summary.routesImported).toBe(0)
    expect(deps.saveRoute).not.toHaveBeenCalled()
  })

  it('replaces a duplicate when the user chooses replace', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => minimalRoute
    deps.promptDuplicate = async () => ({ choice: 'replace', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('dup.gpx')], deps)
    expect(summary.routesReplaced).toBe(1)
    expect(deps.replaceRoute).toHaveBeenCalledWith('existing-id', expect.any(Object))
  })

  it('imports a duplicate as a new copy when chosen', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => minimalRoute
    deps.promptDuplicate = async () => ({ choice: 'new-copy', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('dup.gpx')], deps)
    expect(summary.routesImported).toBe(1)
    expect(summary.duplicatesSkipped).toBe(0)
    expect(deps.saveRoute).toHaveBeenCalledOnce()
  })

  it('honors applyToAll across remaining files in the drop', async () => {
    const deps = baseDeps()
    deps.lookupRouteByHash = async () => minimalRoute
    let prompts = 0
    deps.promptDuplicate = async () => {
      prompts++
      return { choice: 'skip', applyToAll: true }
    }
    const summary = await importGpxFiles(
      [fakeFile('a.gpx'), fakeFile('b.gpx'), fakeFile('c.gpx')],
      deps,
    )
    expect(prompts).toBe(1)
    expect(summary.duplicatesSkipped).toBe(3)
  })

  it('continues after a parse error and reports it', async () => {
    const deps = baseDeps()
    const summary = await importGpxFiles(
      [
        new File(['BAD'], 'broken.gpx'),
        fakeFile('good.gpx'),
      ],
      deps,
    )
    expect(summary.routesImported).toBe(1)
    expect(summary.errors).toHaveLength(1)
    expect(summary.errors[0].filename).toBe('broken.gpx')
  })

  it('replaces a duplicate track when the user chooses replace', async () => {
    const deps = baseDeps()
    deps.lookupTrackByHash = async () => minimalTrack
    deps.promptDuplicate = async () => ({ choice: 'replace', applyToAll: false })
    const summary = await importGpxFiles([fakeFile('my-track.gpx')], deps)
    expect(summary.tracksReplaced).toBe(1)
    expect(summary.tracksImported).toBe(0)
    expect(deps.replaceTrack).toHaveBeenCalledWith('existing-id', expect.any(Object))
    expect(deps.saveTrack).not.toHaveBeenCalled()
  })
})

// `DuplicateChoice` is a literal union, so the array annotation below would
// fail typecheck if a string was misspelled — no runtime expect needed.
const _validChoices: DuplicateChoice[] = ['replace', 'skip', 'new-copy']
void _validChoices

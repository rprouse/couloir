import { useTracksStore } from './tracks'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Track } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  geojson: {
    type: 'LineString' as const,
    coordinates: [[-116, 49.5, 1500]] as Array<[number, number, number]>,
  },
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
} satisfies Omit<Track, 'id' | 'created_at' | 'updated_at'>

describe('tracks store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useTracksStore.setState({ tracks: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() persists and round-trips through reload', async () => {
    const t = await useTracksStore.getState().add({ ...baseInput, name: 'Persisted' })
    useTracksStore.setState({ tracks: [] })
    await useTracksStore.getState().load()
    expect(useTracksStore.getState().tracks[0].id).toBe(t.id)
  })

  it('update() advances updated_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const t = await useTracksStore.getState().add(baseInput)
    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await useTracksStore.getState().update(t.id, { name: 'Renamed' })
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')
    vi.useRealTimers()
  })

  it('remove() drops from state and storage', async () => {
    const t = await useTracksStore.getState().add(baseInput)
    await useTracksStore.getState().remove(t.id)
    expect(useTracksStore.getState().tracks).toEqual([])
  })
})

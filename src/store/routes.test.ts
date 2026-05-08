import { useRoutesStore } from './routes'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Route } from '../types'

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
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
} satisfies Omit<Route, 'id' | 'created_at' | 'updated_at'>

describe('routes store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useRoutesStore.setState({ routes: [], loading: false, error: null })
  })

  afterEach(() => {
    clearStorage()
    vi.useRealTimers()
  })

  it('loads an empty list initially', async () => {
    await useRoutesStore.getState().load()
    expect(useRoutesStore.getState().routes).toEqual([])
    expect(useRoutesStore.getState().loading).toBe(false)
  })

  it('add() generates id + timestamps and persists through storage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))

    const route = await useRoutesStore.getState().add(baseInput)
    expect(route.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(route.created_at).toBe('2026-05-06T12:00:00.000Z')
    expect(route.updated_at).toBe(route.created_at)

    expect(useRoutesStore.getState().routes).toHaveLength(1)

    vi.useRealTimers()
  })

  it('add() round-trips through storage on a fresh load', async () => {
    await useRoutesStore.getState().add({ ...baseInput, name: 'Persisted' })
    useRoutesStore.setState({ routes: [] })
    await useRoutesStore.getState().load()
    expect(useRoutesStore.getState().routes[0].name).toBe('Persisted')
  })

  it('update() advances updated_at and writes through', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const r = await useRoutesStore.getState().add(baseInput)

    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await useRoutesStore.getState().update(r.id, { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')
    expect(updated.created_at).toBe('2026-05-06T12:00:00.000Z')

    vi.useRealTimers()
  })

  it('remove() drops from storage and state', async () => {
    const r = await useRoutesStore.getState().add(baseInput)
    await useRoutesStore.getState().remove(r.id)
    expect(useRoutesStore.getState().routes).toEqual([])
  })

  it('captures storage errors without throwing from load', async () => {
    const broken = new InMemoryStorageProvider()
    // Override only the read path to fail; everything else is irrelevant for
    // this test.
    broken.getRoutes = async () => {
      throw new Error('boom')
    }
    setStorage(broken)

    await useRoutesStore.getState().load()
    expect(useRoutesStore.getState().error).toMatch(/boom/)
    expect(useRoutesStore.getState().loading).toBe(false)
  })
})

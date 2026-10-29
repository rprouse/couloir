import { useWaypointsStore } from './waypoints'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Waypoint } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  lat: 49.5,
  lng: -116.0,
  elevation_m: 1500,
  category: 'summit' as const,
  color: null,
  icon: null,
  tags: [],
} satisfies Omit<Waypoint, 'id' | 'created_at' | 'updated_at'>

describe('waypoints store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
  })

  afterEach(() => {
    clearStorage()
    vi.useRealTimers()
  })

  it('add() persists and round-trips through reload', async () => {
    const w = await useWaypointsStore.getState().add({ ...baseInput, name: 'Persisted' })
    useWaypointsStore.setState({ waypoints: [] })
    await useWaypointsStore.getState().load()
    expect(useWaypointsStore.getState().waypoints[0].id).toBe(w.id)
  })

  it('update() advances updated_at and merges patch', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const w = await useWaypointsStore.getState().add(baseInput)
    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await useWaypointsStore.getState().update(w.id, { lat: 49.6 })
    expect(updated.lat).toBe(49.6)
    expect(updated.lng).toBe(-116.0)
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')
    vi.useRealTimers()
  })

  it('remove() drops from state and storage', async () => {
    const w = await useWaypointsStore.getState().add(baseInput)
    await useWaypointsStore.getState().remove(w.id)
    expect(useWaypointsStore.getState().waypoints).toEqual([])
  })
})

import { useTagsStore } from './tags'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'

describe('tags store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useTagsStore.setState({ tags: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() generates id + created_at', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#FF0000' })
    expect(tag.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(tag.created_at).toBe('2026-05-06T12:00:00.000Z')
    vi.useRealTimers()
  })

  it('round-trips through load', async () => {
    await useTagsStore.getState().add({ name: 'Steep', color: '#FF0000' })
    useTagsStore.setState({ tags: [] })
    await useTagsStore.getState().load()
    expect(useTagsStore.getState().tags).toHaveLength(1)
  })

  it('remove() drops from state', async () => {
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#FF0000' })
    await useTagsStore.getState().remove(tag.id)
    expect(useTagsStore.getState().tags).toEqual([])
  })
})

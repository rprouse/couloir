import { usePhotosStore } from './photos'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'
import type { Photo } from '../types'

const baseInput = {
  user_id: 'local',
  name: 'Test',
  description: '',
  lat: 49.5,
  lng: -116.0,
  elevation_m: 1500,
  camera_lat: 49.499,
  camera_lng: -116.001,
  camera_elevation_m: 1495,
  bearing: 90,
  width: 1024,
  height: 768,
  file_size_bytes: 1024,
  taken_at: null,
  tags: [],
} satisfies Omit<Photo, 'id' | 'created_at' | 'updated_at' | 'blob_ref'>

describe('photos store', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    usePhotosStore.setState({ photos: [], loading: false, error: null })
  })

  afterEach(() => clearStorage())

  it('add() seeds blob_ref from the generated id', async () => {
    const blob = new Blob(['full'])
    const thumb = new Blob(['thumb'])
    const p = await usePhotosStore.getState().add(baseInput, blob, thumb)
    expect(p.blob_ref).toBe(`photos/${p.id}.jpg`)
  })

  it('update() advances updated_at without changing blob_ref', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    const p = await usePhotosStore.getState().add(
      baseInput, new Blob(['x']), new Blob(['y']),
    )

    vi.setSystemTime(new Date('2026-05-06T13:00:00.000Z'))
    const updated = await usePhotosStore.getState().update(p.id, { name: 'Renamed' })
    expect(updated.name).toBe('Renamed')
    expect(updated.blob_ref).toBe(p.blob_ref)
    expect(updated.updated_at).toBe('2026-05-06T13:00:00.000Z')

    vi.useRealTimers()
  })

  it('remove() drops the photo and its blobs', async () => {
    const p = await usePhotosStore.getState().add(
      baseInput, new Blob(['x']), new Blob(['y']),
    )
    await usePhotosStore.getState().remove(p.id)
    expect(usePhotosStore.getState().photos).toEqual([])
  })
})

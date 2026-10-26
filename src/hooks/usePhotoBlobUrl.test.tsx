import { renderHook, waitFor } from '@testing-library/react'
import { usePhotoBlobUrl } from './usePhotoBlobUrl'
import { InMemoryStorageProvider } from '../storage/memory'
import { setStorage, clearStorage } from '../storage/provider'

describe('usePhotoBlobUrl', () => {
  let storage: InMemoryStorageProvider
  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
  })
  afterEach(() => clearStorage())

  it('reports missing when no blob is stored', async () => {
    const { result } = renderHook(() => usePhotoBlobUrl('nope'))
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('missing'))
    expect(result.current.url).toBeNull()
  })

  it('resolves an object URL for a stored blob', async () => {
    vi.spyOn(storage, 'getPhotoBlob').mockResolvedValue(new Blob(['x']))
    const { result } = renderHook(() => usePhotoBlobUrl('p1'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.url).toMatch(/^blob:/)
  })
})

import { renderHook } from '@testing-library/react'
import { useObjectUrl } from './useObjectUrl'

describe('useObjectUrl', () => {
  it('mints a URL for the blob and revokes it on unmount', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    // Hoisted: a blob created inside the callback would change every render.
    const blob = new Blob(['x'])
    const { result, unmount } = renderHook(() => useObjectUrl(blob))
    const url = result.current
    expect(url).toMatch(/^blob:/)
    unmount()
    expect(revoke).toHaveBeenCalledWith(url)
    revoke.mockRestore()
  })

  it('returns null for a null blob', () => {
    expect(renderHook(() => useObjectUrl(null)).result.current).toBeNull()
  })
})

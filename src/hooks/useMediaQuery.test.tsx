import { renderHook } from '@testing-library/react'
import { MOBILE_QUERY, useMediaQuery } from './useMediaQuery'

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is false where matchMedia is unavailable (jsdom)', () => {
    expect(renderHook(() => useMediaQuery(MOBILE_QUERY)).result.current).toBe(false)
  })

  it('reflects matchMedia', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q === MOBILE_QUERY, media: q,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }))
    expect(renderHook(() => useMediaQuery(MOBILE_QUERY)).result.current).toBe(true)
  })
})

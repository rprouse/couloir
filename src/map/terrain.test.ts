import { queryElevation } from './terrain'

describe('queryElevation', () => {
  it('returns the DEM value when available', () => {
    const map = { queryTerrainElevation: vi.fn(() => 1834.4) }
    expect(queryElevation(map as never, 49.5, -115)).toBe(1834.4)
    expect(map.queryTerrainElevation).toHaveBeenCalledWith({ lng: -115, lat: 49.5 })
  })
  it('returns null when terrain is off or tiles are not loaded', () => {
    expect(queryElevation({ queryTerrainElevation: () => null } as never, 0, 0)).toBeNull()
    expect(queryElevation({} as never, 0, 0)).toBeNull()
  })
})

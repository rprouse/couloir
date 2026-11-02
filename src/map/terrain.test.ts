import { queryElevation } from './terrain'

describe('queryElevation', () => {
  it('returns the DEM value when available', () => {
    const map = { queryTerrainElevation: vi.fn(() => 1834.4) }
    expect(queryElevation(map as never, 49.5, -115)).toBe(1834.4)
    expect(map.queryTerrainElevation).toHaveBeenCalledWith({ lng: -115, lat: 49.5 })
  })

  it('adds back the map centre elevation MapLibre subtracts', () => {
    // A point near the centre reads close to 0 from queryTerrainElevation.
    const map = {
      queryTerrainElevation: () => 12,
      terrain: { exaggeration: 1 },
      transform: { elevation: 2100 },
    }
    expect(queryElevation(map as never, 49.5, -115)).toBe(2112)
  })

  it('removes the terrain exaggeration', () => {
    const map = {
      queryTerrainElevation: () => 300,
      terrain: { exaggeration: 1.5 },
      transform: { elevation: 3000 },
    }
    expect(queryElevation(map as never, 49.5, -115)).toBe(2200)
  })

  it('returns null when terrain is off or tiles are not loaded', () => {
    expect(queryElevation({ queryTerrainElevation: () => null } as never, 0, 0)).toBeNull()
    expect(queryElevation({} as never, 0, 0)).toBeNull()
    // An unloaded DEM tile reads 0 at the point, cancelling out the centre.
    const unloaded = {
      queryTerrainElevation: () => -2100,
      terrain: { exaggeration: 1 },
      transform: { elevation: 2100 },
    }
    expect(queryElevation(unloaded as never, 0, 0)).toBeNull()
  })
})

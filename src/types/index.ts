export type Basemap = 'satellite' | 'outdoor' | 'winter'

export const MAP_DEFAULTS = {
  center: [-116.0, 49.5] as [number, number],   // Fernie, BC
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  basemap: 'outdoor' as Basemap,
} as const

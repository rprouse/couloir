export type Basemap = 'satellite' | 'outdoor' | 'winter'

export const MAP_DEFAULTS = {
  center: [-116.0, 49.5] as [number, number],   // Fernie, BC
  zoom: 11,
  pitch: 45,
  bearing: 0,
  terrainExaggeration: 1.5,
  // Note: the default basemap lives in the UI store's initial state
  // (`activeBasemap: 'outdoor'`) so that hydration from localStorage and the
  // BasemapControl share a single source of truth. Don't reintroduce it here.
} as const

import { SYMBOL_PATHS } from './symbolPaths'

export type WaypointIconGroup = 'Travel' | 'Shelter' | 'Terrain' | 'Safety' | 'General'

// The icons a waypoint can use, in picker order. Keys are Material Symbol
// names; add one here and to NAMES in scripts/fetch-material-symbols.mjs,
// then re-run the script.
export const WAYPOINT_ICONS = [
  { key: 'downhill_skiing',       label: 'Skiing',        group: 'Travel' },
  { key: 'nordic_walking',        label: 'Ski touring',   group: 'Travel' },
  { key: 'snowshoeing',           label: 'Snowshoe',      group: 'Travel' },
  { key: 'sledding',              label: 'Sled',          group: 'Travel' },
  { key: 'hiking',                label: 'Hiking',        group: 'Travel' },
  { key: 'local_parking',         label: 'Parking',       group: 'Travel' },
  { key: 'directions_car',        label: 'Trailhead',     group: 'Travel' },
  { key: 'camping',               label: 'Camp',          group: 'Shelter' },
  { key: 'cabin',                 label: 'Cabin',         group: 'Shelter' },
  { key: 'cottage',               label: 'Hut',           group: 'Shelter' },
  { key: 'local_fire_department', label: 'Fire',          group: 'Shelter' },
  { key: 'water_drop',            label: 'Water',         group: 'Shelter' },
  { key: 'landscape',             label: 'Summit',        group: 'Terrain' },
  { key: 'flag',                  label: 'Flag',          group: 'Terrain' },
  { key: 'route',                 label: 'Skin track',    group: 'Terrain' },
  { key: 'fence',                 label: 'Gate',          group: 'Terrain' },
  { key: 'arrow_downward',        label: 'Rollover',      group: 'Terrain' },
  { key: 'landslide',             label: 'Cliff / slide', group: 'Terrain' },
  { key: 'snowing',               label: 'Snow',          group: 'Terrain' },
  { key: 'severe_cold',           label: 'Cold',          group: 'Terrain' },
  { key: 'warning',               label: 'Warning',       group: 'Safety' },
  { key: 'dangerous',             label: 'Danger',        group: 'Safety' },
  { key: 'emergency',             label: 'Emergency',     group: 'Safety' },
  { key: 'cell_tower',            label: 'Cell signal',   group: 'Safety' },
  { key: 'backpack',              label: 'Cache',         group: 'General' },
  { key: 'photo_camera',          label: 'Photo spot',    group: 'General' },
  { key: 'visibility',            label: 'Viewpoint',     group: 'General' },
  { key: 'star',                  label: 'Favourite',     group: 'General' },
  { key: 'location_on',           label: 'Pin',           group: 'General' },
] as const satisfies readonly {
  key: keyof typeof SYMBOL_PATHS
  label: string
  group: WaypointIconGroup
}[]

export type WaypointIcon = (typeof WAYPOINT_ICONS)[number]['key']

const ICON_LABELS: ReadonlyMap<string, string> = new Map(
  WAYPOINT_ICONS.map((i) => [i.key, i.label]),
)

export function isWaypointIcon(value: unknown): value is WaypointIcon {
  return typeof value === 'string' && ICON_LABELS.has(value)
}

export function iconPath(icon: WaypointIcon): string {
  return SYMBOL_PATHS[icon]
}

export function iconLabel(icon: WaypointIcon): string {
  return ICON_LABELS.get(icon) ?? icon
}

// Literal hex: painted into canvas pixels, where CSS custom properties can't
// reach. Chosen to read on both topo and satellite basemaps.
export const WAYPOINT_SWATCHES = [
  '#EF4444', '#F97316', '#FBBF24', '#22C55E', '#14B8A6',
  '#38BDF8', '#3B82F6', '#A78BFA', '#F472B6', '#334155',
] as const

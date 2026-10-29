import { SYMBOL_PATHS } from './symbolPaths'
import { WAYPOINT_CATEGORIES } from '../types'
import type { Waypoint } from '../types'

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

// The icon and colour a waypoint is drawn with: its own overrides, else its
// category's defaults. The colour is normalised to upper-case #RRGGBB.
export function resolveWaypointStyle(
  w: Pick<Waypoint, 'category' | 'icon' | 'color'>,
): { icon: WaypointIcon; color: string } {
  const category = WAYPOINT_CATEGORIES[w.category] ?? WAYPOINT_CATEGORIES.other
  return {
    icon: w.icon ?? category.icon,
    color: (w.color ?? category.color).toUpperCase(),
  }
}

// MapLibre image ids for waypoint markers, e.g. 'wp:cabin:22C55E'. The map
// draws each one on demand from its id (see WaypointsLayer).
const IMAGE_ID_RE = /^wp:([a-z_]+):([0-9A-F]{6})$/

export function waypointImageId(icon: WaypointIcon, color: string): string {
  return `wp:${icon}:${color.replace('#', '').toUpperCase()}`
}

export function parseWaypointImageId(id: string): { icon: WaypointIcon; color: string } | null {
  const match = IMAGE_ID_RE.exec(id)
  if (!match || !isWaypointIcon(match[1])) return null
  return { icon: match[1], color: `#${match[2]}` }
}

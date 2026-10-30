import { UI_ICONS } from './uiIcons'
import {
  WAYPOINT_ICONS,
  WAYPOINT_SWATCHES,
  iconLabel,
  iconPath,
  isWaypointIcon,
  parseWaypointImageId,
  resolveWaypointStyle,
  waypointImageId,
} from './waypointIcons'
import { SYMBOL_PATHS } from './symbolPaths'
import { WAYPOINT_CATEGORIES } from '../types'
import { isValidHex } from '../utils/format'

const GROUPS = ['Travel', 'Shelter', 'Terrain', 'Safety', 'General']

describe('WAYPOINT_ICONS', () => {
  it('has path data for every icon', () => {
    for (const { key } of WAYPOINT_ICONS) {
      expect(iconPath(key).length).toBeGreaterThan(0)
    }
  })

  it('uses every vendored symbol (no orphans)', () => {
    const keys = new Set<string>([...WAYPOINT_ICONS.map((i) => i.key), ...UI_ICONS])
    for (const name of Object.keys(SYMBOL_PATHS)) {
      expect(keys.has(name)).toBe(true)
    }
  })

  it('has unique keys in known groups', () => {
    const keys = WAYPOINT_ICONS.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const { group } of WAYPOINT_ICONS) {
      expect(GROUPS).toContain(group)
    }
  })

  it('labels icons from the catalogue', () => {
    expect(iconLabel('local_parking')).toBe('Parking')
  })
})

describe('isWaypointIcon', () => {
  it('accepts catalogue keys only', () => {
    expect(isWaypointIcon('cabin')).toBe(true)
    expect(isWaypointIcon('nope')).toBe(false)
    expect(isWaypointIcon(null)).toBe(false)
    expect(isWaypointIcon(3)).toBe(false)
  })
})

describe('category icons', () => {
  it('maps every category to a catalogue icon', () => {
    for (const { icon } of Object.values(WAYPOINT_CATEGORIES)) {
      expect(isWaypointIcon(icon)).toBe(true)
    }
  })
})

describe('WAYPOINT_SWATCHES', () => {
  it('are unique #RRGGBB hexes', () => {
    expect(new Set(WAYPOINT_SWATCHES).size).toBe(WAYPOINT_SWATCHES.length)
    for (const hex of WAYPOINT_SWATCHES) {
      expect(isValidHex(hex)).toBe(true)
    }
  })
})

describe('resolveWaypointStyle', () => {
  it('falls back to the category icon and colour', () => {
    expect(resolveWaypointStyle({ category: 'summit', icon: null, color: null }))
      .toEqual({ icon: 'landscape', color: '#FBBF24' })
  })

  it('prefers the overrides and upper-cases the hex', () => {
    expect(resolveWaypointStyle({ category: 'summit', icon: 'cabin', color: '#ef4444' }))
      .toEqual({ icon: 'cabin', color: '#EF4444' })
  })
})

describe('waypoint image ids', () => {
  it('encodes icon and colour', () => {
    expect(waypointImageId('cabin', '#22c55e')).toBe('wp:cabin:22C55E')
  })

  it('round-trips every catalogue icon', () => {
    for (const { key } of WAYPOINT_ICONS) {
      expect(parseWaypointImageId(waypointImageId(key, '#14B8A6')))
        .toEqual({ icon: key, color: '#14B8A6' })
    }
  })

  it('ignores ids it did not make', () => {
    for (const id of ['photo-placeholder', 'wp-summit', 'wp:nope:FFFFFF', 'wp:cabin:XYZ', 'wp:cabin:22C55E0']) {
      expect(parseWaypointImageId(id)).toBeNull()
    }
  })
})

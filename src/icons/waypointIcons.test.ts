import {
  WAYPOINT_ICONS,
  WAYPOINT_SWATCHES,
  iconLabel,
  iconPath,
  isWaypointIcon,
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
    const keys = new Set<string>(WAYPOINT_ICONS.map((i) => i.key))
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

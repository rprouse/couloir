import {
  haversineMeters,
  lineDistanceMeters,
  elevationGainLoss,
  cumulativeDistanceMeters,
  normalizeBearing,
  bearingFromVector,
  type ProfilePoint,
} from './geo'
import type { LineStringZ } from '../types'

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(49.5, -116, 49.5, -116)).toBeCloseTo(0, 6)
  })

  it('returns ~111 km for one degree of latitude at the equator', () => {
    const m = haversineMeters(0, 0, 1, 0)
    expect(m).toBeGreaterThan(110_000)
    expect(m).toBeLessThan(112_000)
  })

  it('is symmetric', () => {
    const a = haversineMeters(49.5, -116, 49.6, -115.9)
    const b = haversineMeters(49.6, -115.9, 49.5, -116)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('lineDistanceMeters', () => {
  it('returns 0 for a single-point line', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [[-116, 49.5, 1500]] }
    expect(lineDistanceMeters(ls)).toBe(0)
  })

  it('sums consecutive haversine segments', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1510],
        [-116, 49.502, 1520],
      ],
    }
    const a = haversineMeters(49.5, -116, 49.501, -116)
    const b = haversineMeters(49.501, -116, 49.502, -116)
    expect(lineDistanceMeters(ls)).toBeCloseTo(a + b, 6)
  })
})

describe('elevationGainLoss', () => {
  it('returns 0/0 for a flat line', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1500],
      ],
    }
    expect(elevationGainLoss(ls)).toEqual({ gain: 0, loss: 0 })
  })

  it('sums positive deltas as gain and negative deltas as loss', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1000],
        [-116, 49.501, 1100], // +100 gain
        [-116, 49.502, 1050], // -50 loss
        [-116, 49.503, 1080], // +30 gain
      ],
    }
    expect(elevationGainLoss(ls)).toEqual({ gain: 130, loss: 50 })
  })

  it('returns 0/0 for a one-point line', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [[-116, 49.5, 1500]] }
    expect(elevationGainLoss(ls)).toEqual({ gain: 0, loss: 0 })
  })
})

describe('cumulativeDistanceMeters', () => {
  it('returns an empty array for an empty line', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [] }
    expect(cumulativeDistanceMeters(ls)).toEqual([])
  })

  it('returns a [0, d1, d1+d2, ...] series matching coordinate count', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1510],
        [-116, 49.502, 1520],
      ],
    }
    const series = cumulativeDistanceMeters(ls)
    expect(series).toHaveLength(3)
    expect(series[0]).toBe(0)
    expect(series[1]).toBeGreaterThan(0)
    expect(series[2]).toBeGreaterThan(series[1])
  })

  it('produces a profile point per coordinate when zipped with elevation', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1510],
      ],
    }
    const distances = cumulativeDistanceMeters(ls)
    const profile: ProfilePoint[] = distances.map((d, i) => ({
      distance_m: d,
      elevation_m: ls.coordinates[i][2],
    }))
    expect(profile).toEqual([
      { distance_m: 0, elevation_m: 1500 },
      { distance_m: distances[1], elevation_m: 1510 },
    ])
  })
})

describe('normalizeBearing', () => {
  it.each([
    [0, 0], [90, 90], [359.4, 359], [359.6, 0], [360, 0], [725, 5], [-90, 270],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBearing(input)).toBe(expected)
  })
})

describe('bearingFromVector', () => {
  it.each([
    [0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270], [1, -1, 45],
  ])('(%s, %s) → %s°', (dx, dy, expected) => {
    expect(bearingFromVector(dx, dy)).toBe(expected)
  })
})

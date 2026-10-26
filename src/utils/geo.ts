import type { LineStringZ } from '../types'

const EARTH_RADIUS_M = 6_371_000

// Great-circle distance between two lat/lng pairs (degrees) in metres.
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Total polyline length (metres) by summing inter-point haversine distances.
// 0 for a 0- or 1-point line.
export function lineDistanceMeters(line: LineStringZ): number {
  let total = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    const [lng1, lat1] = line.coordinates[i - 1]
    const [lng2, lat2] = line.coordinates[i]
    total += haversineMeters(lat1, lng1, lat2, lng2)
  }
  return total
}

// Cumulative distance series — distance from the first point to each point
// in turn. Same length as coordinates; first entry is always 0.
export function cumulativeDistanceMeters(line: LineStringZ): number[] {
  const out: number[] = new Array(line.coordinates.length)
  if (out.length === 0) return out
  out[0] = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    const [lng1, lat1] = line.coordinates[i - 1]
    const [lng2, lat2] = line.coordinates[i]
    out[i] = out[i - 1] + haversineMeters(lat1, lng1, lat2, lng2)
  }
  return out
}

// Sum positive elevation deltas as gain, negative deltas as loss (absolute).
export function elevationGainLoss(line: LineStringZ): { gain: number; loss: number } {
  let gain = 0
  let loss = 0
  for (let i = 1; i < line.coordinates.length; i++) {
    const dz = line.coordinates[i][2] - line.coordinates[i - 1][2]
    if (dz > 0) gain += dz
    else if (dz < 0) loss += -dz
  }
  return { gain, loss }
}

export interface ProfilePoint {
  distance_m: number
  elevation_m: number
}

// Wraps any finite angle into the integer compass range 0-359.
export function normalizeBearing(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360
}

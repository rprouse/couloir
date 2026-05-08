import type { LineStringZ } from '../types'
import { MOVING_SPEED_THRESHOLD_M_S } from '../types'
import {
  haversineMeters,
  lineDistanceMeters,
  elevationGainLoss,
} from './geo'

export interface ParsedRoute {
  kind: 'route'
  name: string
  description: string
  geojson: LineStringZ
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  source_filename: string
}

export interface ParsedTrack {
  kind: 'track'
  name: string
  description: string
  geojson: LineStringZ
  distance_m: number
  elevation_gain_m: number
  elevation_loss_m: number
  duration_s: number | null
  moving_time_s: number | null
  recorded_at: string | null
  source_filename: string
}

export type ParsedGpx = ParsedRoute | ParsedTrack

// Parse a GPX XML document into a normalized object suitable for storage.
// The raw GPX is not retained.
export function parseGpx(xml: string, sourceFilename: string): ParsedGpx {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  // DOMParser reports parse errors as a <parsererror> element rather than
  // throwing. Detect that and surface a clear error.
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`GPX parse error: ${parseError.textContent ?? 'unknown'}`)
  }

  // Prefer the first <rte> if present; otherwise take the first <trk>.
  // GPX files containing both are rare; the route side wins by convention.
  const route = doc.querySelector('rte')
  if (route) return parseRouteElement(route, sourceFilename)

  const track = doc.querySelector('trk')
  if (track) return parseTrackElement(track, sourceFilename)

  throw new Error('GPX contains no route or track')
}

function parseRouteElement(rte: Element, sourceFilename: string): ParsedRoute {
  const points = Array.from(rte.querySelectorAll('rtept'))
  const coordinates: LineStringZ['coordinates'] = points.map((pt) => [
    Number(pt.getAttribute('lon')),
    Number(pt.getAttribute('lat')),
    elevationOf(pt),
  ])
  const geojson: LineStringZ = { type: 'LineString', coordinates }
  const { gain, loss } = elevationGainLoss(geojson)
  return {
    kind: 'route',
    name: textOf(rte, 'name') ?? deriveNameFromFilename(sourceFilename),
    description: textOf(rte, 'desc') ?? '',
    geojson,
    distance_m: lineDistanceMeters(geojson),
    elevation_gain_m: gain,
    elevation_loss_m: loss,
    source_filename: sourceFilename,
  }
}

function parseTrackElement(trk: Element, sourceFilename: string): ParsedTrack {
  // Concatenate trackpoints from all <trkseg> elements. We do not preserve
  // segment boundaries in the geometry — DATA-MODEL.md says trackpoints are
  // joined into a single LineString.
  const segments = Array.from(trk.querySelectorAll('trkseg'))
  const allPoints: Element[] = []
  for (const seg of segments) {
    allPoints.push(...Array.from(seg.querySelectorAll('trkpt')))
  }

  const coordinates: LineStringZ['coordinates'] = allPoints.map((pt) => [
    Number(pt.getAttribute('lon')),
    Number(pt.getAttribute('lat')),
    elevationOf(pt),
  ])
  const geojson: LineStringZ = { type: 'LineString', coordinates }

  const timestamps = allPoints.map(timestampOf)
  const haveAnyTimestamp = timestamps.some((t) => t !== null)
  const haveAllTimestamps = timestamps.every((t) => t !== null)

  let duration_s: number | null = null
  let moving_time_s: number | null = null
  let recorded_at: string | null = null

  if (haveAnyTimestamp && haveAllTimestamps && timestamps.length >= 2) {
    const first = timestamps[0] as Date
    const last = timestamps[timestamps.length - 1] as Date
    duration_s = Math.round((last.getTime() - first.getTime()) / 1000)
    recorded_at = first.toISOString()

    let moving = 0
    for (let i = 1; i < allPoints.length; i++) {
      const t1 = timestamps[i - 1] as Date
      const t2 = timestamps[i] as Date
      const dt = (t2.getTime() - t1.getTime()) / 1000
      if (dt <= 0) continue
      const [lng1, lat1] = coordinates[i - 1]
      const [lng2, lat2] = coordinates[i]
      const dist = haversineMeters(lat1, lng1, lat2, lng2)
      const speed = dist / dt
      if (speed >= MOVING_SPEED_THRESHOLD_M_S) moving += dt
    }
    moving_time_s = Math.round(moving)
  } else if (haveAnyTimestamp && timestamps[0] !== null) {
    // Mixed: some points have <time>, others don't. Record the first
    // timestamp but treat duration/moving as unknown rather than guess.
    recorded_at = (timestamps[0] as Date).toISOString()
  }

  const { gain, loss } = elevationGainLoss(geojson)
  return {
    kind: 'track',
    name: textOf(trk, 'name') ?? deriveNameFromFilename(sourceFilename),
    description: textOf(trk, 'desc') ?? '',
    geojson,
    distance_m: lineDistanceMeters(geojson),
    elevation_gain_m: gain,
    elevation_loss_m: loss,
    duration_s,
    moving_time_s,
    recorded_at,
    source_filename: sourceFilename,
  }
}

// `<name>` and `<desc>` are *direct* children of <rte>/<trk>. We don't use
// querySelector('name') because it would also match nested tag names inside
// extension elements; iterate direct children instead.
function textOf(parent: Element, tag: string): string | null {
  for (const child of Array.from(parent.children)) {
    if (child.tagName === tag) {
      const txt = child.textContent?.trim() ?? ''
      return txt.length > 0 ? txt : null
    }
  }
  return null
}

function elevationOf(point: Element): number {
  const ele = textOf(point, 'ele')
  if (ele === null) return 0
  const n = Number(ele)
  return Number.isFinite(n) ? n : 0
}

function timestampOf(point: Element): Date | null {
  const t = textOf(point, 'time')
  if (t === null) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

function deriveNameFromFilename(filename: string): string {
  // Strip extension and any leading path; treat as the user's name fallback.
  const base = filename.replace(/^.*[\\/]/, '')
  return base.replace(/\.gpx$/i, '') || 'Untitled'
}

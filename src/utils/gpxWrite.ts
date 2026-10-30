import type { LineStringZ, Route, Track, Waypoint } from '../types'

// Writes routes, tracks and waypoints back out as GPX 1.1, the format they
// were imported from: a route as <rte>, a track as one <trkseg>, a waypoint as
// <wpt>. Track point times aren't stored, so exported tracks carry none.

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function document(body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Couloir" xmlns="http://www.topografix.com/GPX/1/1">',
    body,
    '</gpx>',
    '',
  ].join('\n')
}

function nameAndDesc(name: string, description: string, indent: string): string[] {
  const lines = [`${indent}<name>${escapeXml(name)}</name>`]
  if (description) lines.push(`${indent}<desc>${escapeXml(description)}</desc>`)
  return lines
}

function points(tag: 'rtept' | 'trkpt', line: LineStringZ, indent: string): string[] {
  return line.coordinates.map(
    ([lng, lat, ele]) => `${indent}<${tag} lat="${lat}" lon="${lng}"><ele>${ele}</ele></${tag}>`,
  )
}

export function routeToGpx(route: Route): string {
  return document([
    '  <rte>',
    ...nameAndDesc(route.name, route.description, '    '),
    ...points('rtept', route.geojson, '    '),
    '  </rte>',
  ].join('\n'))
}

export function trackToGpx(track: Track): string {
  return document([
    '  <trk>',
    ...nameAndDesc(track.name, track.description, '    '),
    '    <trkseg>',
    ...points('trkpt', track.geojson, '      '),
    '    </trkseg>',
    '  </trk>',
  ].join('\n'))
}

export function waypointToGpx(wp: Waypoint): string {
  return document([
    `  <wpt lat="${wp.lat}" lon="${wp.lng}">`,
    ...(wp.elevation_m === null ? [] : [`    <ele>${wp.elevation_m}</ele>`]),
    ...nameAndDesc(wp.name, wp.description, '    '),
    `    <type>${escapeXml(wp.category)}</type>`,
    '  </wpt>',
  ].join('\n'))
}

// "Polar Peak / NE face" → "Polar-Peak-NE-face.gpx". Falls back to the
// fallback name when nothing usable is left.
export function gpxFilename(name: string, fallback: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || fallback}.gpx`
}

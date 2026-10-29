import { strFromU8, unzipSync } from 'fflate'
import type {
  AtesClass,
  AtesFeature,
  AtesLineString,
  AtesPoint,
  AtesPolygon,
  LngLat,
} from '../types'

// Reader for the ATES KMZ files Avalanche Canada's Trip Planner offers per
// area ("Download ATES data as KMZ"). Their KML has a fixed shape: shared
// <Style>s, and placemarks whose styleUrl says what they are. See
// docs/superpowers/plans/2026-10-29-couloir-phase-12-ates-terrain.md.

export class AtesImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AtesImportError'
  }
}

export interface ParsedAtes {
  name: string
  features: AtesFeature[]
  skipped: number   // zones/lines whose ATES class couldn't be determined
}

/** The text of the KML inside a KMZ (doc.kml by convention, else the first .kml). */
export function readKmz(bytes: Uint8Array): string {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes, { filter: (f) => f.name.toLowerCase().endsWith('.kml') })
  } catch {
    throw new AtesImportError('This file is not a KMZ (it is not a ZIP archive).')
  }
  const names = Object.keys(entries)
  const name = names.find((n) => n.toLowerCase() === 'doc.kml') ?? names[0]
  if (name === undefined) throw new AtesImportError('This KMZ contains no KML file.')
  return strFromU8(entries[name])
}

const COLOUR_CLASS: Record<string, AtesClass> = {
  green: 'simple',
  blue: 'challenging',
  black: 'complex',
}
const NUMBER_CLASS: Record<string, AtesClass> = {
  '0': 'non_avalanche',
  '1': 'simple',
  '2': 'challenging',
  '3': 'complex',
  '4': 'extreme',
}

export function parseAtesKml(xml: string, sourceFilename: string): ParsedAtes {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'kml') {
    throw new AtesImportError('This file is not a KML file Couloir can read.')
  }

  const document = childrenNamed(doc.documentElement, 'Document')[0] ?? doc.documentElement
  const name = textOf(document, 'name') ?? nameFromFilename(sourceFilename)

  const features: AtesFeature[] = []
  let skipped = 0
  for (const placemark of Array.from(doc.getElementsByTagNameNS('*', 'Placemark'))) {
    const style = (textOf(placemark, 'styleUrl') ?? '').replace(/^#/, '')
    const kind = kindOf(style, placemark)
    if (kind === null) continue

    const placemarkName = textOf(placemark, 'name') ?? ''
    const description = textOf(placemark, 'description') ?? ''

    if (kind === 'zone' || kind === 'ates_line') {
      const ates = classOf(style, placemark)
      if (ates === null) {
        skipped++
        continue
      }
      if (kind === 'zone') {
        for (const geometry of polygonsIn(placemark)) {
          features.push({ type: 'Feature', geometry, properties: { kind, ates, description } })
        }
      } else {
        for (const geometry of lineStringsIn(placemark)) {
          features.push({ type: 'Feature', geometry, properties: { kind, ates, name: placemarkName } })
        }
      }
    } else if (kind === 'area') {
      for (const geometry of polygonsIn(placemark)) {
        features.push({ type: 'Feature', geometry, properties: { kind } })
      }
    } else if (kind === 'avalanche_path') {
      for (const geometry of lineStringsIn(placemark)) {
        features.push({ type: 'Feature', geometry, properties: { kind, name: placemarkName } })
      }
    } else {
      for (const geometry of pointsIn(placemark)) {
        features.push({
          type: 'Feature', geometry, properties: { kind, name: placemarkName, description },
        })
      }
    }
  }

  if (!features.some((f) => f.properties.kind === 'zone')) {
    throw new AtesImportError(`${name} has no ATES zones. Is this an Avalanche Canada ATES file?`)
  }
  return { name, features, skipped }
}

// What a placemark is, from its style id. Points of interest, access routes and
// anything unrecognised return null and are dropped. A polygon with an unknown
// style still counts as a zone when it sits under the Zones / "Class N" folders.
function kindOf(style: string, placemark: Element): AtesFeature['properties']['kind'] | null {
  if (style === 'area_styles') return 'area'
  if (style === 'avalanche_path_styles') return 'avalanche_path'
  if (style === 'decision_point_styles') return 'decision_point'
  if (style.startsWith('ates_line_')) return 'ates_line'
  if (style.startsWith('zone_')) return 'zone'
  const inZones = folderNames(placemark).some((n) => /^zones$/i.test(n) || /class\s*\d/i.test(n))
  if (inZones && polygonsIn(placemark).length > 0) return 'zone'
  return null
}

function classOf(style: string, placemark: Element): AtesClass | null {
  const byStyle = /^(?:zone|ates_line)_([a-z]+)_style$/.exec(style)
  if (byStyle && COLOUR_CLASS[byStyle[1]]) return COLOUR_CLASS[byStyle[1]]
  for (const folder of folderNames(placemark)) {
    const byFolder = /class\s*(\d)/i.exec(folder)
    if (byFolder && NUMBER_CLASS[byFolder[1]]) return NUMBER_CLASS[byFolder[1]]
  }
  return null
}

// Names of the enclosing <Folder>s, nearest first.
function folderNames(el: Element): string[] {
  const names: string[] = []
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.localName === 'Folder') {
      const n = textOf(p, 'name')
      if (n) names.push(n)
    }
  }
  return names
}

// Geometry readers. getElementsByTagNameNS finds geometries nested in
// <MultiGeometry> too, so a multi-part placemark becomes several features.

function polygonsIn(placemark: Element): AtesPolygon[] {
  return descendants(placemark, 'Polygon').flatMap((polygon) => {
    const outer = descendants(polygon, 'outerBoundaryIs').flatMap(ringsIn)
    if (outer.length === 0) return []
    const holes = descendants(polygon, 'innerBoundaryIs').flatMap(ringsIn)
    return [{ type: 'Polygon' as const, coordinates: [outer[0], ...holes] }]
  })
}

function ringsIn(boundary: Element): LngLat[][] {
  return descendants(boundary, 'coordinates')
    .map((c) => parseCoordinates(c.textContent ?? ''))
    .filter((ring) => ring.length >= 4)
}

function lineStringsIn(placemark: Element): AtesLineString[] {
  return descendants(placemark, 'LineString')
    .map((line) => parseCoordinates(textOf(line, 'coordinates') ?? ''))
    .filter((coordinates) => coordinates.length >= 2)
    .map((coordinates) => ({ type: 'LineString' as const, coordinates }))
}

function pointsIn(placemark: Element): AtesPoint[] {
  return descendants(placemark, 'Point')
    .map((point) => parseCoordinates(textOf(point, 'coordinates') ?? ''))
    .filter((coordinates) => coordinates.length === 1)
    .map((coordinates) => ({ type: 'Point' as const, coordinates: coordinates[0] }))
}

// KML coordinates: whitespace-separated `lng,lat[,alt]` tuples. Altitude is
// dropped; malformed tuples are skipped.
function parseCoordinates(text: string): LngLat[] {
  const out: LngLat[] = []
  for (const tuple of text.trim().split(/\s+/)) {
    const [lng, lat] = tuple.split(',').map(Number)
    if (Number.isFinite(lng) && Number.isFinite(lat)) out.push([lng, lat])
  }
  return out
}

function descendants(el: Element, localName: string): Element[] {
  return Array.from(el.getElementsByTagNameNS('*', localName))
}

function childrenNamed(el: Element, localName: string): Element[] {
  return Array.from(el.children).filter((c) => c.localName === localName)
}

// Text of a direct child, matched on localName so namespace prefixes don't matter.
function textOf(parent: Element, localName: string): string | null {
  const child = childrenNamed(parent, localName)[0]
  const text = child?.textContent?.trim() ?? ''
  return text.length > 0 ? text : null
}

function nameFromFilename(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '')
  return base.replace(/\.km[lz]$/i, '') || 'Untitled area'
}

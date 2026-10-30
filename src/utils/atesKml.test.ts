import { strToU8, zipSync } from 'fflate'
import type { AtesFeature } from '../types'
import { AtesImportError, parseAtesKml, readKmz } from './atesKml'
import { ATES_FIXTURE_KML, square } from './atesKml.fixture'

function ofKind<K extends AtesFeature['properties']['kind']>(
  features: AtesFeature[],
  kind: K,
): Extract<AtesFeature, { properties: { kind: K } }>[] {
  return features.filter((f) => f.properties.kind === kind) as Extract<
    AtesFeature,
    { properties: { kind: K } }
  >[]
}

describe('parseAtesKml', () => {
  const parsed = parseAtesKml(ATES_FIXTURE_KML, 'Fixture Basin.kmz')

  it('takes the area name from the Document', () => {
    expect(parsed.name).toBe('Fixture Basin')
  })

  it('keeps one area boundary', () => {
    const areas = ofKind(parsed.features, 'area')
    expect(areas).toHaveLength(1)
    expect(areas[0].geometry.type).toBe('Polygon')
  })

  it('classifies zones from styleUrl, falling back to the folder name', () => {
    const zones = ofKind(parsed.features, 'zone')
    const counts = zones.reduce<Record<string, number>>((acc, z) => {
      acc[z.properties.ates] = (acc[z.properties.ates] ?? 0) + 1
      return acc
    }, {})
    // MultiGeometry with two polygons becomes two challenging zones.
    expect(counts).toEqual({ simple: 2, challenging: 3, complex: 1, extreme: 1 })
  })

  it('skips zones it cannot classify and counts them', () => {
    expect(parsed.skipped).toBe(1)
  })

  it('keeps the zone description', () => {
    const complex = ofKind(parsed.features, 'zone').find((z) => z.properties.ates === 'complex')
    expect(complex?.properties.description).toBe('Complex terrain definition.')
  })

  it('keeps polygon holes as extra rings', () => {
    const holed = ofKind(parsed.features, 'zone').find((z) => z.geometry.coordinates.length === 2)
    expect(holed).toBeDefined()
    expect(holed?.properties.ates).toBe('simple')
    expect(holed?.geometry.coordinates[1]).toHaveLength(5)
  })

  it('parses coordinates as [lng, lat] numbers', () => {
    const simple = ofKind(parsed.features, 'zone')[0]
    expect(simple.geometry.coordinates[0][0]).toEqual([-115.07, 49.34])
  })

  it('keeps ATES lines with their class, tolerating newlines between tuples', () => {
    const lines = ofKind(parsed.features, 'ates_line')
    expect(lines).toHaveLength(1)
    expect(lines[0].properties).toEqual({
      kind: 'ates_line', ates: 'challenging', name: 'Fixture Couloir',
    })
    expect(lines[0].geometry.coordinates).toEqual([[-115.061, 49.341], [-115.062, 49.342]])
  })

  it('keeps avalanche paths and decision points, dropping altitude', () => {
    expect(ofKind(parsed.features, 'avalanche_path')[0].properties.name).toBe('Big Slide')
    const dp = ofKind(parsed.features, 'decision_point')[0]
    expect(dp.properties).toEqual({
      kind: 'decision_point',
      name: 'Col Decision',
      description: 'Assess the slope before committing.',
    })
    expect(dp.geometry.coordinates).toEqual([-115.066, 49.346])
  })

  it('keeps access routes and points of interest with their type', () => {
    const access = ofKind(parsed.features, 'access_route')
    expect(access).toHaveLength(1)
    expect(access[0].properties.name).toBe('Fixture Access')
    expect(access[0].geometry.coordinates).toEqual([[-115.07, 49.34], [-115.06, 49.35]])
    const pois = ofKind(parsed.features, 'poi')
    expect(pois.map((p) => p.properties)).toEqual([
      { kind: 'poi', poi: 'parking', name: 'Parking', description: '' },
    ])
    expect(pois[0].geometry.coordinates).toEqual([-115.07, 49.34])
  })

  it('maps unknown point-of-interest styles to other', () => {
    const kml = ATES_FIXTURE_KML.replace('point_of_interest_parking_styles</styleUrl>', 'point_of_interest_summit_styles</styleUrl>')
    expect(ofKind(parseAtesKml(kml, 'x.kmz').features, 'poi')[0].properties.poi).toBe('other')
  })

  it('keeps every kind it recognises', () => {
    expect(parsed.features).toHaveLength(1 + 7 + 1 + 1 + 1 + 1 + 1)
  })

  it('falls back to the filename when the Document has no name', () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
      <Placemark><styleUrl>#zone_green_style</styleUrl>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${square(-115, 49)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark></Document></kml>`
    expect(parseAtesKml(kml, 'C:\\dl\\Some Area.kmz').name).toBe('Some Area')
  })

  it('rejects malformed XML', () => {
    expect(() => parseAtesKml('<kml><Document>', 'x.kmz')).toThrow(AtesImportError)
    expect(() => parseAtesKml('<kml><Document>', 'x.kmz')).toThrow(/not a KML file/)
  })

  it('rejects a KML with no ATES zones', () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Empty</name></Document></kml>`
    expect(() => parseAtesKml(kml, 'x.kmz')).toThrow(/no ATES zones/)
  })
})

describe('readKmz', () => {
  it('returns the text of the KML inside the archive', () => {
    const bytes = zipSync({
      'doc.kml': strToU8(ATES_FIXTURE_KML),
      'icons/dot.png': new Uint8Array([1, 2, 3]),
    })
    expect(readKmz(bytes)).toBe(ATES_FIXTURE_KML)
  })

  it('rejects an archive without a KML', () => {
    const bytes = zipSync({ 'readme.txt': strToU8('hi') })
    expect(() => readKmz(bytes)).toThrow(AtesImportError)
  })

  it('rejects bytes that are not a ZIP', () => {
    expect(() => readKmz(strToU8('not a zip'))).toThrow(AtesImportError)
  })
})

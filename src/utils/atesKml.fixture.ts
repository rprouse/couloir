// Synthetic test fixture shaped like an Avalanche Canada ATES KMZ's doc.kml
// (same styles, folders and placemark layout; made-up squares near Fernie).
// No Avalanche Canada data is committed to this repo.

// A closed square ring at (lng, lat) with side `d` degrees.
export function square(lng: number, lat: number, d = 0.001): string {
  return [
    [lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat],
  ].map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`).join(' ')
}

function polygon(outer: string, ...holes: string[]): string {
  return `<Polygon>
    <outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs>
    ${holes.map((h) => `<innerBoundaryIs><LinearRing><coordinates>${h}</coordinates></LinearRing></innerBoundaryIs>`).join('\n')}
  </Polygon>`
}

function zone(name: string, style: string, geometry: string): string {
  return `<Placemark>
    <name>${name}</name>
    <description>${name} terrain definition.</description>
    <styleUrl>#${style}</styleUrl>
    ${geometry}
  </Placemark>`
}

const STYLE_IDS = [
  'zone_green_style', 'zone_blue_style', 'zone_black_style',
  'ates_line_green_style', 'ates_line_blue_style', 'ates_line_black_style',
  'area_styles', 'access_road_styles', 'avalanche_path_styles', 'decision_point_styles',
  'point_of_interest_cabin_styles', 'point_of_interest_parking_styles',
  'point_of_interest_destination_styles', 'point_of_interest_other_styles',
]

export const ATES_FIXTURE_KML = `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>Fixture Basin</name>
    ${STYLE_IDS.map((id) => `<Style id="${id}"><LineStyle><width>1</width></LineStyle></Style>`).join('\n')}
    <Folder>
      <name>Fixture Basin</name>
      <Placemark>
        <name>Fixture Basin</name>
        <styleUrl>#area_styles</styleUrl>
        ${polygon(square(-115.08, 49.33, 0.03))}
      </Placemark>
      <Folder>
        <name>Points of Interest</name>
        <Placemark>
          <name>Parking</name>
          <styleUrl>#point_of_interest_parking_styles</styleUrl>
          <Point><coordinates>-115.070000,49.340000</coordinates></Point>
        </Placemark>
      </Folder>
      <Folder>
        <name>Access Routes</name>
        <Placemark>
          <name>Fixture Access</name>
          <styleUrl>#access_road_styles</styleUrl>
          <LineString><coordinates>-115.07,49.34 -115.06,49.35</coordinates></LineString>
        </Placemark>
      </Folder>
      <Folder>
        <name>Avalanche Paths</name>
        <Placemark>
          <name>Big Slide</name>
          <styleUrl>#avalanche_path_styles</styleUrl>
          <LineString><coordinates>-115.065,49.345 -115.064,49.344</coordinates></LineString>
        </Placemark>
      </Folder>
      <Folder>
        <name>Decision Points</name>
        <Placemark>
          <name>Col Decision</name>
          <description>Assess the slope before committing.</description>
          <styleUrl>#decision_point_styles</styleUrl>
          <Point><coordinates>-115.066000,49.346000,0</coordinates></Point>
        </Placemark>
      </Folder>
      <Folder>
        <name>ATES Lines</name>
        <Placemark>
          <name>Fixture Couloir</name>
          <styleUrl>#ates_line_blue_style</styleUrl>
          <LineString><coordinates>-115.061,49.341
            -115.062,49.342</coordinates></LineString>
        </Placemark>
      </Folder>
      <Folder>
        <name>Zones</name>
        <Folder>
          <name>Class 1 – Simple</name>
          ${zone('Simple', 'zone_green_style', polygon(square(-115.07, 49.34)))}
          ${zone('Simple', 'zone_green_style', polygon(square(-115.075, 49.34, 0.004), square(-115.074, 49.341)))}
        </Folder>
        <Folder>
          <name>Class 2 – Challenging</name>
          ${zone('Challenging', 'zone_blue_style', polygon(square(-115.06, 49.34)))}
          ${zone('Challenging', 'zone_blue_style', `<MultiGeometry>${polygon(square(-115.06, 49.35))}${polygon(square(-115.058, 49.35))}</MultiGeometry>`)}
        </Folder>
        <Folder>
          <name>Class 3 – Complex</name>
          ${zone('Complex', 'zone_black_style', polygon(square(-115.05, 49.34)))}
        </Folder>
        <Folder>
          <name>Class 4 – Extreme</name>
          ${zone('Extreme', 'zone_red_style', polygon(square(-115.04, 49.34)))}
        </Folder>
        <Folder>
          <name>Unrated</name>
          ${zone('Mystery', 'zone_purple_style', polygon(square(-115.03, 49.34)))}
        </Folder>
      </Folder>
    </Folder>
  </Document>
</kml>`

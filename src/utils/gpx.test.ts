import { parseGpx } from './gpx'

const ROUTE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>Test Route</name>
    <desc>A test route</desc>
    <rtept lat="49.500" lon="-116.000"><ele>1500</ele></rtept>
    <rtept lat="49.501" lon="-116.000"><ele>1600</ele></rtept>
    <rtept lat="49.502" lon="-116.000"><ele>1550</ele></rtept>
  </rte>
</gpx>`

const TRACK_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Test Track</name>
    <desc>A recorded tour</desc>
    <trkseg>
      <trkpt lat="49.500" lon="-116.000">
        <ele>1500</ele>
        <time>2026-04-01T08:00:00Z</time>
      </trkpt>
      <trkpt lat="49.501" lon="-116.000">
        <ele>1510</ele>
        <time>2026-04-01T08:01:00Z</time>
      </trkpt>
      <trkpt lat="49.502" lon="-116.000">
        <ele>1520</ele>
        <time>2026-04-01T08:02:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`

describe('parseGpx — routes', () => {
  it('parses a single route', () => {
    const result = parseGpx(ROUTE_GPX, 'route.gpx')
    expect(result.kind).toBe('route')
    if (result.kind !== 'route') return
    expect(result.name).toBe('Test Route')
    expect(result.description).toBe('A test route')
    expect(result.geojson.coordinates).toHaveLength(3)
    // Coordinates are [lng, lat, ele]
    expect(result.geojson.coordinates[0]).toEqual([-116, 49.5, 1500])
    expect(result.distance_m).toBeGreaterThan(0)
    expect(result.elevation_gain_m).toBe(100) // 1500 → 1600
    expect(result.elevation_loss_m).toBe(50)  // 1600 → 1550
    expect(result.source_filename).toBe('route.gpx')
  })

  it('treats missing elevation as zero in coordinates and gain/loss', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><rte><name>n</name>
        <rtept lat="49.5" lon="-116.0"/>
        <rtept lat="49.501" lon="-116.0"/>
      </rte></gpx>`
    const result = parseGpx(xml, 'flat.gpx')
    expect(result.kind).toBe('route')
    if (result.kind !== 'route') return
    for (const c of result.geojson.coordinates) {
      expect(c[2]).toBe(0)
    }
    expect(result.elevation_gain_m).toBe(0)
    expect(result.elevation_loss_m).toBe(0)
  })

  it('falls back to filename-derived name when <name> is missing', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><rte>
        <rtept lat="49.5" lon="-116.0"><ele>1000</ele></rtept>
      </rte></gpx>`
    const result = parseGpx(xml, 'My Route.gpx')
    expect(result.kind).toBe('route')
    if (result.kind !== 'route') return
    expect(result.name).toBe('My Route')
  })
})

describe('parseGpx — tracks', () => {
  it('parses a single track with timestamps', () => {
    const result = parseGpx(TRACK_GPX, 'tour.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.name).toBe('Test Track')
    expect(result.recorded_at).toBe('2026-04-01T08:00:00.000Z')
    expect(result.duration_s).toBe(120) // 8:00 -> 8:02
    expect(result.moving_time_s).toBe(120)
    expect(result.geojson.coordinates).toHaveLength(3)
  })

  it('produces null time fields when no <time> elements are present', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><trk><name>N</name>
        <trkseg>
          <trkpt lat="49.5" lon="-116.0"><ele>1500</ele></trkpt>
          <trkpt lat="49.501" lon="-116.0"><ele>1510</ele></trkpt>
        </trkseg>
      </trk></gpx>`
    const result = parseGpx(xml, 'untimed.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.duration_s).toBeNull()
    expect(result.moving_time_s).toBeNull()
    expect(result.recorded_at).toBeNull()
  })

  it('concatenates multiple <trkseg> elements into one LineString', () => {
    const xml = `<?xml version="1.0"?>
      <gpx><trk><name>multi</name>
        <trkseg>
          <trkpt lat="49.500" lon="-116.0"><ele>1500</ele><time>2026-04-01T08:00:00Z</time></trkpt>
          <trkpt lat="49.501" lon="-116.0"><ele>1510</ele><time>2026-04-01T08:01:00Z</time></trkpt>
        </trkseg>
        <trkseg>
          <trkpt lat="49.502" lon="-116.0"><ele>1520</ele><time>2026-04-01T08:32:00Z</time></trkpt>
          <trkpt lat="49.503" lon="-116.0"><ele>1530</ele><time>2026-04-01T08:33:00Z</time></trkpt>
        </trkseg>
      </trk></gpx>`
    const result = parseGpx(xml, 'multi.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.geojson.coordinates).toHaveLength(4)
    // Total elapsed: 8:00 → 8:33 = 1980s
    expect(result.duration_s).toBe(1980)
    // Moving time excludes the 31-minute mid-segment gap. Three moving
    // intervals (≈60s each) at modest speed remain.
    expect(result.moving_time_s).toBeLessThan(result.duration_s ?? 0)
    expect(result.moving_time_s).toBeGreaterThan(0)
  })

  it('idle 30-minute mid-tour gap reduces moving_time materially', () => {
    // 30s of skinning, then a 30-minute pause at the same point, then 30s more.
    const xml = `<?xml version="1.0"?>
      <gpx><trk><name>rest</name>
        <trkseg>
          <trkpt lat="49.500" lon="-116.0"><ele>1500</ele><time>2026-04-01T08:00:00Z</time></trkpt>
          <trkpt lat="49.5005" lon="-116.0"><ele>1510</ele><time>2026-04-01T08:00:30Z</time></trkpt>
          <trkpt lat="49.5005" lon="-116.0"><ele>1510</ele><time>2026-04-01T08:30:30Z</time></trkpt>
          <trkpt lat="49.5010" lon="-116.0"><ele>1520</ele><time>2026-04-01T08:31:00Z</time></trkpt>
        </trkseg>
      </trk></gpx>`
    const result = parseGpx(xml, 'rest.gpx')
    expect(result.kind).toBe('track')
    if (result.kind !== 'track') return
    expect(result.duration_s).toBe(31 * 60) // 1860s
    // Two 30-second moving intervals; the middle 1800s is below threshold.
    expect(result.moving_time_s).toBe(60)
  })

  it('throws a descriptive error for malformed XML', () => {
    expect(() => parseGpx('<not really gpx>', 'bad.gpx')).toThrow(/parse/i)
  })

  it('throws a descriptive error when neither <rte> nor <trk> is present', () => {
    const xml = `<?xml version="1.0"?><gpx></gpx>`
    expect(() => parseGpx(xml, 'empty.gpx')).toThrow(/no route or track/i)
  })
})

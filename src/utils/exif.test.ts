import { normalizeExif } from './exif'

describe('normalizeExif', () => {
  it('returns all nulls for a file with no EXIF', () => {
    expect(normalizeExif(undefined)).toEqual({
      lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null,
    })
  })

  it('reads GPS position, altitude, bearing and capture time', () => {
    const taken = new Date(2026, 1, 14, 9, 31, 5)
    expect(normalizeExif({
      latitude: 49.4621, longitude: -115.0832,
      GPSAltitude: 1834.6, GPSAltitudeRef: 0,
      GPSImgDirection: 271.53,
      DateTimeOriginal: taken,
    })).toEqual({
      lat: 49.4621, lng: -115.0832, altitude_m: 1834.6, bearing: 272,
      taken_at: taken.toISOString(),
    })
  })

  it('treats a 0,0 fix as no GPS (cameras write it when they have no fix)', () => {
    const r = normalizeExif({ latitude: 0, longitude: 0 })
    expect(r.lat).toBeNull()
    expect(r.lng).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(normalizeExif({ latitude: 91, longitude: 10 }).lat).toBeNull()
  })

  it.each([1, new Uint8Array([1]), 'Below Sea Level'])(
    'negates altitude when GPSAltitudeRef is below sea level (%s)',
    (ref) => {
      expect(normalizeExif({ GPSAltitude: 12, GPSAltitudeRef: ref }).altitude_m).toBe(-12)
    },
  )

  it('parses EXIF-format date strings as local time', () => {
    expect(normalizeExif({ DateTimeOriginal: '2026:02:14 09:31:05' }).taken_at)
      .toBe(new Date(2026, 1, 14, 9, 31, 5).toISOString())
  })

  it('drops unparseable dates and non-numeric values', () => {
    expect(normalizeExif({ DateTimeOriginal: 'garbage', GPSImgDirection: 'N' })).toMatchObject({
      taken_at: null, bearing: null,
    })
  })
})

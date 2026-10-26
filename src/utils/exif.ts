import exifr from 'exifr'
import type { PhotoExif } from '../types'
import { normalizeBearing } from './geo'
import { debug } from './debug'

// The subset of exifr's (loosely typed) output that we read. exifr computes
// `latitude`/`longitude` as signed decimals from the GPS IFD.
export interface RawExif {
  latitude?: unknown
  longitude?: unknown
  GPSAltitude?: unknown
  GPSAltitudeRef?: unknown
  GPSImgDirection?: unknown
  DateTimeOriginal?: unknown
}

const EMPTY: PhotoExif = { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null }

// Never throws: a file with unreadable EXIF imports as if it had none.
export async function readPhotoExif(file: Blob): Promise<PhotoExif> {
  try {
    const raw = (await exifr.parse(file, {
      tiff: true, exif: true, gps: true,
      ifd1: false, interop: false, xmp: false, icc: false, iptc: false, jfif: false, ihdr: false,
    })) as RawExif | undefined
    return normalizeExif(raw)
  } catch (err) {
    debug('exif read failed', err)
    return EMPTY
  }
}

export function normalizeExif(raw: RawExif | undefined): PhotoExif {
  if (!raw) return EMPTY
  const lat = finite(raw.latitude)
  const lng = finite(raw.longitude)
  const hasFix =
    lat !== null && lng !== null &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)

  const altitude = finite(raw.GPSAltitude)
  const bearing = finite(raw.GPSImgDirection)

  return {
    lat: hasFix ? lat : null,
    lng: hasFix ? lng : null,
    altitude_m: altitude === null ? null : isBelowSeaLevel(raw.GPSAltitudeRef) ? -altitude : altitude,
    bearing: bearing === null ? null : normalizeBearing(bearing),
    taken_at: toIso(raw.DateTimeOriginal),
  }
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

// exifr may hand GPSAltitudeRef back raw (1 / Uint8Array[1]) or translated.
function isBelowSeaLevel(ref: unknown): boolean {
  if (ref === 1) return true
  if (ref instanceof Uint8Array) return ref[0] === 1
  return typeof ref === 'string' && /below/i.test(ref)
}

// EXIF dates carry no zone; exifr revives them as local-time Dates. A raw
// 'YYYY:MM:DD HH:MM:SS' string is interpreted the same way.
function toIso(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString()
  if (typeof v !== 'string') return null
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number)
  const date = new Date(y, mo - 1, d, h, mi, s)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

import type { Photo } from '../../types'
import { normalizeBearing } from '../../utils/geo'
import { isoToLocalInput, localInputToIso } from '../../utils/time'

// Raw input text for the photo form. Parsed by parsePhotoForm on save.
export interface PhotoFormValues {
  name: string
  description: string
  bearing: string
  takenAt: string     // datetime-local value
  elevation: string
}

export interface ParsedPhotoForm {
  name: string
  description: string
  bearing: number | null
  taken_at: string | null
  elevation_m: number | null
}

// Null when any field is invalid — the Save button stays disabled.
export function parsePhotoForm(v: PhotoFormValues): ParsedPhotoForm | null {
  const name = v.name.trim()
  if (name === '') return null
  const bearing = parseOptionalNumber(v.bearing)
  if (bearing === undefined || (bearing !== null && (bearing < 0 || bearing >= 360))) return null
  const elevation = parseOptionalNumber(v.elevation)
  if (elevation === undefined) return null
  return {
    name,
    description: v.description,
    bearing: bearing === null ? null : normalizeBearing(bearing),
    taken_at: localInputToIso(v.takenAt),
    elevation_m: elevation,
  }
}

export function valuesFromPhoto(
  p: Pick<Photo, 'name' | 'description' | 'bearing' | 'elevation_m' | 'taken_at'>,
): PhotoFormValues {
  return {
    name: p.name,
    description: p.description,
    bearing: p.bearing === null ? '' : String(p.bearing),
    elevation: p.elevation_m === null ? '' : String(Math.round(p.elevation_m)),
    takenAt: isoToLocalInput(p.taken_at),
  }
}

// '' → null (not set), numeric → number, anything else → undefined (invalid).
function parseOptionalNumber(raw: string): number | null | undefined {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

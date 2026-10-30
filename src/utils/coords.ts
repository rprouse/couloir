export interface LatLng {
  lat: number
  lng: number
}

// One coordinate: a signed decimal, optional degree sign, optional hemisphere
// letter ("49.5", "-115.2", "49.5° N", "115.2W").
const PART = /^(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?$/i

function parsePart(text: string): { value: number; hemisphere: string | null } | null {
  const m = PART.exec(text.trim())
  if (!m) return null
  return { value: Number(m[1]), hemisphere: m[2]?.toUpperCase() ?? null }
}

// Parses "lat, lng" as pasted from other apps: "49.50400, -115.06300",
// "49.504 -115.063", or "49.504° N, 115.063° W". Returns null for anything
// else, including out-of-range values.
export function parseLatLng(text: string): LatLng | null {
  const trimmed = text.trim()
  const pieces = trimmed.includes(',')
    ? trimmed.split(',')
    : trimmed.split(/\s+(?=-?\d)/)
  if (pieces.length !== 2) return null
  const a = parsePart(pieces[0])
  const b = parsePart(pieces[1])
  if (!a || !b) return null
  if (a.hemisphere && !'NS'.includes(a.hemisphere)) return null
  if (b.hemisphere && !'EW'.includes(b.hemisphere)) return null
  if ((a.hemisphere && a.value < 0) || (b.hemisphere && b.value < 0)) return null
  const lat = a.hemisphere === 'S' ? -a.value : a.value
  const lng = b.hemisphere === 'W' ? -b.value : b.value
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

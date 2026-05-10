export function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatElevationM(meters: number): string {
  return `${Math.round(meters)} m`
}

// Track durations: seconds → "Xh Ym" or "Ym" for sub-hour. Null → em-dash.
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes - hours * 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

// Validates 6-digit RGB hex with leading '#'. We deliberately exclude
// shorthand (#abc) and 8-digit (#aabbccdd) — the data model requires #RRGGBB.
const HEX_RE = /^#[0-9a-fA-F]{6}$/
export function isValidHex(value: string): boolean {
  return HEX_RE.test(value)
}

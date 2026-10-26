// Centralized "now" so tests can mock the clock with vi.useFakeTimers().
// All ISO 8601 timestamps in Couloir flow through this helper.
export function now(): string {
  return new Date().toISOString()
}

// <input type="datetime-local"> works in zone-less local wall-clock time.
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function localInputToIso(value: string): string | null {
  if (value.trim() === '') return null
  const d = new Date(value) // 'YYYY-MM-DDTHH:mm[:ss]' without a zone parses as local
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// Centralized "now" so tests can mock the clock with vi.useFakeTimers().
// All ISO 8601 timestamps in Couloir flow through this helper.
export function now(): string {
  return new Date().toISOString()
}

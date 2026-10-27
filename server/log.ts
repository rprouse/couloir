// Server-side logging to stderr, which Docker collects as the container log.
// The browser's debug() helper is gated by localStorage and can't run here.
export function logError(context: string, err: unknown): void {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err)
  process.stderr.write(`[couloir] ${context}: ${detail}\n`)
}

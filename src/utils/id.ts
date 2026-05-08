// Thin wrapper around crypto.randomUUID(). Centralized so tests can mock it
// for deterministic IDs and so we have one place to swap implementations
// (e.g. crypto.subtle when targeting older Safari) if needed.
export function newId(): string {
  return crypto.randomUUID()
}

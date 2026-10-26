// Thin wrapper around crypto.randomUUID(). Centralized so tests can mock it
// for deterministic IDs and so there's one place to handle environments
// without it.
//
// randomUUID only exists in secure contexts (HTTPS or localhost), so on a
// plain-HTTP LAN address like http://unraid:8080 it is undefined. In that case
// build the same RFC 4122 version-4 UUID from getRandomValues, which works in
// any context.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return uuidV4FromRandomBytes(crypto.getRandomValues(new Uint8Array(16)))
}

export function uuidV4FromRandomBytes(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new Error('a UUID needs exactly 16 random bytes')
  const b = Uint8Array.from(bytes)
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // RFC 4122 variant (10xx)
  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

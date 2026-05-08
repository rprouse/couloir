// SHA-256 of a byte array, returned as a lowercase hex string.
// Uses the Web Crypto API (subtle.digest), which is available in modern
// browsers and in jsdom (via Node's crypto). No fallback path — if the
// platform doesn't expose subtle.digest, we'd rather fail loudly.
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer so SubtleCrypto's strict typing accepts
  // the input regardless of the source view (DataView, slice, etc.).
  // SharedArrayBuffer-backed views are intentionally rejected by digest().
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// SHA-256 of a byte array, returned as a lowercase hex string.
//
// Uses the Web Crypto API (crypto.subtle.digest) where it exists. It only
// exists in secure contexts (HTTPS or localhost), so on a plain-HTTP LAN
// address like http://unraid:8080 the pure-JS implementation below takes
// over. Both produce identical digests, so a file's source_hash (used for
// duplicate detection) doesn't depend on how the app was reached.
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = crypto.subtle ? await subtleSha256(bytes) : sha256(bytes)
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function subtleSha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer so SubtleCrypto's strict typing accepts
  // the input regardless of the source view (DataView, slice, etc.).
  // SharedArrayBuffer-backed views are intentionally rejected by digest().
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))
}

// FIPS 180-4 round constants: the first 32 bits of the fractional parts of
// the cube roots of the first 64 primes.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

// Initial hash: the first 32 bits of the fractional parts of the square
// roots of the first 8 primes.
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n))
}

/** Pure-JS SHA-256 (FIPS 180-4). Exported for tests; use sha256Hex. */
export function sha256(bytes: Uint8Array): Uint8Array {
  // Pad: the message, a 1 bit, zeros, then the bit length as a 64-bit
  // big-endian integer, to a multiple of 64 bytes.
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const message = new Uint8Array(paddedLength)
  message.set(bytes)
  message[bytes.length] = 0x80
  const view = new DataView(message.buffer)
  const bitLength = bytes.length * 8
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 2 ** 32))
  view.setUint32(paddedLength - 4, bitLength >>> 0)

  // Uint32Array stores wrap modulo 2^32, which is the arithmetic SHA-256 wants.
  const hash = new Uint32Array(H0)
  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = w[i - 16] + s0 + w[i - 7] + s1
    }

    let [a, b, c, d, e, f, g, h] = hash
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + s1 + ch + K[i] + w[i]) | 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + maj) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    hash[0] += a
    hash[1] += b
    hash[2] += c
    hash[3] += d
    hash[4] += e
    hash[5] += f
    hash[6] += g
    hash[7] += h
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  hash.forEach((word, i) => outView.setUint32(i * 4, word))
  return out
}

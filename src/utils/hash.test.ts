import { createHash, randomBytes } from 'node:crypto'
import { sha256, sha256Hex } from './hash'

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function nodeSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

describe('sha256Hex', () => {
  it('hashes an empty input to the well-known SHA-256 value', async () => {
    const hex = await sha256Hex(new Uint8Array())
    expect(hex).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('hashes "abc" to the FIPS 180-2 reference value', async () => {
    const bytes = new TextEncoder().encode('abc')
    const hex = await sha256Hex(bytes)
    expect(hex).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('returns the same hash for two equal-content Uint8Arrays', async () => {
    const a = await sha256Hex(new TextEncoder().encode('couloir'))
    const b = await sha256Hex(new TextEncoder().encode('couloir'))
    expect(a).toBe(b)
  })

  describe('without crypto.subtle (plain-HTTP origin)', () => {
    let original: SubtleCrypto

    beforeEach(() => {
      original = crypto.subtle
      // Insecure contexts simply don't define it.
      Object.defineProperty(crypto, 'subtle', { value: undefined, configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(crypto, 'subtle', { value: original, configurable: true })
    })

    it('still hashes, to the same value as Web Crypto', async () => {
      expect(crypto.subtle).toBeUndefined()
      const bytes = new TextEncoder().encode('<gpx version="1.1"></gpx>')
      expect(await sha256Hex(bytes)).toBe(nodeSha256(bytes))
    })
  })
})

describe('sha256 (pure JS)', () => {
  // FIPS 180-2 / NIST CSRC example vectors.
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    [
      'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
      'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
    ],
  ])('matches the reference digest of %j', (input, expected) => {
    expect(hex(sha256(new TextEncoder().encode(input)))).toBe(expected)
  })

  it('matches the reference digest of one million "a"s', () => {
    expect(hex(sha256(new Uint8Array(1_000_000).fill(0x61))))
      .toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0')
  })

  it('agrees with Node\'s SHA-256 at every padding boundary', () => {
    // Lengths around the 55/56/64-byte block edges are where padding bugs hide.
    for (let length = 0; length <= 200; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 31 + length) & 0xff)
      expect(hex(sha256(bytes))).toBe(nodeSha256(bytes))
    }
  })

  it('agrees with Node\'s SHA-256 on random data', () => {
    for (const length of [1, 63, 64, 65, 1000, 4096, 65_537]) {
      const bytes = new Uint8Array(randomBytes(length))
      expect(hex(sha256(bytes))).toBe(nodeSha256(bytes))
    }
  })

  it('hashes a view into a larger buffer by its own bytes only', () => {
    const backing = new TextEncoder().encode('xxabcxx')
    expect(hex(sha256(backing.subarray(2, 5))))
      .toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

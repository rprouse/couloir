import { newId, uuidV4FromRandomBytes } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('returns a UUID-shaped string', () => {
    const id = newId()
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('returns a unique value on each call', () => {
    const a = newId()
    const b = newId()
    expect(a).not.toBe(b)
  })

  describe('without crypto.randomUUID (plain-HTTP origin)', () => {
    let original: typeof crypto.randomUUID

    beforeEach(() => {
      original = crypto.randomUUID
      // Insecure contexts simply don't define it.
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    })

    it('still returns unique version-4 UUIDs', () => {
      const ids = new Set(Array.from({ length: 50 }, () => newId()))
      expect(ids.size).toBe(50)
      for (const id of ids) expect(id).toMatch(UUID_V4)
    })
  })
})

describe('uuidV4FromRandomBytes', () => {
  it('sets the version and variant bits whatever the input', () => {
    expect(uuidV4FromRandomBytes(new Uint8Array(16).fill(0xff)))
      .toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    expect(uuidV4FromRandomBytes(new Uint8Array(16)))
      .toBe('00000000-0000-4000-8000-000000000000')
  })

  it('does not modify the caller\'s bytes', () => {
    const bytes = new Uint8Array(16).fill(0xff)
    uuidV4FromRandomBytes(bytes)
    expect(bytes.every((b) => b === 0xff)).toBe(true)
  })

  it('rejects the wrong number of bytes', () => {
    expect(() => uuidV4FromRandomBytes(new Uint8Array(15))).toThrow(/16 random bytes/)
  })
})

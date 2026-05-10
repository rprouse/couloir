import { sha256Hex } from './hash'

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
})

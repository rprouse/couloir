import { newId } from './id'

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
})

import { now } from './time'

describe('now', () => {
  it('returns an ISO 8601 timestamp ending in Z', () => {
    expect(now()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('honors fake timers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'))
    expect(now()).toBe('2026-05-06T12:00:00.000Z')
    vi.useRealTimers()
  })
})

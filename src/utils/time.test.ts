import { now, isoToLocalInput, localInputToIso } from './time'

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

describe('isoToLocalInput / localInputToIso', () => {
  it('round-trips a local wall-clock time to the second', () => {
    const iso = new Date(2026, 1, 14, 9, 31, 5).toISOString()
    expect(isoToLocalInput(iso)).toBe('2026-02-14T09:31:05')
    expect(localInputToIso('2026-02-14T09:31:05')).toBe(iso)
  })
  it('maps empty / invalid to empty / null', () => {
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('nope')).toBe('')
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('nope')).toBeNull()
  })
})

import { createTileErrorMonitor } from './tileErrorMonitor'

describe('tileErrorMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not trip below the threshold', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({ threshold: 3, windowMs: 10_000, onTrip })
    monitor.recordError()
    monitor.recordError()
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('trips when the threshold is reached within the window', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({ threshold: 3, windowMs: 10_000, onTrip })
    monitor.recordError()
    monitor.recordError()
    monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(1)
  })

  it('does not trip when errors are spread across windows', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({ threshold: 3, windowMs: 10_000, onTrip })
    monitor.recordError()
    vi.advanceTimersByTime(6_000)
    monitor.recordError()
    vi.advanceTimersByTime(6_000)
    monitor.recordError()
    expect(onTrip).not.toHaveBeenCalled()
  })

  it('does not re-trip during the cooldown after a trip', () => {
    const onTrip = vi.fn()
    const monitor = createTileErrorMonitor({
      threshold: 3,
      windowMs: 10_000,
      cooldownMs: 30_000,
      onTrip,
    })
    monitor.recordError(); monitor.recordError(); monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(1)
    monitor.recordError(); monitor.recordError(); monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(31_000)
    monitor.recordError(); monitor.recordError(); monitor.recordError()
    expect(onTrip).toHaveBeenCalledTimes(2)
  })
})

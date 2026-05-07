interface MonitorOptions {
  threshold: number
  windowMs: number
  cooldownMs?: number
  onTrip: () => void
}

export interface TileErrorMonitor {
  recordError: () => void
  reset: () => void
}

export function createTileErrorMonitor(opts: MonitorOptions): TileErrorMonitor {
  const cooldownMs = opts.cooldownMs ?? 30_000
  let timestamps: number[] = []
  let lastTripAt = 0

  return {
    recordError() {
      const now = Date.now()
      timestamps.push(now)
      timestamps = timestamps.filter((t) => now - t <= opts.windowMs)
      if (now - lastTripAt < cooldownMs) return
      if (timestamps.length >= opts.threshold) {
        lastTripAt = now
        opts.onTrip()
      }
    },
    reset() {
      timestamps = []
      lastTripAt = 0
    },
  }
}

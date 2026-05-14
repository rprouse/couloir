import { applyPlacementBinding } from './usePlacementMapBinding'

interface FakeMap {
  canvas: { style: { cursor: string } }
  handlers: Record<string, ((e: { lngLat: { lat: number; lng: number } }) => void)[]>
  getCanvas: () => FakeMap['canvas']
  on: (event: string, fn: (e: { lngLat: { lat: number; lng: number } }) => void) => void
  off: (event: string, fn: (e: { lngLat: { lat: number; lng: number } }) => void) => void
}

const makeMap = (): FakeMap => {
  const m: FakeMap = {
    canvas: { style: { cursor: '' } },
    handlers: {},
    getCanvas: () => m.canvas,
    on: (event, fn) => {
      m.handlers[event] = m.handlers[event] ?? []
      m.handlers[event].push(fn)
    },
    off: (event, fn) => {
      m.handlers[event] = (m.handlers[event] ?? []).filter((f) => f !== fn)
    },
  }
  return m
}

describe('applyPlacementBinding', () => {
  it('does nothing when placement mode is idle', () => {
    const map = makeMap()
    const onComplete = vi.fn()
    const teardown = applyPlacementBinding(map as never, 'idle', onComplete)
    expect(map.canvas.style.cursor).toBe('')
    expect(map.handlers.click).toBeUndefined()
    teardown()
  })

  it('sets a crosshair cursor and registers a one-shot click in waypoint mode', () => {
    const map = makeMap()
    const onComplete = vi.fn()
    const teardown = applyPlacementBinding(map as never, 'waypoint', onComplete)
    expect(map.canvas.style.cursor).toBe('crosshair')
    expect(map.handlers.click).toHaveLength(1)
    map.handlers.click[0]({ lngLat: { lat: 49.5, lng: -116 } })
    expect(onComplete).toHaveBeenCalledWith(49.5, -116)
    teardown()
  })

  it('restores cursor and removes the click handler on teardown', () => {
    const map = makeMap()
    const teardown = applyPlacementBinding(map as never, 'waypoint', () => {})
    teardown()
    expect(map.canvas.style.cursor).toBe('')
    expect(map.handlers.click).toHaveLength(0)
  })
})

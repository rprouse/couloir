import { vi } from 'vitest'

// Alias globalThis.Map so the JS Map constructor stays available inside this
// module, which exports a MapLibre `Map` mock that would otherwise shadow it.
const EventMap = globalThis.Map

export class MockMap {
  private listeners = new EventMap<string, Set<(...args: unknown[]) => void>>()
  loaded = false
  styleLoaded = false
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  })
  off = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    this.listeners.get(event)?.delete(handler)
    return this
  })
  emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }
  addControl = vi.fn()
  removeControl = vi.fn()
  remove = vi.fn()
  getCanvas = vi.fn(() => ({ style: {} as CSSStyleDeclaration }))
  setTerrain = vi.fn()
  getTerrain = vi.fn(() => null)
  addSource = vi.fn()
  removeSource = vi.fn()
  getSource = vi.fn(() => null)
  addLayer = vi.fn()
  removeLayer = vi.fn()
  getLayer = vi.fn(() => null)
  setLayoutProperty = vi.fn()
  // Returning true keeps tests on the synchronous-install code path so the
  // existing layer effects are exercised. Real MapLibre returns false briefly
  // between Map() construction and the first style.load event.
  isStyleLoaded = vi.fn(() => true)
  setStyle = vi.fn()
  resize = vi.fn()
  flyTo = vi.fn()
  hasImage = vi.fn(() => false)
  addImage = vi.fn()
  getZoom = vi.fn(() => 11)
  easeTo = vi.fn()
  removeImage = vi.fn()
  queryTerrainElevation = vi.fn((): number | null => null)
  once = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const wrapped = (...args: unknown[]) => {
      this.off(event, wrapped)
      handler(...args)
    }
    this.on(event, wrapped)
    return this
  })
  dragPan = {
    enable: vi.fn(),
    disable: vi.fn(),
  }
}

type LngLatLike = [number, number] | { lng: number; lat: number }

export class MockMarker {
  private listeners = new EventMap<string, Set<(...args: unknown[]) => void>>()
  private lngLat: { lng: number; lat: number } | null = null
  constructor(public options: Record<string, unknown> = {}) {}
  setLngLat = vi.fn((ll: LngLatLike) => {
    this.lngLat = Array.isArray(ll) ? { lng: ll[0], lat: ll[1] } : { lng: ll.lng, lat: ll.lat }
    return this
  })
  getLngLat = vi.fn(() => this.lngLat)
  addTo = vi.fn(() => this)
  remove = vi.fn(() => this)
  on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  })
  emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }
}

export const Marker = vi.fn().mockImplementation((opts?: Record<string, unknown>) => new MockMarker(opts))

export const NavigationControl = vi.fn().mockImplementation(() => ({}))
export const __mocks__ = { MockMap, MockMarker }

export const Map = vi.fn().mockImplementation(() => new MockMap())

export default { Map, NavigationControl, Marker }

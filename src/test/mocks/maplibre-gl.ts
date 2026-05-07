import { vi } from 'vitest'

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
  setStyle = vi.fn()
  resize = vi.fn()
  flyTo = vi.fn()
}

export const NavigationControl = vi.fn().mockImplementation(() => ({}))
export const __mocks__ = { MockMap }

export const Map = vi.fn().mockImplementation(() => new MockMap())

export default { Map, NavigationControl }

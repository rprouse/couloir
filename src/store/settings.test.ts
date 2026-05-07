import { useSettingsStore } from './settings'

describe('settings store — Maptiler key', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ maptilerKey: null })
  })

  it('starts with no key when localStorage is empty', () => {
    expect(useSettingsStore.getState().maptilerKey).toBeNull()
  })

  it('persists the key on save', () => {
    useSettingsStore.getState().setMaptilerKey('abc123')
    expect(localStorage.getItem('couloir_maptiler_key')).toBe('abc123')
    expect(useSettingsStore.getState().maptilerKey).toBe('abc123')
  })

  it('hydrates from localStorage on init', () => {
    localStorage.setItem('couloir_maptiler_key', 'xyz789')
    useSettingsStore.getState().hydrateFromStorage()
    expect(useSettingsStore.getState().maptilerKey).toBe('xyz789')
  })

  it('clears the key', () => {
    localStorage.setItem('couloir_maptiler_key', 'abc')
    useSettingsStore.setState({ maptilerKey: 'abc' })
    useSettingsStore.getState().setMaptilerKey(null)
    expect(localStorage.getItem('couloir_maptiler_key')).toBeNull()
    expect(useSettingsStore.getState().maptilerKey).toBeNull()
  })
})

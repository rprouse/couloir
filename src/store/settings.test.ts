import { useSettingsStore } from './settings'

describe('settings store — Maptiler key', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ maptilerKey: null, maptilerKeySource: null, serverMaptilerKey: null })
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

  describe('server-provided key', () => {
    const config = (body: unknown, status = 200) =>
      (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

    it('uses the server key when this browser has none', async () => {
      await useSettingsStore.getState().loadServerKey(config({ maptilerKey: 'SERVER' }))
      expect(useSettingsStore.getState()).toMatchObject({
        maptilerKey: 'SERVER', maptilerKeySource: 'server', serverMaptilerKey: 'SERVER',
      })
      // Never written to localStorage, so a server-side change takes effect.
      expect(localStorage.getItem('couloir_maptiler_key')).toBeNull()
    })

    it("prefers this browser's own key over the server key", async () => {
      localStorage.setItem('couloir_maptiler_key', 'LOCAL')
      useSettingsStore.getState().hydrateFromStorage()
      await useSettingsStore.getState().loadServerKey(config({ maptilerKey: 'SERVER' }))
      expect(useSettingsStore.getState()).toMatchObject({ maptilerKey: 'LOCAL', maptilerKeySource: 'local' })
    })

    it('falls back to the server key when the local key is cleared', async () => {
      await useSettingsStore.getState().loadServerKey(config({ maptilerKey: 'SERVER' }))
      useSettingsStore.getState().setMaptilerKey('LOCAL')
      expect(useSettingsStore.getState().maptilerKeySource).toBe('local')
      useSettingsStore.getState().setMaptilerKey(null)
      expect(useSettingsStore.getState()).toMatchObject({ maptilerKey: 'SERVER', maptilerKeySource: 'server' })
    })

    it.each([
      ['a null key', config({ maptilerKey: null })],
      ['an error status', config({ error: 'boom' }, 500)],
      ['an unreachable server', (async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch],
    ])('leaves the key unset on %s', async (_label, fetchFn) => {
      await useSettingsStore.getState().loadServerKey(fetchFn)
      expect(useSettingsStore.getState()).toMatchObject({ maptilerKey: null, maptilerKeySource: null })
    })
  })
})

import { create } from 'zustand'

const STORAGE_KEY = 'couloir_maptiler_key'

export type MaptilerKeySource = 'local' | 'server'

interface SettingsState {
  /** The key in effect: this browser's own key if set, else the server's. */
  maptilerKey: string | null
  maptilerKeySource: MaptilerKeySource | null
  /** The server's MAPTILER_KEY. Held in memory only, so a change on the server takes effect on reload. */
  serverMaptilerKey: string | null
  /** Saves this browser's own key; null or '' clears it and falls back to the server's. */
  setMaptilerKey: (key: string | null) => void
  hydrateFromStorage: () => void
  /** Fetch the server's key from /api/config. Failure leaves the server key unset. */
  loadServerKey: (fetchFn?: typeof fetch) => Promise<void>
}

function readLocalKey(): string | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && stored.length > 0 ? stored : null
}

function effective(local: string | null, server: string | null): Pick<SettingsState, 'maptilerKey' | 'maptilerKeySource'> {
  if (local) return { maptilerKey: local, maptilerKeySource: 'local' }
  if (server) return { maptilerKey: server, maptilerKeySource: 'server' }
  return { maptilerKey: null, maptilerKeySource: null }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  maptilerKey: null,
  maptilerKeySource: null,
  serverMaptilerKey: null,
  setMaptilerKey: (key) => {
    if (key === null || key === '') {
      localStorage.removeItem(STORAGE_KEY)
      set(effective(null, get().serverMaptilerKey))
    } else {
      localStorage.setItem(STORAGE_KEY, key)
      set(effective(key, get().serverMaptilerKey))
    }
  },
  hydrateFromStorage: () => {
    set(effective(readLocalKey(), get().serverMaptilerKey))
  },
  loadServerKey: async (fetchFn = (input, init) => fetch(input, init)) => {
    let serverKey: string | null = null
    try {
      const res = await fetchFn('/api/config')
      if (res.ok) {
        const body = (await res.json()) as { maptilerKey?: unknown }
        if (typeof body.maptilerKey === 'string' && body.maptilerKey.length > 0) serverKey = body.maptilerKey
      }
    } catch {
      // No server key: the welcome screen asks for one, as before.
    }
    set({ serverMaptilerKey: serverKey, ...effective(readLocalKey(), serverKey) })
  },
}))

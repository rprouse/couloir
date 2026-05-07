import { create } from 'zustand'

const STORAGE_KEY = 'couloir_maptiler_key'

interface SettingsState {
  maptilerKey: string | null
  setMaptilerKey: (key: string | null) => void
  hydrateFromStorage: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  maptilerKey: null,
  setMaptilerKey: (key) => {
    if (key === null || key === '') {
      localStorage.removeItem(STORAGE_KEY)
      set({ maptilerKey: null })
    } else {
      localStorage.setItem(STORAGE_KEY, key)
      set({ maptilerKey: key })
    }
  },
  hydrateFromStorage: () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    set({ maptilerKey: stored && stored.length > 0 ? stored : null })
  },
}))

import { create } from 'zustand'
import type { AtesArea } from '../types'
import { getStorage } from '../storage/provider'
import { importAtesKmz, type AtesImportResult } from '../features/ates/atesImport'

interface AtesAreasState {
  areas: AtesArea[]   // in name order, as the storage layer lists them
  loading: boolean
  error: string | null

  load: () => Promise<void>
  /** Import (or re-import) one KMZ. Rejects with AtesImportError for bad files. */
  importFile: (file: File) => Promise<AtesImportResult>
  remove: (id: string) => Promise<void>
}

// Same order as the storage layer's `ORDER BY name COLLATE NOCASE, id`.
function byName(a: AtesArea, b: AtesArea): number {
  const [na, nb] = [a.name.toLowerCase(), b.name.toLowerCase()]
  if (na !== nb) return na < nb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const useAtesAreasStore = create<AtesAreasState>((set) => ({
  areas: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const areas = await getStorage().getAtesAreas()
      set({ areas, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  importFile: async (file) => {
    const result = await importAtesKmz(getStorage(), file)
    set((s) => ({
      areas: [...s.areas.filter((a) => a.id !== result.area.id), result.area].sort(byName),
    }))
    return result
  },

  remove: async (id) => {
    await getStorage().deleteAtesArea(id)
    set((s) => ({ areas: s.areas.filter((a) => a.id !== id) }))
  },
}))

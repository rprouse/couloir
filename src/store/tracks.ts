import { create } from 'zustand'
import type { Track } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewTrackInput = Omit<Track, 'id' | 'created_at' | 'updated_at'>

interface TracksState {
  tracks: Track[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewTrackInput) => Promise<Track>
  update: (id: string, patch: Partial<Omit<Track, 'id' | 'created_at'>>) => Promise<Track>
  remove: (id: string) => Promise<void>
}

export const useTracksStore = create<TracksState>((set, get) => ({
  tracks: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const tracks = await getStorage().getTracks()
      set({ tracks, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const ts = now()
    const track: Track = { ...input, id: newId(), created_at: ts, updated_at: ts }
    await getStorage().saveTrack(track)
    set((s) => ({ tracks: [...s.tracks, track] }))
    return track
  },

  update: async (id, patch) => {
    const existing = get().tracks.find((t) => t.id === id)
    if (!existing) throw new Error(`track ${id} not found`)
    const updated: Track = { ...existing, ...patch, updated_at: now() }
    await getStorage().saveTrack(updated)
    set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? updated : t)) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteTrack(id)
    set((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) }))
  },
}))

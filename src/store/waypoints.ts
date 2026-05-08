import { create } from 'zustand'
import type { Waypoint } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewWaypointInput = Omit<Waypoint, 'id' | 'created_at' | 'updated_at'>

interface WaypointsState {
  waypoints: Waypoint[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewWaypointInput) => Promise<Waypoint>
  update: (id: string, patch: Partial<Omit<Waypoint, 'id' | 'created_at'>>) => Promise<Waypoint>
  remove: (id: string) => Promise<void>
}

export const useWaypointsStore = create<WaypointsState>((set, get) => ({
  waypoints: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const waypoints = await getStorage().getWaypoints()
      set({ waypoints, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const ts = now()
    const wp: Waypoint = { ...input, id: newId(), created_at: ts, updated_at: ts }
    await getStorage().saveWaypoint(wp)
    set((s) => ({ waypoints: [...s.waypoints, wp] }))
    return wp
  },

  update: async (id, patch) => {
    const existing = get().waypoints.find((w) => w.id === id)
    if (!existing) throw new Error(`waypoint ${id} not found`)
    const updated: Waypoint = { ...existing, ...patch, updated_at: now() }
    await getStorage().saveWaypoint(updated)
    set((s) => ({ waypoints: s.waypoints.map((w) => (w.id === id ? updated : w)) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteWaypoint(id)
    set((s) => ({ waypoints: s.waypoints.filter((w) => w.id !== id) }))
  },
}))

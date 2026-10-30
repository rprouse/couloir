import { create } from 'zustand'
import type { Route } from '../types'
import { getStorage } from '../storage/provider'
import { newId } from '../utils/id'
import { now } from '../utils/time'

type NewRouteInput = Omit<Route, 'id' | 'created_at' | 'updated_at'>

interface RoutesState {
  routes: Route[]
  loading: boolean
  error: string | null

  load: () => Promise<void>
  add: (input: NewRouteInput) => Promise<Route>
  // Saves a complete route as given (id and timestamps included), e.g. one
  // converted from the other line type.
  insert: (route: Route) => Promise<void>
  update: (id: string, patch: Partial<Omit<Route, 'id' | 'created_at'>>) => Promise<Route>
  remove: (id: string) => Promise<void>
}

export const useRoutesStore = create<RoutesState>((set, get) => ({
  routes: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null })
    try {
      const routes = await getStorage().getRoutes()
      set({ routes, loading: false })
    } catch (err) {
      set({ error: String(err), loading: false })
    }
  },

  add: async (input) => {
    const ts = now()
    const route: Route = { ...input, id: newId(), created_at: ts, updated_at: ts }
    await getStorage().saveRoute(route)
    set((s) => ({ routes: [...s.routes, route] }))
    return route
  },

  insert: async (route) => {
    await getStorage().saveRoute(route)
    set((s) => ({ routes: [...s.routes, route] }))
  },

  update: async (id, patch) => {
    const existing = get().routes.find((r) => r.id === id)
    if (!existing) throw new Error(`route ${id} not found`)
    const updated: Route = { ...existing, ...patch, updated_at: now() }
    await getStorage().saveRoute(updated)
    set((s) => ({ routes: s.routes.map((r) => (r.id === id ? updated : r)) }))
    return updated
  },

  remove: async (id) => {
    await getStorage().deleteRoute(id)
    set((s) => ({ routes: s.routes.filter((r) => r.id !== id) }))
  },
}))

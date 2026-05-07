import type { StorageProvider } from '../storage/interface'
import { newId } from '../utils/id'
import type { Route, Track } from '../types'

// Installs a `window.__couloir` helper for browser-console verification of
// the storage layer. Tree-shaken out of production builds via the
// `import.meta.env.DEV` guard at the call site (main.tsx).
export function installDevConsole(storage: StorageProvider): void {
  const FIXED_GEOJSON = {
    type: 'LineString' as const,
    coordinates: [
      [-115.05, 49.50, 1500] as [number, number, number],
      [-115.06, 49.51, 1620] as [number, number, number],
    ],
  }

  const helper = {
    storage,

    async createDummyRoute(name = 'Dummy Route'): Promise<Route> {
      const now = new Date().toISOString()
      const route: Route = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyRoute',
        geojson: FIXED_GEOJSON,
        source_hash: `dev-${newId()}`,
        source_filename: 'devConsole.ts',
        color: '#E05C2A',
        ates: 'simple',
        technical_difficulty: 'moderate',
        distance_m: 0,
        elevation_gain_m: 120,
        elevation_loss_m: 0,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveRoute(route)
      return route
    },

    async createDummyTrack(name = 'Dummy Track'): Promise<Track> {
      const now = new Date().toISOString()
      const track: Track = {
        id: newId(),
        user_id: 'local',
        name,
        description: 'Created from window.__couloir.createDummyTrack',
        geojson: FIXED_GEOJSON,
        source_hash: `dev-${newId()}`,
        source_filename: 'devConsole.ts',
        color: '#2A7BE0',
        distance_m: 0,
        elevation_gain_m: 120,
        elevation_loss_m: 0,
        duration_s: 1800,
        moving_time_s: 1700,
        recorded_at: now,
        tags: [],
        created_at: now,
        updated_at: now,
      }
      await storage.saveTrack(track)
      return track
    },

    async renameRoute(id: string, name: string): Promise<Route> {
      const existing = await storage.getRoute(id)
      if (!existing) throw new Error(`route ${id} not found`)
      const updated: Route = {
        ...existing,
        name,
        updated_at: new Date().toISOString(),
      }
      await storage.saveRoute(updated)
      return updated
    },

    async list(kind: 'routes' | 'tracks'): Promise<unknown[]> {
      return kind === 'routes' ? storage.getRoutes() : storage.getTracks()
    },
  }

  ;(globalThis as unknown as { __couloir: typeof helper }).__couloir = helper
  // eslint-disable-next-line no-console
  console.log('[couloir] dev console installed at window.__couloir')
}

import { create } from 'zustand'
import {
  FORECAST_HOURS,
  distanceKm,
  fetchFreezingForecast,
  hourAt,
  type FreezingForecast,
  type FreezingHour,
} from '../features/freezing/freezingLevel'

const HOUR_MS = 60 * 60 * 1000
// Refetch once the map centre is this far from the forecast point, or the
// forecast is this old. GEM's freezing level changes little over 10 km.
export const REFETCH_DISTANCE_KM = 10
export const REFETCH_AGE_MS = HOUR_MS
// Elevation used for the tiles when it's already freezing at the model ground:
// lower than any terrain, so every pixel reads as below 0 °C.
export const FREEZING_EVERYWHERE_M = -1000

interface FreezingLevelState {
  forecast: FreezingForecast | null
  loading: boolean
  // The point being fetched while loading.
  target: { lat: number; lng: number } | null
  error: string | null
  // Hours ahead of now to show (0 = now, up to FORECAST_HOURS). Not persisted:
  // the map should open on current conditions.
  hourOffset: number
  // Clock the selected hour is measured from, updated by tick() so selectors
  // stay pure.
  now: number
  load: (lat: number, lng: number) => Promise<void>
  setHourOffset: (hours: number) => void
  tick: (now: number) => void
}

let inflight: AbortController | null = null

export const useFreezingLevelStore = create<FreezingLevelState>((set) => ({
  forecast: null,
  loading: false,
  target: null,
  error: null,
  hourOffset: 0,
  now: Date.now(),

  load: async (lat, lng) => {
    inflight?.abort()
    const controller = new AbortController()
    inflight = controller
    // Rounded to ~1 km: plenty for a model with 2.5 km cells.
    const target = { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 }
    set({ loading: true, target, error: null })
    try {
      const forecast = await fetchFreezingForecast(
        target.lat,
        target.lng,
        fetch.bind(globalThis),
        controller.signal,
      )
      if (inflight !== controller) return
      set({ forecast, loading: false, target: null, now: Date.now() })
    } catch (err) {
      if (inflight !== controller) return
      set({ loading: false, target: null, error: err instanceof Error ? err.message : String(err) })
    } finally {
      if (inflight === controller) inflight = null
    }
  },

  setHourOffset: (hours) =>
    set({ hourOffset: Math.max(0, Math.min(FORECAST_HOURS, Math.round(hours))) }),

  tick: (now) => set({ now }),
}))

export function selectedTime(s: Pick<FreezingLevelState, 'now' | 'hourOffset'>): number {
  return s.now + s.hourOffset * HOUR_MS
}

export function selectFreezingHour(
  s: Pick<FreezingLevelState, 'forecast' | 'now' | 'hourOffset'>,
): FreezingHour | null {
  return hourAt(s.forecast, selectedTime(s))
}

// The elevation the overlay tiles split at, or null when there is no level.
export function selectTileLevel(
  s: Pick<FreezingLevelState, 'forecast' | 'now' | 'hourOffset'>,
): number | null {
  const hour = selectFreezingHour(s)
  if (!hour || hour.levelM === null) return null
  return hour.belowGround ? FREEZING_EVERYWHERE_M : hour.levelM
}

export function needsRefetch(
  s: Pick<FreezingLevelState, 'forecast' | 'loading' | 'target'>,
  lat: number,
  lng: number,
  now: number,
): boolean {
  // Already fetching for about here.
  if (s.loading && s.target && distanceKm(s.target.lat, s.target.lng, lat, lng) <= REFETCH_DISTANCE_KM) {
    return false
  }
  const f = s.forecast
  if (!f) return true
  if (now - f.fetchedAt > REFETCH_AGE_MS) return true
  return distanceKm(f.lat, f.lng, lat, lng) > REFETCH_DISTANCE_KM
}

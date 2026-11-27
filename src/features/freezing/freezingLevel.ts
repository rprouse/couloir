// Freezing level from Open-Meteo (free, no key), ported from the
// esp32_avalanche display. The default model, Environment Canada's GEM, has no
// `freezing_level_height`, so it is computed from the 2 m temperature at the
// model ground and the temperatures and heights of the pressure levels above.

export const FREEZING_MODEL = 'gem_seamless'
// 850 hPa is about 1500 m, 500 hPa about 5500 m.
export const PRESSURE_LEVELS = [850, 700, 600, 500] as const
// Hours ahead of now the forecast covers (the first hour is the current one).
export const FORECAST_HOURS = 72

export interface FreezingHour {
  // Start of the hour, epoch ms (the values are instantaneous at that time).
  time: number
  // Metres above sea level; null when the model has no data for the hour.
  levelM: number | null
  // Already freezing at the model's ground: everything is below 0 °C.
  belowGround: boolean
}

export interface FreezingForecast {
  // The point the forecast is for (the map centre, rounded).
  lat: number
  lng: number
  // Height of the model grid cell, m.
  groundElevation: number
  fetchedAt: number
  hours: FreezingHour[]
}

type Level = { levelM: number | null; belowGround: boolean }

// Highest height where the temperature drops through 0 °C going up,
// interpolated linearly between levels. Pressure levels at or below the
// ground (extrapolated by the model) are skipped.
export function computeFreezingLevel(
  groundZ: number,
  groundT: number | null,
  levelZ: readonly (number | null)[],
  levelT: readonly (number | null)[],
): Level {
  const pz: number[] = []
  const pt: number[] = []
  if (groundT !== null && Number.isFinite(groundT)) {
    pz.push(groundZ)
    pt.push(groundT)
  }
  for (let i = 0; i < levelZ.length; i++) {
    const z = levelZ[i]
    const t = levelT[i]
    if (z === null || t === null || !Number.isFinite(z) || !Number.isFinite(t) || z <= groundZ) continue
    pz.push(z)
    pt.push(t)
  }
  if (pz.length === 0) return { levelM: null, belowGround: false }
  for (let i = pz.length - 2; i >= 0; i--) {
    if (pt[i] > 0 && pt[i + 1] <= 0) {
      return {
        levelM: Math.round(pz[i] + ((pz[i + 1] - pz[i]) * pt[i]) / (pt[i] - pt[i + 1])),
        belowGround: false,
      }
    }
  }
  if (pt[0] <= 0) return { levelM: Math.round(groundZ), belowGround: true }
  // Above freezing all the way up (rare): report the top level.
  return { levelM: Math.round(pz[pz.length - 1]), belowGround: false }
}

export function freezingForecastUrl(lat: number, lng: number): string {
  const hourly = [
    'temperature_2m',
    ...PRESSURE_LEVELS.map((p) => `temperature_${p}hPa`),
    ...PRESSURE_LEVELS.map((p) => `geopotential_height_${p}hPa`),
  ].join(',')
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lng.toFixed(2),
    hourly,
    models: FREEZING_MODEL,
    forecast_hours: String(FORECAST_HOURS + 1),
    timeformat: 'unixtime',
    timezone: 'GMT',
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

function numberArray(value: unknown): (number | null)[] | null {
  if (!Array.isArray(value)) return null
  return value.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null))
}

export function parseFreezingForecast(
  json: unknown,
  lat: number,
  lng: number,
  fetchedAt: number,
): FreezingForecast {
  if (typeof json !== 'object' || json === null) throw new Error('Open-Meteo returned no data')
  const doc = json as Record<string, unknown>
  if (doc.error === true) {
    throw new Error(`Open-Meteo: ${typeof doc.reason === 'string' ? doc.reason : 'error'}`)
  }
  const hourly = doc.hourly as Record<string, unknown> | undefined
  const times = numberArray(hourly?.time)
  if (!hourly || !times || times.length === 0) throw new Error('Open-Meteo forecast has no hours')
  const groundZ = typeof doc.elevation === 'number' ? doc.elevation : 0
  const groundT = numberArray(hourly.temperature_2m) ?? []
  const levelT = PRESSURE_LEVELS.map((p) => numberArray(hourly[`temperature_${p}hPa`]) ?? [])
  const levelZ = PRESSURE_LEVELS.map((p) => numberArray(hourly[`geopotential_height_${p}hPa`]) ?? [])

  const hours: FreezingHour[] = []
  times.forEach((t, i) => {
    if (t === null) return
    const level = computeFreezingLevel(
      groundZ,
      groundT[i] ?? null,
      levelZ.map((a) => a[i] ?? null),
      levelT.map((a) => a[i] ?? null),
    )
    hours.push({ time: t * 1000, ...level })
  })
  return { lat, lng, groundElevation: Math.round(groundZ), fetchedAt, hours }
}

export async function fetchFreezingForecast(
  lat: number,
  lng: number,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<FreezingForecast> {
  const res = await fetchFn(freezingForecastUrl(lat, lng), { signal })
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`)
  return parseFreezingForecast(await res.json(), lat, lng, Date.now())
}

// The forecast hour nearest `time` (within 90 min), or null.
export function hourAt(forecast: FreezingForecast | null, time: number): FreezingHour | null {
  if (!forecast) return null
  let best: FreezingHour | null = null
  let bestDiff = 90 * 60 * 1000
  for (const h of forecast.hours) {
    const diff = Math.abs(h.time - time)
    if (diff <= bestDiff) {
      bestDiff = diff
      best = h
    }
  }
  return best
}

// Great-circle distance in km (haversine).
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}
